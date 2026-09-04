import { DATA_SCHEMA_VERSION, MODULE_VERSION } from "../constants.js";
import { normalizeRelationship } from "../core/score.js";
import { normalizePortrait } from "../core/portrait.js";

export { emptyPortrait, normalizePortrait } from "../core/portrait.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function finiteTimestamp(value, fallback = Date.now()) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : fallback;
}

/**
 * Schema v5 — grupos organizam PERFIS; cada Perfil possui uma lista explícita de personagens visíveis.
 */
export function createGroup({
  id,
  name = "",
  description = "",
  active = true,
  archived = false,
  sortOrder = 0,
  metadata = {}
} = {}) {
  if (!id) throw new Error("Group id is required.");
  const safeMetadata = asRecord(metadata);
  const now = Date.now();
  return {
    id: String(id),
    name: String(name ?? "").trim().slice(0, 160) || "Grupo sem nome",
    description: String(description ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 4000),
    active: Boolean(active),
    archived: Boolean(archived),
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    metadata: {
      ...safeMetadata,
      createdAt: finiteTimestamp(safeMetadata.createdAt, now),
      updatedAt: finiteTimestamp(safeMetadata.updatedAt, now)
    }
  };
}

export function createSubject({
  id,
  realName = "",
  alias = "",
  description = "",
  portrait = {},
  active = true,
  archived = false,
  sortOrder = 0,
  metadata = {}
} = {}) {
  if (!id) throw new Error("Subject id is required.");
  const safeMetadata = asRecord(metadata);
  const now = Date.now();
  return {
    id: String(id),
    realName: String(realName).trim(),
    alias: String(alias).trim(),
    description: String(description ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 12000),
    portrait: normalizePortrait(portrait),
    active: Boolean(active),
    archived: Boolean(archived),
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    metadata: {
      ...safeMetadata,
      legacyNames: Array.isArray(safeMetadata.legacyNames) ? [...new Set(safeMetadata.legacyNames.map(String))] : [],
      tags: Array.isArray(safeMetadata.tags) ? [...new Set(safeMetadata.tags.map(String))] : [],
      createdAt: finiteTimestamp(safeMetadata.createdAt, now),
      updatedAt: finiteTimestamp(safeMetadata.updatedAt, now)
    }
  };
}

export function createRelationship(subjectId, relationship = {}) {
  if (!subjectId) throw new Error("Relationship subjectId is required.");
  return {
    subjectId: String(subjectId),
    ...normalizeRelationship(relationship)
  };
}

export function createProfile({
  id,
  name = "",
  groupId = null,
  source = {},
  focal = {},
  relationships = {},
  subjectIds = null,
  active = true,
  archived = false,
  sortOrder = 0,
  metadata = {}
} = {}) {
  if (!id) throw new Error("Profile id is required.");
  const safeSource = asRecord(source);
  const safeFocal = asRecord(focal);
  const safeMetadata = asRecord(metadata);
  const safeRelationships = asRecord(relationships);
  const now = Date.now();
  const profileName = String(name).trim();
  const focalName = String(safeFocal.name ?? profileName).trim() || profileName || "Perfil focal";
  const normalizedRelationships = {};
  for (const [subjectId, relationship] of Object.entries(safeRelationships)) {
    normalizedRelationships[subjectId] = createRelationship(subjectId, relationship);
  }
  const normalizedSubjectIds = Array.isArray(subjectIds)
    ? [...new Set(subjectIds.map((value) => String(value ?? "").trim()).filter(Boolean))]
    : Object.keys(normalizedRelationships);
  return {
    id: String(id),
    name: profileName,
    groupId: groupId == null || groupId === "" || groupId === "__ungrouped__" ? null : String(groupId),
    source: {
      journalUuid: safeSource.journalUuid ? String(safeSource.journalUuid) : null,
      pageId: safeSource.pageId ? String(safeSource.pageId) : null,
      pageUuid: safeSource.pageUuid ? String(safeSource.pageUuid) : null
    },
    focal: {
      name: focalName.slice(0, 240),
      portrait: normalizePortrait(safeFocal.portrait),
      description: String(safeFocal.description ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 12000)
    },
    relationships: normalizedRelationships,
    subjectIds: normalizedSubjectIds,
    active: Boolean(active),
    archived: Boolean(archived),
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    metadata: {
      ...safeMetadata,
      createdAt: finiteTimestamp(safeMetadata.createdAt, now),
      updatedAt: finiteTimestamp(safeMetadata.updatedAt, now)
    }
  };
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
  if (!id) throw new Error("History event id is required.");
  return {
    id: String(id),
    timestamp: finiteTimestamp(timestamp, Date.now()),
    userId: userId ? String(userId) : null,
    profileId: profileId ? String(profileId) : null,
    subjectId: subjectId ? String(subjectId) : null,
    type: String(type),
    before,
    after,
    reason: String(reason ?? "").slice(0, 2000),
    transactionId: transactionId ? String(transactionId) : null
  };
}

