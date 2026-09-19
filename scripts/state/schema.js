import { DATA_SCHEMA_VERSION, MODULE_VERSION } from "../constants.js";
import { normalizeRelationship } from "../domain/score.js";
import { normalizePortrait, emptyPortrait } from "../domain/portraits.js";
import { assertValidId, sanitizeText, sanitizeMultilineText, finiteTimestamp, nonNegativeInteger } from "../domain/validation.js";
import { createProfile } from "../domain/profiles.js";
import { createSubject } from "../domain/subjects.js";

export { emptyPortrait, normalizePortrait };

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function createGroup({
  id,
  name = "",
  description = "",
  active = true,
  archived = false,
  sortOrder = 0,
  metadata = {}
} = {}) {
  const groupId = assertValidId(id, "Group id");
  const now = Date.now();
  return Object.freeze({
    id: groupId,
    name: sanitizeText(name, 160, "Grupo sem nome"),
    description: sanitizeMultilineText(description, 4000),
    active: Boolean(active),
    archived: Boolean(archived),
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    metadata: Object.freeze({
      ...(metadata || {}),
      createdAt: finiteTimestamp(metadata?.createdAt, now),
      updatedAt: finiteTimestamp(metadata?.updatedAt, now)
    })
  });
}

export { createSubject, createProfile };

export function createRelationship(subjectId, relationship = {}) {
  if (!subjectId) throw new Error("Relationship subjectId is required.");
  return Object.freeze({
    subjectId: String(subjectId),
    ...normalizeRelationship(relationship)
  });
}

export function createHistoryEvent({
  id,
  timestamp = Date.now(),
  userId = null,
  profileId = null,
  subjectId = null,
  type = "unknown",
  before = null,
  after = null,
  reason = "",
  transactionId = null
} = {}) {
  const eventId = assertValidId(id, "History event id");
  return Object.freeze({
    id: eventId,
    timestamp: finiteTimestamp(timestamp, Date.now()),
    userId: userId ? String(userId) : null,
    profileId: profileId ? String(profileId) : null,
    subjectId: subjectId ? String(subjectId) : null,
    type: String(type),
    before: before && typeof before === "object" ? { ...before } : null,
    after: after && typeof after === "object" ? { ...after } : null,
    reason: sanitizeText(reason, 2000),
    transactionId: transactionId ? String(transactionId) : null
  });
}

export function createEmptyWorldState({ createdBy = null } = {}) {
  const now = Date.now();
  return Object.freeze({
    schemaVersion: DATA_SCHEMA_VERSION,
    revision: 0,
    groups: Object.freeze({}),
    subjects: Object.freeze({}),
    profiles: Object.freeze({}),
    history: Object.freeze([]),
    metadata: Object.freeze({
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy ? String(createdBy) : null,
      updatedBy: createdBy ? String(createdBy) : null,
      version: MODULE_VERSION
    })
  });
}

export function normalizeWorldState(raw = {}) {
  const source = asRecord(raw);
  const now = Date.now();

  const groups = {};
  for (const [id, group] of Object.entries(asRecord(source.groups))) {
    if (group && typeof group === "object") {
      try { groups[id] = createGroup({ ...group, id }); } catch (_) {}
    }
  }

  const subjects = {};
  for (const [id, subject] of Object.entries(asRecord(source.subjects))) {
    if (subject && typeof subject === "object") {
      try { subjects[id] = createSubject({ ...subject, id }); } catch (_) {}
    }
  }

  const profiles = {};
  for (const [id, profile] of Object.entries(asRecord(source.profiles))) {
    if (profile && typeof profile === "object") {
      try { profiles[id] = createProfile({ ...profile, id }); } catch (_) {}
    }
  }

  const history = Array.isArray(source.history)
    ? source.history
        .filter((event) => event && typeof event === "object" && event.id)
        .map((event) => createHistoryEvent(event))
    : [];

  const rawMetadata = asRecord(source.metadata);
  const metadata = Object.freeze({
    createdAt: finiteTimestamp(rawMetadata.createdAt, now),
    updatedAt: finiteTimestamp(rawMetadata.updatedAt, now),
    createdBy: rawMetadata.createdBy ? String(rawMetadata.createdBy) : null,
    updatedBy: rawMetadata.updatedBy ? String(rawMetadata.updatedBy) : null,
    version: String(rawMetadata.version || MODULE_VERSION)
  });

  return Object.freeze({
    schemaVersion: DATA_SCHEMA_VERSION,
    revision: nonNegativeInteger(source.revision, 0),
    groups: Object.freeze(groups),
    subjects: Object.freeze(subjects),
    profiles: Object.freeze(profiles),
    history: Object.freeze(history),
    metadata
  });
}
