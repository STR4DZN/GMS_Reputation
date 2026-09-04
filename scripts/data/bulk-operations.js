import { createRelationship } from "./schema.js";
import { normalizeRelationship } from "../core/score.js";
import { computeRelationshipCandidate, resolveRelationshipRecord } from "./reputation-registry.js";
import { appendHistoryEvent, createTransactionId, relationshipSnapshot } from "./history-registry.js";
import { mutateWorldState, NO_STATE_CHANGE } from "../persistence/world-store.js";

function uniqueIds(subjectIds = []) {
  return [...new Set(Array.from(subjectIds ?? [], (value) => String(value || "").trim()).filter(Boolean))];
}

function relationshipChanged(a, b) {
  return a.score !== b.score || a.communion !== b.communion || a.bond !== b.bond || a.note !== b.note;
}

function resolveBulkPatch(current, operation = {}) {
  const patch = {};
  if (operation.scoreMode === "set") {
    const value = Number(operation.scoreValue);
    if (!Number.isFinite(value)) throw new TypeError("Bulk score value must be finite.");
    patch.score = value;
  } else if (operation.scoreMode === "delta") {
    const value = Number(operation.scoreValue);
    if (!Number.isFinite(value)) throw new TypeError("Bulk score delta must be finite.");
    patch.score = current.score + value;
  }
  if (["on", "off"].includes(operation.bond)) patch.bond = operation.bond === "on";
  if (["on", "off"].includes(operation.communion)) patch.communion = operation.communion === "on";
  return patch;
}

/**
 * Bloco 29 — altera várias Relationships em UMA única transação/save/backup.
 */
export async function applyBulkRelationshipChanges(profileId, subjectIds, operation = {}, { reason = "" } = {}) {
  const profileKey = String(profileId || "").trim();
  const ids = uniqueIds(subjectIds);
  if (!profileKey) throw new Error("profileId is required.");
  if (!ids.length) return null;
  const transactionId = createTransactionId("bulk-rel");

  return mutateWorldState((draft) => {
    let changeCount = 0;
    const now = Date.now();
    for (const subjectId of ids) {
      const { profile, relationship } = resolveRelationshipRecord(draft, profileKey, subjectId, { createMissingRelationship: true });
      const current = normalizeRelationship(relationship);
      const patch = resolveBulkPatch(current, operation);
      const candidate = computeRelationshipCandidate(current, patch);
      if (!relationshipChanged(current, candidate)) continue;

      profile.relationships[subjectId] = createRelationship(subjectId, {
        ...candidate,
        revision: current.revision + 1,
        updatedAt: now,
        updatedBy: globalThis.game?.user?.id ?? null
      });
      profile.metadata ??= {};
      profile.metadata.updatedAt = now;
      profile.metadata.updatedBy = globalThis.game?.user?.id ?? null;
      appendHistoryEvent(draft, {
        profileId: profileKey,
        subjectId,
        type: "relationship",
        before: relationshipSnapshot(current),
        after: relationshipSnapshot(candidate),
        reason,
        transactionId
      });
      changeCount += 1;
    }
    if (!changeCount) return NO_STATE_CHANGE;
  });
}

/** Bloco 29 — arquiva/restaura vários Subjects sem apagar dados. */
export async function bulkArchiveSubjects(subjectIds, archived = true, { reason = "" } = {}) {
  const ids = uniqueIds(subjectIds);
  if (!ids.length) return null;
  const transactionId = createTransactionId("bulk-archive");
  return mutateWorldState((draft) => {
    let changeCount = 0;
    const now = Date.now();
    for (const subjectId of ids) {
      const subject = draft.subjects?.[subjectId];
      if (!subject) throw new Error(`Subject ${subjectId} was not found.`);
      const before = Boolean(subject.archived);
      const after = Boolean(archived);
      if (before === after) continue;
      subject.archived = after;
      subject.metadata ??= {};
      subject.metadata.updatedAt = now;
      subject.metadata.updatedBy = globalThis.game?.user?.id ?? null;
      appendHistoryEvent(draft, {
        subjectId,
        type: "subject-archive",
        before: { archived: before },
        after: { archived: after },
        reason,
        transactionId
      });
      changeCount += 1;
    }
    if (!changeCount) return NO_STATE_CHANGE;
  });
}

/** Bloco 29 — ativa/desativa vários Subjects sem arquivar. */
export async function bulkSetSubjectsActive(subjectIds, active = true, { reason = "" } = {}) {
  const ids = uniqueIds(subjectIds);
  if (!ids.length) return null;
  const transactionId = createTransactionId("bulk-active");
  return mutateWorldState((draft) => {
    let changeCount = 0;
    const now = Date.now();
    for (const subjectId of ids) {
      const subject = draft.subjects?.[subjectId];
      if (!subject) throw new Error(`Subject ${subjectId} was not found.`);
      const before = Boolean(subject.active);
      const after = Boolean(active);
      if (before === after) continue;
      subject.active = after;
      subject.metadata ??= {};
      subject.metadata.updatedAt = now;
      subject.metadata.updatedBy = globalThis.game?.user?.id ?? null;
      appendHistoryEvent(draft, {
        subjectId,
        type: "subject-active",
        before: { active: before },
        after: { active: after },
        reason,
        transactionId
      });
      changeCount += 1;
    }
    if (!changeCount) return NO_STATE_CHANGE;
  });
}

/**
 * Move os selecionados para topo/fim mantendo a ordem relativa atual.
 * É suficiente para a edição em massa sem introduzir drag-and-drop prematuro.
 */
export async function moveSubjects(subjectIds, position = "top", { reason = "" } = {}) {
  const selected = uniqueIds(subjectIds);
  if (!selected.length) return null;
  const transactionId = createTransactionId("bulk-order");
  return mutateWorldState((draft) => {
    const currentOrder = Object.values(draft.subjects ?? {})
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.realName).localeCompare(String(b.realName), "pt-BR"))
      .map((subject) => subject.id);
    for (const id of selected) if (!draft.subjects?.[id]) throw new Error(`Subject ${id} was not found.`);
    const selectedSet = new Set(selected);
    const selectedInCurrentOrder = currentOrder.filter((id) => selectedSet.has(id));
    const rest = currentOrder.filter((id) => !selectedSet.has(id));
    const finalOrder = position === "bottom" ? [...rest, ...selectedInCurrentOrder] : [...selectedInCurrentOrder, ...rest];
    if (finalOrder.every((id, index) => id === currentOrder[index])) return NO_STATE_CHANGE;

    const now = Date.now();
    finalOrder.forEach((id, index) => {
      const subject = draft.subjects[id];
      const before = Number(subject.sortOrder) || 0;
      const after = (index + 1) * 10;
      if (before === after) return;
      subject.sortOrder = after;
      subject.metadata ??= {};
      subject.metadata.updatedAt = now;
      subject.metadata.updatedBy = globalThis.game?.user?.id ?? null;
      appendHistoryEvent(draft, {
        subjectId: id,
        type: "subject-reorder",
        before: { sortOrder: before },
        after: { sortOrder: after },
        reason,
        transactionId
      });
    });
  });
}
