import { MODULE_CAPABILITY, canUser } from "../persistence/permissions.js";
import { createRelationship } from "./schema.js";
import { normalizeRelationship } from "../core/score.js";
import { normalizePortrait } from "../core/portrait.js";
import { appendHistoryEvent, createTransactionId, describeHistoryEvent } from "./history-registry.js";
import { loadWorldState, mutateWorldState } from "../persistence/world-store.js";

const REVERSIBLE_TYPES = new Set([
  "relationship",
  "portrait",
  "subject-archive",
  "subject-active",
  "subject-reorder",
  "subject-update",
  "profile-update",
  "profile-reorder",
  "profile-group"
]);

function transactionKey(event = {}) {
  return String(event.transactionId || event.id || "").trim();
}

function markerTarget(event = {}) {
  return String(event.after?.targetTransactionId || event.before?.targetTransactionId || "").trim();
}

function removeLast(stack, key) {
  const index = stack.lastIndexOf(key);
  if (index >= 0) stack.splice(index, 1);
}

function buildGroups(history = []) {
  const groups = new Map();
  for (const event of history) {
    if (!REVERSIBLE_TYPES.has(event?.type)) continue;
    const key = transactionKey(event);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  return groups;
}

export function buildUndoRedoState(state = loadWorldState()) {
  const history = Array.isArray(state.history) ? state.history : [];
  const groups = buildGroups(history);
  const undoStack = [];
  const redoStack = [];
  const seenTransactions = new Set();

  for (const event of history) {
    if (REVERSIBLE_TYPES.has(event?.type)) {
      const key = transactionKey(event);
      if (!key || seenTransactions.has(key)) continue;
      seenTransactions.add(key);
      undoStack.push(key);
      redoStack.length = 0;
      continue;
    }
    if (event?.type === "undo") {
      const target = markerTarget(event);
      if (!target || !groups.has(target)) continue;
      removeLast(undoStack, target);
      removeLast(redoStack, target);
      redoStack.push(target);
      continue;
    }
    if (event?.type === "redo") {
      const target = markerTarget(event);
      if (!target || !groups.has(target)) continue;
      removeLast(redoStack, target);
      removeLast(undoStack, target);
      undoStack.push(target);
    }
  }

  const describeTarget = (key) => {
    const events = groups.get(key) ?? [];
    if (!events.length) return null;
    const first = describeHistoryEvent(events[0]);
    const subjects = new Set(events.map((event) => event.subjectId).filter(Boolean));
    return Object.freeze({
      transactionId: key,
      eventCount: events.length,
      subjectCount: subjects.size,
      type: first.type,
      typeLabel: first.typeLabel,
      timestamp: Math.max(...events.map((event) => Number(event.timestamp) || 0)),
      label: `${first.typeLabel}${events.length > 1 ? ` // ${events.length} registros` : ""}`
    });
  };

  const undoTarget = undoStack.at(-1) ?? "";
  const redoTarget = redoStack.at(-1) ?? "";
  return Object.freeze({
    canUndo: Boolean(undoTarget),
    canRedo: Boolean(redoTarget),
    undoDepth: undoStack.length,
    redoDepth: redoStack.length,
    undoTarget: describeTarget(undoTarget),
    redoTarget: describeTarget(redoTarget),
    undoStack: Object.freeze([...undoStack]),
    redoStack: Object.freeze([...redoStack])
  });
}

function touch(record, now) {
  record.metadata ??= {};
  record.metadata.updatedAt = now;
  record.metadata.updatedBy = globalThis.game?.user?.id ?? null;
}

function applyRelationshipSnapshot(draft, event, snapshot, now) {
  const profile = draft.profiles?.[String(event.profileId || "")];
  const subjectId = String(event.subjectId || "");
  if (!profile || !draft.subjects?.[subjectId]) throw new Error(`Undo target relationship is unavailable: ${event.profileId}/${subjectId}.`);
  profile.relationships ??= {};
  const current = normalizeRelationship(profile.relationships[subjectId] ?? {});
  const next = normalizeRelationship(snapshot ?? {});
  profile.relationships[subjectId] = createRelationship(subjectId, {
    ...next,
    revision: current.revision + 1,
    updatedAt: now,
    updatedBy: globalThis.game?.user?.id ?? null
  });
  touch(profile, now);
}

function applyEventSnapshot(draft, event, snapshot, now) {
  const subjectId = String(event.subjectId || "");
  if (event.type === "relationship") return applyRelationshipSnapshot(draft, event, snapshot, now);
  if (["profile-update", "profile-reorder", "profile-group"].includes(event.type)) {
    const profileId = String(event.profileId || "");
    const profile = draft.profiles?.[profileId];
    if (!profile) throw new Error(`Undo target profile is unavailable: ${profileId}.`);
    if (event.type === "profile-update") {
      if (snapshot?.name !== undefined) profile.name = String(snapshot.name || profile.name || "");
      if (snapshot?.groupId !== undefined) profile.groupId = snapshot.groupId == null || snapshot.groupId === "" ? null : String(snapshot.groupId);
      if (snapshot?.active !== undefined) profile.active = Boolean(snapshot.active);
      if (snapshot?.archived !== undefined) profile.archived = Boolean(snapshot.archived);
      if (snapshot?.sortOrder !== undefined) profile.sortOrder = Number(snapshot.sortOrder) || 0;
    } else if (event.type === "profile-reorder") {
      profile.sortOrder = Number(snapshot?.sortOrder) || 0;
      const peer = draft.profiles?.[String(snapshot?.peerId || "")];
      if (peer && snapshot?.peerSortOrder !== undefined) { peer.sortOrder = Number(snapshot.peerSortOrder) || 0; touch(peer, now); }
    } else if (event.type === "profile-group") {
      profile.groupId = snapshot?.groupId == null || snapshot?.groupId === "" ? null : String(snapshot.groupId);
    }
    touch(profile, now);
    return;
  }
  const subject = draft.subjects?.[subjectId];
  if (!subject) throw new Error(`Undo target subject is unavailable: ${subjectId}.`);

  if (event.type === "portrait") subject.portrait = normalizePortrait(snapshot ?? {});
  else if (event.type === "subject-archive") subject.archived = Boolean(snapshot?.archived);
  else if (event.type === "subject-active") subject.active = Boolean(snapshot?.active);
  else if (event.type === "subject-reorder") subject.sortOrder = Number(snapshot?.sortOrder) || 0;
  else if (event.type === "subject-update") {
    subject.alias = String(snapshot?.alias ?? subject.alias ?? "");
    subject.realName = String(snapshot?.realName ?? subject.realName ?? "");
    subject.description = String(snapshot?.description ?? subject.description ?? "");
    subject.active = snapshot?.active === undefined ? subject.active : Boolean(snapshot.active);
    subject.archived = snapshot?.archived === undefined ? subject.archived : Boolean(snapshot.archived);
    subject.sortOrder = Number.isFinite(Number(snapshot?.sortOrder)) ? Number(snapshot.sortOrder) : subject.sortOrder;
    if (snapshot?.portrait) subject.portrait = normalizePortrait(snapshot.portrait);
    subject.metadata ??= {};
    if (Array.isArray(snapshot?.tags)) subject.metadata.tags = [...new Set(snapshot.tags.map(String))];
  }
  else throw new Error(`Unsupported undo history type: ${event.type}.`);
  touch(subject, now);
}

async function applyHistoryDirection(direction = "undo", { reason = "" } = {}) {
  if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.HISTORY)) throw new Error("Sua função atual não possui permissão para desfazer/refazer alterações.");
  const state = loadWorldState();
  const stack = buildUndoRedoState(state);
  const target = direction === "redo" ? stack.redoTarget : stack.undoTarget;
  if (!target?.transactionId) return state;
  const targetId = target.transactionId;
  const events = state.history.filter((event) => REVERSIBLE_TYPES.has(event?.type) && transactionKey(event) === targetId);
  if (!events.length) return state;
  const ordered = direction === "undo" ? [...events].reverse() : [...events];
  const markerTransactionId = createTransactionId(direction);

  return mutateWorldState((draft) => {
    const now = Date.now();
    for (const event of ordered) {
      applyEventSnapshot(draft, event, direction === "undo" ? event.before : event.after, now);
    }
    appendHistoryEvent(draft, {
      type: direction,
      before: {
        targetTransactionId: targetId,
        eventCount: events.length,
        state: direction === "undo" ? "applied" : "undone"
      },
      after: {
        targetTransactionId: targetId,
        eventCount: events.length,
        eventIds: events.map((event) => event.id),
        state: direction === "undo" ? "undone" : "applied"
      },
      reason: String(reason || "").trim(),
      transactionId: markerTransactionId
    });
  });
}

export async function undoLastTransaction(options = {}) {
  const stack = buildUndoRedoState();
  if (!stack.canUndo) return loadWorldState();
  return applyHistoryDirection("undo", options);
}

export async function redoLastTransaction(options = {}) {
  const stack = buildUndoRedoState();
  if (!stack.canRedo) return loadWorldState();
  return applyHistoryDirection("redo", options);
}

export { REVERSIBLE_TYPES };
