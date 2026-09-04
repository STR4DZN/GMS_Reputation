import { createRelationship, createSubject } from "./schema.js";
import { loadWorldState, mutateWorldState, NO_STATE_CHANGE } from "../persistence/world-store.js";
import { appendHistoryEvent, createTransactionId } from "./history-registry.js";

function randomToken(length = 12) {
  const foundryRandom = globalThis.foundry?.utils?.randomID;
  if (typeof foundryRandom === "function") return foundryRandom(length);
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  globalThis.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, (value, index) => alphabet[(value || (Date.now() + index)) % alphabet.length]).join("");
}

function nextSubjectId(subjects = {}) {
  let id;
  do id = `gms-subject-${randomToken(12)}`;
  while (Object.hasOwn(subjects, id));
  return id;
}

function nextSortOrder(subjects = {}) {
  const values = Object.values(subjects).map((subject) => Number(subject.sortOrder) || 0);
  return (values.length ? Math.max(...values) : 0) + 10;
}

function touchSubject(subject, userId = globalThis.game?.user?.id ?? null) {
  const now = Date.now();
  subject.metadata ??= {};
  subject.metadata.updatedAt = now;
  subject.metadata.updatedBy = userId ? String(userId) : null;
  return subject;
}

export function listSubjects({ includeArchived = false, includeInactive = true } = {}) {
  const state = loadWorldState();
  return Object.values(state.subjects)
    .filter((subject) => includeArchived || !subject.archived)
    .filter((subject) => includeInactive || subject.active)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || a.realName.localeCompare(b.realName, "pt-BR"));
}

export function getSubject(subjectId) {
  const state = loadWorldState();
  return state.subjects[String(subjectId)] ?? null;
}

export function searchSubjects(query = "", options = {}) {
  const needle = String(query ?? "").trim().toLocaleLowerCase("pt-BR");
  const source = listSubjects(options);
  if (!needle) return source;
  return source.filter((subject) => {
    const haystack = [subject.realName, subject.alias, ...(subject.metadata?.legacyNames ?? [])]
      .join("\u0000")
      .toLocaleLowerCase("pt-BR");
    return haystack.includes(needle);
  });
}

export async function createNewSubject(input = {}) {
  return mutateWorldState((draft) => {
    const id = input.id ? String(input.id) : nextSubjectId(draft.subjects);
    if (draft.subjects[id]) throw new Error(`Subject ${id} already exists.`);
    draft.subjects[id] = createSubject({
      ...input,
      id,
      sortOrder: input.sortOrder ?? nextSortOrder(draft.subjects),
      metadata: {
        ...(input.metadata ?? {}),
        createdBy: globalThis.game?.user?.id ?? null,
        updatedBy: globalThis.game?.user?.id ?? null
      }
    });
    for (const profile of Object.values(draft.profiles ?? {})) {
      profile.relationships ??= {};
      profile.subjectIds ??= Object.keys(profile.relationships);
      profile.relationships[id] = createRelationship(id, { score: 0 });
      if (!profile.subjectIds.includes(id)) profile.subjectIds.push(id);
    }
    appendHistoryEvent(draft, {
      subjectId: id,
      type: "subject-create",
      before: null,
      after: { alias: draft.subjects[id].alias, realName: draft.subjects[id].realName },
      transactionId: createTransactionId("subject-create")
    });
  });
}

export async function updateSubject(subjectId, patch = {}, { reason = "" } = {}) {
  const id = String(subjectId);
  return mutateWorldState((draft) => {
    const current = draft.subjects[id];
    if (!current) throw new Error(`Subject ${id} was not found.`);
    const next = createSubject({
      ...current,
      ...patch,
      id,
      portrait: patch.portrait === undefined ? current.portrait : patch.portrait,
      metadata: {
        ...(current.metadata ?? {}),
        ...(patch.metadata ?? {}),
        createdAt: current.metadata?.createdAt,
        createdBy: current.metadata?.createdBy
      }
    });
    const comparable = (subject) => ({
      realName: subject.realName,
      alias: subject.alias,
      description: subject.description,
      portrait: subject.portrait,
      active: subject.active,
      archived: subject.archived,
      sortOrder: subject.sortOrder,
      tags: subject.metadata?.tags ?? []
    });
    if (JSON.stringify(comparable(current)) === JSON.stringify(comparable(next))) return NO_STATE_CHANGE;
    touchSubject(next);
    draft.subjects[id] = next;
    appendHistoryEvent(draft, {
      subjectId: id,
      type: "subject-update",
      before: comparable(current),
      after: comparable(next),
      reason,
      transactionId: createTransactionId("subject-update")
    });
  });
}

