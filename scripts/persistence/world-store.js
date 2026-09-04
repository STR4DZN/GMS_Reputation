import { MODULE_ID, SETTINGS } from "../constants.js";
import { createEmptyWorldState, normalizeWorldState } from "../data/schema.js";
import {
  MODULE_CAPABILITY,
  canUser,
  canWriteAny,
  isFullGamemaster,
  isAssistant,
  isTrustedPlayer,
  designatedAuthorityUser
} from "./permissions.js";
import { requestAuthorityWrite } from "./authority-broker.js";

export const NO_STATE_CHANGE = Symbol("gms-reputation.no-state-change");

export class RevisionConflictError extends Error {
  constructor(expected, actual) {
    super(`GMS Reputation revision conflict: expected ${expected}, current ${actual}.`);
    this.name = "RevisionConflictError";
    this.expectedRevision = expected;
    this.actualRevision = actual;
  }
}

function assertSettingsReady() {
  if (!globalThis.game?.settings) throw new Error("Foundry game.settings is not available yet.");
}

function clonePlain(value) {
  const deepClone = globalThis.foundry?.utils?.deepClone;
  if (deepClone && value && typeof value === "object") return deepClone(value);
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stable(value) {
  try { return JSON.stringify(value ?? null); } catch (_error) { return String(value); }
}

function changed(left, right) { return stable(left) !== stable(right); }

export function isWorldStateEmpty(state = {}) {
  return Object.keys(state.groups ?? {}).length === 0
    && Object.keys(state.subjects ?? {}).length === 0
    && Object.keys(state.profiles ?? {}).length === 0
    && (state.history?.length ?? 0) === 0;
}

/** Qualquer usuário autorizado pode solicitar uma gravação; somente full GM grava o world setting diretamente. */
export function canWriteWorldState(user = globalThis.game?.user) {
  return isFullGamemaster(user) || canWriteAny(user);
}

export function getRawWorldState() {
  assertSettingsReady();
  return game.settings.get(MODULE_ID, SETTINGS.WORLD_STATE) ?? {};
}

export function loadWorldState() { return normalizeWorldState(getRawWorldState()); }

export function getRawWorldStateBackup() {
  assertSettingsReady();
  return game.settings.get(MODULE_ID, SETTINGS.WORLD_STATE_BACKUP) ?? {};
}

export function loadWorldStateBackup() {
  const raw = getRawWorldStateBackup();
  if (!raw || typeof raw !== "object" || !Object.keys(raw).length) return null;
  return normalizeWorldState(raw);
}

export async function initializeWorldStateIfNeeded({ createdBy = game.user?.id ?? null } = {}) {
  assertSettingsReady();
  const raw = getRawWorldState();
  if (raw && typeof raw === "object" && Object.keys(raw).length) return normalizeWorldState(raw);
  if (!isFullGamemaster()) return createEmptyWorldState({ createdBy });
  const initial = createEmptyWorldState({ createdBy });
  await game.settings.set(MODULE_ID, SETTINGS.WORLD_STATE, initial);
  return normalizeWorldState(initial);
}

function historyAppendIsValid(current = [], candidate = [], requesterId = "") {
  if (!Array.isArray(candidate) || candidate.length < current.length) return false;
  for (let i = 0; i < current.length; i += 1) if (stable(current[i]) !== stable(candidate[i])) return false;
  return candidate.slice(current.length).every((event) => String(event?.userId ?? "") === String(requesterId));
}

/**
 * Security boundary for delegated Assistant/Trusted writes.
 * Full GM may write anything valid; delegated clients are constrained by the diff and module capability settings.
 */
export function requiredCapabilitiesForTransition(currentInput, candidateInput) {
  const current = normalizeWorldState(currentInput);
  const candidate = normalizeWorldState(candidateInput);
  const capabilities = new Set();
  const affectedSubjects = new Set();
  const structuralSubjectIds = new Set();

  if (changed(current.groups ?? {}, candidate.groups ?? {})) capabilities.add(MODULE_CAPABILITY.SUBJECTS);

  const subjectIds = new Set([...Object.keys(current.subjects), ...Object.keys(candidate.subjects)]);
  for (const id of subjectIds) {
    const before = current.subjects[id];
    const after = candidate.subjects[id];
    if (!before || !after) { capabilities.add(MODULE_CAPABILITY.SUBJECTS); affectedSubjects.add(id); structuralSubjectIds.add(id); continue; }
    if (changed(before.portrait, after.portrait)) capabilities.add(MODULE_CAPABILITY.PORTRAITS);
    const cleanMetadata = (metadata = {}) => { const { updatedAt, updatedBy, ...rest } = metadata ?? {}; return rest; };
    const stripPortrait = (subject) => ({ ...subject, portrait: undefined, metadata: cleanMetadata(subject.metadata) });
    if (changed(stripPortrait(before), stripPortrait(after))) capabilities.add(MODULE_CAPABILITY.SUBJECTS);
    if (changed(before, after)) affectedSubjects.add(id);
  }

  const profileIds = new Set([...Object.keys(current.profiles), ...Object.keys(candidate.profiles)]);
  for (const profileId of profileIds) {
    const before = current.profiles[profileId];
    const after = candidate.profiles[profileId];
    if (!before || !after) { capabilities.add(MODULE_CAPABILITY.SUBJECTS); continue; }
    if (changed(before.focal, after.focal)) capabilities.add(MODULE_CAPABILITY.FOCAL);
    const relIds = new Set([...Object.keys(before.relationships ?? {}), ...Object.keys(after.relationships ?? {})]);
    for (const subjectId of relIds) {
      if (changed(before.relationships?.[subjectId], after.relationships?.[subjectId])) {
        if (!structuralSubjectIds.has(subjectId)) capabilities.add(MODULE_CAPABILITY.RELATIONSHIPS);
        affectedSubjects.add(subjectId);
      }
    }
    const cleanMetadata = (metadata = {}) => { const { updatedAt, updatedBy, ...rest } = metadata ?? {}; return rest; };
    const stripDynamic = (profile) => ({ ...profile, focal: undefined, relationships: undefined, metadata: cleanMetadata(profile.metadata) });
    if (changed(stripDynamic(before), stripDynamic(after))) capabilities.add(MODULE_CAPABILITY.SUBJECTS);
  }

  const appended = (candidate.history?.length ?? 0) - (current.history?.length ?? 0);
  if (appended > 0 && candidate.history.slice(current.history.length).some((event) => ["undo", "redo"].includes(String(event?.type)))) {
    capabilities.add(MODULE_CAPABILITY.HISTORY);
  }
  if (affectedSubjects.size > 1) capabilities.add(MODULE_CAPABILITY.BULK);
  return Object.freeze([...capabilities]);
}

export function assertAuthorizedTransition(current, candidate, user) {
  if (isFullGamemaster(user)) return true;
  if (!user || (!isAssistant(user) && !isTrustedPlayer(user))) throw new Error("Este usuário possui acesso somente de leitura à Matriz de Reputação.");
  if (!historyAppendIsValid(current.history, candidate.history, user.id)) throw new Error("A trilha de histórico proposta é inválida ou tenta alterar eventos anteriores.");
  if (changed(current.migration, candidate.migration)) throw new Error("Clientes delegados não podem alterar metadados de migração.");
  if (changed(current.metadata, candidate.metadata)) throw new Error("Clientes delegados não podem alterar metadados mundiais diretamente.");
  const required = requiredCapabilitiesForTransition(current, candidate);
  for (const capability of required) {
    if (!canUser(user, capability)) throw new Error(`A função solicitada exige a permissão “${capability}”.`);
  }
  if (!required.length) throw new Error("A solicitação delegada não contém uma alteração autorizável.");
  return true;
}

let directWriteQueue = Promise.resolve();

async function performWorldStateDirectSave(nextInput, {
  expectedRevision,
  userId = game.user?.id ?? null,
  createBackup = true
} = {}) {
  assertSettingsReady();
  if (!isFullGamemaster()) throw new Error("Somente um Gamemaster completo pode gravar diretamente o WorldState.");
  const current = loadWorldState();
  if (expectedRevision !== undefined && expectedRevision !== null) {
    const expected = Math.max(0, Math.trunc(Number(expectedRevision) || 0));
    if (current.revision !== expected) throw new RevisionConflictError(expected, current.revision);
  }
  const next = normalizeWorldState(clonePlain(nextInput));
  const now = Date.now();
  next.revision = current.revision + 1;
  next.metadata.createdAt = Number(current.metadata?.createdAt) || Number(next.metadata?.createdAt) || now;
  next.metadata.createdBy = current.metadata?.createdBy ?? next.metadata?.createdBy ?? userId;
  next.metadata.updatedAt = now;
  next.metadata.updatedBy = userId ? String(userId) : null;
  if (createBackup) await game.settings.set(MODULE_ID, SETTINGS.WORLD_STATE_BACKUP, current);
  await game.settings.set(MODULE_ID, SETTINGS.WORLD_STATE, next);
  return normalizeWorldState(next);
}

function saveWorldStateDirect(nextInput, options = {}) {
  const task = directWriteQueue.then(() => performWorldStateDirectSave(nextInput, options));
  // Keep the queue alive after a rejected operation so later saves are not poisoned.
  directWriteQueue = task.catch(() => undefined);
  return task;
}

export async function handleDelegatedSaveRequest(message = {}) {
  if (!isFullGamemaster()) throw new Error("Este cliente não é uma autoridade completa do World.");
  const requester = globalThis.game?.users?.get?.(String(message.senderId || ""))
    ?? [...(globalThis.game?.users?.values?.() ?? [])].find((user) => String(user.id) === String(message.senderId));
  if (!requester) throw new Error("Usuário solicitante não encontrado no World.");
  const current = loadWorldState();
  const candidate = normalizeWorldState(message.candidate ?? {});
  assertAuthorizedTransition(current, candidate, requester);
  return saveWorldStateDirect(candidate, {
    expectedRevision: message.expectedRevision,
    userId: requester.id,
    createBackup: message.createBackup !== false
  });
}

export async function saveWorldState(nextInput, options = {}) {
  assertSettingsReady();
  const user = globalThis.game?.user;
  if (!canWriteWorldState(user)) throw new Error("Este usuário possui acesso somente de leitura à Matriz de Reputação.");
  if (isFullGamemaster(user)) {
    const authority = designatedAuthorityUser();
    if (!authority || String(authority.id) === String(user.id)) return saveWorldStateDirect(nextInput, options);
  }
  return requestAuthorityWrite(normalizeWorldState(clonePlain(nextInput)), {
    expectedRevision: options.expectedRevision,
    createBackup: options.createBackup !== false
  });
}

export async function mutateWorldState(mutator, options = {}) {
  if (typeof mutator !== "function") throw new TypeError("mutateWorldState requires a mutator function.");
  const current = loadWorldState();
  const draft = clonePlain(current);
  const result = await mutator(draft, current);
  if (result === NO_STATE_CHANGE) return current;
  const candidate = result && typeof result === "object" ? result : draft;
  return saveWorldState(candidate, { ...options, expectedRevision: current.revision });
}

export async function restoreWorldStateBackup({ userId = game.user?.id ?? null } = {}) {
  if (!isFullGamemaster()) throw new Error("Somente um Gamemaster completo pode restaurar o backup mundial.");
  const backup = loadWorldStateBackup();
  if (!backup) throw new Error("No GMS Reputation backup is available.");
  const current = loadWorldState();
  return saveWorldState(backup, { expectedRevision: current.revision, userId, createBackup: true });
}
