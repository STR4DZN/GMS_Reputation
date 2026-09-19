import { assertValidId, sanitizeText, sanitizeMultilineText, finiteTimestamp } from "./validation.js";
import { normalizePortrait } from "./portraits.js";
import { normalizeRelationship } from "./score.js";

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
  const profileId = assertValidId(id, "Profile id");
  const now = Date.now();
  const profileName = sanitizeText(name, 240, "Perfil sem nome");
  const focalName = sanitizeText(focal?.name ?? profileName, 240, profileName);

  const normalizedRelationships = {};
  if (relationships && typeof relationships === "object") {
    for (const subjectId in relationships) {
      if (Object.prototype.hasOwnProperty.call(relationships, subjectId)) {
        normalizedRelationships[subjectId] = {
          subjectId: String(subjectId),
          ...normalizeRelationship(relationships[subjectId])
        };
      }
    }
  }

  const normalizedSubjectIds = Array.isArray(subjectIds)
    ? [...new Set(subjectIds.map((v) => String(v ?? "").trim()).filter(Boolean))]
    : Object.keys(normalizedRelationships);

  return Object.freeze({
    id: profileId,
    name: profileName,
    groupId: groupId == null || groupId === "" || groupId === "__ungrouped__" ? null : String(groupId),
    source: Object.freeze({
      journalUuid: source?.journalUuid ? String(source.journalUuid) : null,
      pageId: source?.pageId ? String(source.pageId) : null,
      pageUuid: source?.pageUuid ? String(source.pageUuid) : null
    }),
    focal: Object.freeze({
      name: focalName,
      portrait: normalizePortrait(focal?.portrait),
      description: sanitizeMultilineText(focal?.description, 12000)
    }),
    relationships: Object.freeze(normalizedRelationships),
    subjectIds: Object.freeze(normalizedSubjectIds),
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

export function activeProfiles(state = {}) {
  return Object.values(state.profiles ?? {})
    .filter((profile) => profile.active !== false && !profile.archived)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name), "pt-BR"));
}

export function activeGroups(state = {}) {
  return Object.values(state.groups ?? {})
    .filter((group) => group.active !== false && !group.archived)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name), "pt-BR"));
}

export function resolveProfile(state = {}, requestedId = "") {
  const available = activeProfiles(state);
  const requested = available.find((p) => p.id === String(requestedId));
  return requested ?? available[0] ?? null;
}