export function createEmptyWorldState({ createdBy = null } = {}) {
  const now = Date.now();
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    revision: 0,
    groups: {},
    subjects: {},
    profiles: {},
    history: [],
    migration: {
      legacyMacroImported: false,
      sourceUiVersion: null,
      importedAt: null,
      sourceJournalUuid: null
    },
    metadata: {
      moduleVersion: MODULE_VERSION,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy ? String(createdBy) : null,
      updatedBy: createdBy ? String(createdBy) : null
    }
  };
}

export function normalizeWorldState(input = {}) {
  const safeInput = asRecord(input);
  const safeMetadata = asRecord(safeInput.metadata);
  const safeGroups = asRecord(safeInput.groups);
  const safeSubjects = asRecord(safeInput.subjects);
  const safeProfiles = asRecord(safeInput.profiles);
  const base = createEmptyWorldState({ createdBy: safeMetadata.createdBy ?? null });
  const groups = {};
  const subjects = {};
  const profiles = {};

  for (const [id, group] of Object.entries(safeGroups)) {
    const safeGroup = asRecord(group);
    groups[id] = createGroup({ ...safeGroup, id: safeGroup.id ?? id });
  }
  for (const [id, subject] of Object.entries(safeSubjects)) {
    const safeSubject = asRecord(subject);
    subjects[id] = createSubject({ ...safeSubject, id: safeSubject.id ?? id });
  }
  for (const [id, profile] of Object.entries(safeProfiles)) {
    const safeProfile = asRecord(profile);
    profiles[id] = createProfile({ ...safeProfile, id: safeProfile.id ?? id });
  }

  // Hotfix 49.3 briefly interpreted groups as Subject categories. Preserve the
  // old assignment map in migration metadata for rollback/audit, but do not use
  // it in v5. Group records themselves remain Profile groups. Profiles from v4
  // without subjectIds automatically infer their roster from relationship keys.
  const legacySubjectGroupAssignments = {};
  if (Number(safeInput.schemaVersion) === 3) {
    for (const [id, subject] of Object.entries(safeSubjects)) {
      if (subject?.groupId) legacySubjectGroupAssignments[id] = String(subject.groupId);
    }
  }

  return {
    ...base,
    schemaVersion: DATA_SCHEMA_VERSION,
    revision: nonNegativeInteger(safeInput.revision, 0),
    groups,
    subjects,
    profiles,
    history: Array.isArray(safeInput.history) ? safeInput.history : [],
    migration: {
      ...base.migration,
      ...asRecord(safeInput.migration),
      ...(Object.keys(legacySubjectGroupAssignments).length
        ? { deprecatedSubjectGroupAssignments: legacySubjectGroupAssignments }
        : {})
    },
    metadata: {
      ...base.metadata,
      ...safeMetadata,
      moduleVersion: MODULE_VERSION,
      createdAt: finiteTimestamp(safeMetadata.createdAt, base.metadata.createdAt),
      updatedAt: finiteTimestamp(safeMetadata.updatedAt, base.metadata.updatedAt)
    }
  };
}
