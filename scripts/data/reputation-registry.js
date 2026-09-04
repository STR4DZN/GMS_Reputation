import { createRelationship } from "./schema.js";
import { clampScore, normalizeRelationship } from "../core/score.js";
import { getReputationView } from "../core/reputation-engine.js";
import { appendHistoryEvent, createTransactionId, relationshipSnapshot } from "./history-registry.js";
import { loadWorldState, mutateWorldState, NO_STATE_CHANGE } from "../persistence/world-store.js";

export class ReputationRecordNotFoundError extends Error {
  constructor(profileId, subjectId, reason = "relationship") {
    super(`GMS Reputation ${reason} not found: profile=${profileId}, subject=${subjectId}.`);
    this.name = "ReputationRecordNotFoundError";
    this.profileId = String(profileId);
    this.subjectId = String(subjectId);
    this.reason = reason;
  }
}

export function resolveRelationshipRecord(state, profileId, subjectId, { createMissingRelationship = false } = {}) {
  const profileKey = String(profileId);
  const subjectKey = String(subjectId);
  const profile = state.profiles?.[profileKey];
  if (!profile) throw new ReputationRecordNotFoundError(profileKey, subjectKey, "profile");
  if (!state.subjects?.[subjectKey]) throw new ReputationRecordNotFoundError(profileKey, subjectKey, "subject");
  profile.relationships ??= {};
  if (!profile.relationships[subjectKey] && createMissingRelationship) {
    profile.relationships[subjectKey] = createRelationship(subjectKey, { score: 0 });
  }
  const relationship = profile.relationships[subjectKey];
  if (!relationship) throw new ReputationRecordNotFoundError(profileKey, subjectKey, "relationship");
  return { profile, relationship, profileKey, subjectKey };
}

function relationshipsEqual(a, b) {
  return a.score === b.score
    && a.communion === b.communion
    && a.bond === b.bond
    && a.note === b.note;
}

/** Pure helper shared by quick edit and bulk operations. */
export function computeRelationshipCandidate(currentInput = {}, patch = {}) {
  const current = normalizeRelationship(currentInput);
  const requestedCommunion = patch.communion === undefined ? current.communion : Boolean(patch.communion);
  const requestedBond = patch.bond === undefined ? current.bond : Boolean(patch.bond);
  const requestedScore = patch.score === undefined ? current.score : patch.score;
  return normalizeRelationship({
    ...current,
    score: clampScore(requestedScore, { communion: requestedCommunion, bond: requestedBond }),
    communion: requestedCommunion,
    bond: requestedBond,
    note: patch.note === undefined ? current.note : patch.note
  });
}

export function getRelationship(profileId, subjectId) {
  const state = loadWorldState();
  const { relationship } = resolveRelationshipRecord(state, profileId, subjectId);
  return createRelationship(subjectId, relationship);
}

export function getReputation(profileId, subjectId) {
  return getReputationView(getRelationship(profileId, subjectId));
}

/**
 * Única porta de mutação do domínio de reputação.
 * Campos derivados (specialState, hearts, colors, labels, limit) nunca são aceitos/persistidos.
 * O histórico é gravado dentro da MESMA transação do WorldState.
 */
export async function updateRelationship(profileId, subjectId, patch = {}, {
  reason = "",
  transactionId = null,
  recordHistory = true
} = {}) {
  const profileKey = String(profileId);
  const subjectKey = String(subjectId);
  return mutateWorldState((draft) => {
    const { profile, relationship } = resolveRelationshipRecord(draft, profileKey, subjectKey, { createMissingRelationship: true });
    const current = normalizeRelationship(relationship);
    const candidate = computeRelationshipCandidate(current, patch);

    if (relationshipsEqual(current, candidate)) return NO_STATE_CHANGE;

    const now = Date.now();
    profile.relationships[subjectKey] = createRelationship(subjectKey, {
      ...candidate,
      revision: current.revision + 1,
      updatedAt: now,
      updatedBy: globalThis.game?.user?.id ?? null
    });
    profile.metadata ??= {};
    profile.metadata.updatedAt = now;
    profile.metadata.updatedBy = globalThis.game?.user?.id ?? null;

    if (recordHistory) {
      appendHistoryEvent(draft, {
        profileId: profileKey,
        subjectId: subjectKey,
        type: "relationship",
        before: relationshipSnapshot(current),
        after: relationshipSnapshot(candidate),
        reason,
        transactionId: transactionId || createTransactionId("rel")
      });
    }
  });
}

export async function setReputationScore(profileId, subjectId, score, options = {}) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) throw new TypeError("Reputation score must be a finite number.");
  return updateRelationship(profileId, subjectId, { score: numeric }, options);
}

export async function adjustReputationScore(profileId, subjectId, delta, options = {}) {
  const numericDelta = Number(delta);
  if (!Number.isFinite(numericDelta)) throw new TypeError("Reputation delta must be a finite number.");
  const current = getRelationship(profileId, subjectId);
  return updateRelationship(profileId, subjectId, { score: current.score + numericDelta }, options);
}

/**
 * Bloco 09 — ativa/desativa Vínculo sem bônus oculto de score.
 * Ao remover o último estado que expande o limite, um score 10.5–12 é normalizado para +10.
 */
export async function setBond(profileId, subjectId, active = true, options = {}) {
  return updateRelationship(profileId, subjectId, { bond: Boolean(active) }, options);
}

/**
 * Bloco 10 — ativa/desativa Comunhão sem alterar o score por bônus implícito.
 * O limite expandido permanece enquanto Comunhão OU Vínculo estiver ativo.
 */
export async function setCommunion(profileId, subjectId, active = true, options = {}) {
  return updateRelationship(profileId, subjectId, { communion: Boolean(active) }, options);
}