export async function moveSubjectOneStep(subjectId, direction = "up", { reason = "" } = {}) {
  const id = String(subjectId ?? "").trim();
  const dir = String(direction || "up").toLowerCase();
  if (!id || !["up", "down"].includes(dir)) throw new Error("Personagem e direção são obrigatórios.");
  return mutateWorldState((draft) => {
    const ordered = Object.values(draft.subjects ?? {})
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.realName).localeCompare(String(b.realName), "pt-BR"));
    const index = ordered.findIndex((subject) => subject.id === id);
    if (index < 0) throw new Error(`Subject ${id} was not found.`);
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ordered.length) return NO_STATE_CHANGE;
    const current = ordered[index];
    const before = Number(current.sortOrder) || 0;
    let after;
    if (dir === "up") {
      const previous = ordered[target];
      const beforePrevious = ordered[target - 1];
      after = beforePrevious ? (Number(beforePrevious.sortOrder) + Number(previous.sortOrder)) / 2 : Number(previous.sortOrder) - 10;
    } else {
      const next = ordered[target];
      const afterNext = ordered[target + 1];
      after = afterNext ? (Number(next.sortOrder) + Number(afterNext.sortOrder)) / 2 : Number(next.sortOrder) + 10;
    }
    draft.subjects[id].sortOrder = after;
    touchSubject(draft.subjects[id]);
    appendHistoryEvent(draft, {
      subjectId: id,
      type: "subject-reorder",
      before: { sortOrder: before },
      after: { sortOrder: after },
      reason,
      transactionId: createTransactionId("subject-reorder")
    });
  });
}

export async function setSubjectActive(subjectId, active) {
  return updateSubject(subjectId, { active: Boolean(active) });
}

export async function archiveSubject(subjectId, archived = true) {
  return updateSubject(subjectId, { archived: Boolean(archived) });
}

/**
 * Duplica identidade/retrato/descrição. Relações são específicas de Profile e, por segurança,
 * só são clonadas quando copyRelationships=true for solicitado explicitamente.
 */
export async function duplicateSubject(subjectId, { copyRelationships = false, aliasSuffix = " — Cópia" } = {}) {
  const sourceId = String(subjectId);
  return mutateWorldState((draft) => {
    const source = draft.subjects[sourceId];
    if (!source) throw new Error(`Subject ${sourceId} was not found.`);
    const id = nextSubjectId(draft.subjects);
    const copy = createSubject({
      ...source,
      id,
      alias: `${source.alias || source.realName}${aliasSuffix}`.trim(),
      archived: false,
      active: true,
      sortOrder: nextSortOrder(draft.subjects),
      metadata: {
        ...(source.metadata ?? {}),
        duplicatedFrom: sourceId,
        legacyNames: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: globalThis.game?.user?.id ?? null,
        updatedBy: globalThis.game?.user?.id ?? null
      }
    });
    draft.subjects[id] = copy;

    for (const profile of Object.values(draft.profiles ?? {})) {
      profile.relationships ??= {};
      profile.subjectIds ??= Object.keys(profile.relationships);
      const relationship = profile.relationships?.[sourceId];
      profile.relationships[id] = copyRelationships && relationship
        ? {
            ...relationship,
            subjectId: id,
            revision: 0,
            updatedAt: Date.now(),
            updatedBy: globalThis.game?.user?.id ?? null
          }
        : createRelationship(id, { score: 0 });
      if (profile.subjectIds.includes(sourceId) && !profile.subjectIds.includes(id)) profile.subjectIds.push(id);
    }
  });
}

export async function reorderSubjects(orderedIds = []) {
  const ids = [...new Set(orderedIds.map(String))];
  return mutateWorldState((draft) => {
    const existing = new Set(Object.keys(draft.subjects));
    for (const id of ids) if (!existing.has(id)) throw new Error(`Subject ${id} was not found.`);

    const remaining = Object.values(draft.subjects)
      .filter((subject) => !ids.includes(subject.id))
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || a.realName.localeCompare(b.realName, "pt-BR"))
      .map((subject) => subject.id);

    const finalOrder = [...ids, ...remaining];
    finalOrder.forEach((id, index) => {
      draft.subjects[id].sortOrder = (index + 1) * 10;
      touchSubject(draft.subjects[id]);
    });
  });
}
