import { assertValidId, sanitizeText, sanitizeMultilineText, finiteTimestamp } from "./validation.js";
import { normalizePortrait } from "./portraits.js";

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
  const subjectId = assertValidId(id, "Subject id");
  const now = Date.now();
  const safeRealName = sanitizeText(realName, 160);
  const safeAlias = sanitizeText(alias, 160);

  return Object.freeze({
    id: subjectId,
    realName: safeRealName,
    alias: safeAlias,
    description: sanitizeMultilineText(description, 12000),
    portrait: normalizePortrait(portrait),
    active: Boolean(active),
    archived: Boolean(archived),
    sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    metadata: Object.freeze({
      ...(metadata || {}),
      legacyNames: Array.isArray(metadata?.legacyNames) ? [...new Set(metadata.legacyNames.map(String))] : [],
      tags: Array.isArray(metadata?.tags) ? [...new Set(metadata.tags.map(String))] : [],
      createdAt: finiteTimestamp(metadata?.createdAt, now),
      updatedAt: finiteTimestamp(metadata?.updatedAt, now)
    })
  });
}

export function activeSubjects(state = {}) {
  return Object.values(state.subjects ?? {})
    .filter((s) => s.active !== false && !s.archived)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.realName || a.alias).localeCompare(String(b.realName || b.alias), "pt-BR"));
}

export function resolveSubjectDisplayName(subject = {}) {
  const alias = String(subject.alias ?? "").trim();
  const realName = String(subject.realName ?? "").trim();
  if (alias && realName && alias !== realName) return `${alias} (${realName})`;
  return alias || realName || "Sem identificação";
}
