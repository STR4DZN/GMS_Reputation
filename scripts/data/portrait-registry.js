import { normalizePortrait, portraitEquals } from "../core/portrait.js";
import { appendHistoryEvent, createTransactionId, portraitSnapshot } from "./history-registry.js";
import { loadWorldState, mutateWorldState, NO_STATE_CHANGE } from "../persistence/world-store.js";

function touchMetadata(record) {
  const now = Date.now();
  record.metadata ??= {};
  record.metadata.updatedAt = now;
  record.metadata.updatedBy = globalThis.game?.user?.id ?? null;
}

export function getSubjectPortrait(subjectId) {
  const subject = loadWorldState().subjects?.[String(subjectId)];
  if (!subject) throw new Error(`Subject ${subjectId} was not found.`);
  return normalizePortrait(subject.portrait);
}

export async function setSubjectPortrait(subjectId, portrait = {}, {
  reason = "",
  transactionId = null,
  profileId = null,
  recordHistory = true
} = {}) {
  const id = String(subjectId);
  return mutateWorldState((draft) => {
    const subject = draft.subjects?.[id];
    if (!subject) throw new Error(`Subject ${id} was not found.`);
    const current = normalizePortrait(subject.portrait);
    const next = normalizePortrait(portrait);
    if (portraitEquals(current, next)) return NO_STATE_CHANGE;
    subject.portrait = next;
    touchMetadata(subject);
    if (recordHistory) {
      appendHistoryEvent(draft, {
        profileId: profileId ? String(profileId) : null,
        subjectId: id,
        type: "portrait",
        before: portraitSnapshot(current),
        after: portraitSnapshot(next),
        reason,
        transactionId: transactionId || createTransactionId("portrait")
      });
    }
  });
}

export function getFocalPortrait(profileId) {
  const profile = loadWorldState().profiles?.[String(profileId)];
  if (!profile) throw new Error(`Profile ${profileId} was not found.`);
  return normalizePortrait(profile.focal?.portrait);
}

export async function setFocalPortrait(profileId, portrait = {}) {
  const id = String(profileId);
  return mutateWorldState((draft) => {
    const profile = draft.profiles?.[id];
    if (!profile) throw new Error(`Profile ${id} was not found.`);
    profile.focal ??= { portrait: normalizePortrait(), description: "" };
    const next = normalizePortrait(portrait);
    if (portraitEquals(profile.focal.portrait, next)) return NO_STATE_CHANGE;
    profile.focal.portrait = next;
    touchMetadata(profile);
  });
}
