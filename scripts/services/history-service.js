import { executeTransaction } from "../state/transactions.js";
import { WorldStateRepository } from "../state/repository.js";
import { MODULE_CAPABILITY } from "./permission-service.js";
import { normalizeRelationship } from "../domain/score.js";
import { normalizePortrait } from "../domain/portraits.js";

const REVERSIBLE_TYPES = new Set([
  "relationship",
  "portrait",
  "subject-archive",
  "subject-active",
  "subject-reorder",
  "subject-update",
  "profile-update",
  "profile-reorder",
  "profile-group",
  "focal-update",   // Inclusão canônica da Seção 55
  "profile-roster"  // Inclusão canônica da Seção 55
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

function touch(record, now) {
  record.metadata ??= {};
  record.metadata.updatedAt = now;
  record.metadata.updatedBy = globalThis.game?.user?.id ?? null;
}

function applyEventSnapshot(draft, event, snapshot, now) {
  const subjectId = String(event.subjectId || "");
  const profileId = String(event.profileId || "");

  if (event.type === "relationship") {
    const profile = draft.profiles?.[profileId];
    if (!profile || !draft.subjects?.[subjectId]) return;
    profile.relationships ??= {};
    const norm = normalizeRelationship(snapshot ?? {});
    profile.relationships[subjectId] = {
      ...norm,
      revision: (profile.relationships[subjectId]?.revision ?? 0) + 1,
      updatedAt: now,
      updatedBy: globalThis.game?.user?.id ?? null
    };
    touch(profile, now);
    return;
  }

  if (event.type === "focal-update") {
    const profile = draft.profiles?.[profileId];
    if (!profile) return;
    profile.focal = snapshot ? { ...snapshot } : null;
    touch(profile, now);
    return;
  }

  if (event.type === "profile-roster") {
    const profile = draft.profiles?.[profileId];
    if (!profile) return;
    profile.subjectIds = Array.isArray(snapshot) ? [...snapshot] : [];
    touch(profile, now);
    return;
  }

  if (["profile-update", "profile-reorder", "profile-group"].includes(event.type)) {
    const profile = draft.profiles?.[profileId];
    if (!profile) return;
    if (event.type === "profile-update") {
      if (snapshot?.name !== undefined) profile.name = String(snapshot.name || profile.name || "");
      if (snapshot?.groupId !== undefined) profile.groupId = snapshot.groupId || null;
      if (snapshot?.active !== undefined) profile.active = Boolean(snapshot.active);
      if (snapshot?.archived !== undefined) profile.archived = Boolean(snapshot.archived);
      if (snapshot?.sortOrder !== undefined) profile.sortOrder = Number(snapshot.sortOrder) || 0;
    } else if (event.type === "profile-reorder") {
      profile.sortOrder = Number(snapshot?.sortOrder) || 0;
    } else if (event.type === "profile-group") {
      profile.groupId = snapshot?.groupId || null;
    }
    touch(profile, now);
    return;
  }

  const subject = draft.subjects?.[subjectId];
  if (!subject) return;

  if (event.type === "portrait") {
    subject.portrait = normalizePortrait(snapshot ?? {});
  } else if (event.type === "subject-archive") {
    subject.archived = Boolean(snapshot?.archived);
  } else if (event.type === "subject-active") {
    subject.active = Boolean(snapshot?.active);
  } else if (event.type === "subject-reorder") {
    subject.sortOrder = Number(snapshot?.sortOrder) || 0;
  } else if (event.type === "subject-update") {
    if (snapshot?.alias !== undefined) subject.alias = String(snapshot.alias || "");
    if (snapshot?.realName !== undefined) subject.realName = String(snapshot.realName || "");
    if (snapshot?.description !== undefined) subject.description = String(snapshot.description || "");
    if (snapshot?.active !== undefined) subject.active = Boolean(snapshot.active);
    if (snapshot?.archived !== undefined) subject.archived = Boolean(snapshot.archived);
    if (snapshot?.sortOrder !== undefined) subject.sortOrder = Number(snapshot.sortOrder) || 0;
    if (snapshot?.portrait) subject.portrait = normalizePortrait(snapshot.portrait);
    if (Array.isArray(snapshot?.tags)) subject.metadata = { ...(subject.metadata ?? {}), tags: [...snapshot.tags] };
  }
  touch(subject, now);
}

export class HistoryService {
  static list({
    state = WorldStateRepository.load(),
    filter = "all",
    profileId = null,
    subjectId = null,
    limit = 100
  } = {}) {
    let events = Array.isArray(state.history) ? [...state.history] : [];

    if (profileId) {
      events = events.filter((e) => String(e.profileId) === String(profileId));
    }
    if (subjectId) {
      events = events.filter((e) => String(e.subjectId) === String(subjectId));
    }

    if (filter === "relationships") {
      events = events.filter((e) => e.type === "relationship");
    } else if (filter === "profiles") {
      events = events.filter((e) => e.type.startsWith("profile") || e.type.startsWith("focal"));
    } else if (filter === "characters") {
      events = events.filter((e) => e.type.startsWith("subject") || e.type === "portrait");
    }

    events.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
    return events.slice(0, Math.max(1, Number(limit) || 100));
  }

  static buildUndoRedoState(state = WorldStateRepository.load()) {
    const history = Array.isArray(state.history) ? state.history : [];
    const groups = buildGroups(history);
    const undoStack = [];
    const redoStack = [];
    const seen = new Set();

    for (const event of history) {
      if (REVERSIBLE_TYPES.has(event?.type)) {
        const key = transactionKey(event);
        if (!key || seen.has(key)) continue;
        seen.add(key);
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

    const undoTarget = undoStack.at(-1) ?? null;
    const redoTarget = redoStack.at(-1) ?? null;

    return Object.freeze({
      canUndo: Boolean(undoTarget),
      canRedo: Boolean(redoTarget),
      undoTarget,
      redoTarget,
      undoDepth: undoStack.length,
      redoDepth: redoStack.length
    });
  }

  static async undo() {
    const state = WorldStateRepository.load();
    const stack = this.buildUndoRedoState(state);
    if (!stack.canUndo || !stack.undoTarget) return null;

    const targetId = stack.undoTarget;
    const events = (state.history ?? []).filter(
      (e) => REVERSIBLE_TYPES.has(e?.type) && transactionKey(e) === targetId
    );
    if (!events.length) return null;

    const ordered = [...events].reverse();

    return executeTransaction({
      capability: MODULE_CAPABILITY.HISTORY,
      type: "undo",
      transactionId: `undo-${Date.now().toString(36)}`,
      mutate: (draft) => {
        const now = Date.now();
        for (const event of ordered) {
          applyEventSnapshot(draft, event, event.before, now);
        }
        draft.history ??= [];
        draft.history.push({
          id: `gms-history-${Date.now().toString(36)}`,
          type: "undo",
          timestamp: now,
          userId: globalThis.game?.user?.id ?? null,
          before: { targetTransactionId: targetId },
          after: { targetTransactionId: targetId }
        });
      }
    });
  }

  static async redo() {
    const state = WorldStateRepository.load();
    const stack = this.buildUndoRedoState(state);
    if (!stack.canRedo || !stack.redoTarget) return null;

    const targetId = stack.redoTarget;
    const events = (state.history ?? []).filter(
      (e) => REVERSIBLE_TYPES.has(e?.type) && transactionKey(e) === targetId
    );
    if (!events.length) return null;

    return executeTransaction({
      capability: MODULE_CAPABILITY.HISTORY,
      type: "redo",
      transactionId: `redo-${Date.now().toString(36)}`,
      mutate: (draft) => {
        const now = Date.now();
        for (const event of events) {
          applyEventSnapshot(draft, event, event.after, now);
        }
        draft.history ??= [];
        draft.history.push({
          id: `gms-history-${Date.now().toString(36)}`,
          type: "redo",
          timestamp: now,
          userId: globalThis.game?.user?.id ?? null,
          before: { targetTransactionId: targetId },
          after: { targetTransactionId: targetId }
        });
      }
    });
  }
}
