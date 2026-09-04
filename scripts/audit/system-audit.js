import { DATA_SCHEMA_VERSION, MODULE_VERSION } from "../constants.js";
import { normalizePortrait, portraitEquals } from "../core/portrait.js";
import { clampScore, deriveSpecialState, getScoreLimit, normalizeRelationship } from "../core/score.js";
import { normalizeWorldState } from "../data/schema.js";

function finding(severity, code, message, context = {}) {
  return Object.freeze({ severity, code, message, context: Object.freeze({ ...context }) });
}

/** BLOCO 39 — auditoria de integridade do estado, sem mutação. */
export function auditWorldState(input = {}) {
  const raw = input && typeof input === "object" ? input : {};
  const state = normalizeWorldState(raw);
  const findings = [];
  const groupIds = Object.keys(state.groups ?? {});
  const groupSet = new Set(groupIds);
  const subjectIds = Object.keys(state.subjects);
  const subjectSet = new Set(subjectIds);

  if (Number(raw.schemaVersion ?? DATA_SCHEMA_VERSION) !== DATA_SCHEMA_VERSION) {
    findings.push(finding("warning", "SCHEMA_NORMALIZED", `Schema recebido foi normalizado para v${DATA_SCHEMA_VERSION}.`, { received: raw.schemaVersion ?? null }));
  }

  for (const [subjectId, subject] of Object.entries(state.subjects)) {
    if (!String(subject.realName || subject.alias || "").trim()) {
      findings.push(finding("warning", "SUBJECT_UNNAMED", "Personagem sem nome real e sem apelido.", { subjectId }));
    }
    const rawPortrait = raw.subjects?.[subjectId]?.portrait ?? subject.portrait;
    if (!portraitEquals(rawPortrait, normalizePortrait(rawPortrait))) {
      findings.push(finding("warning", "PORTRAIT_NORMALIZED", "Enquadramento de retrato precisava de normalização.", { subjectId }));
    }
  }

  for (const [profileId, profile] of Object.entries(state.profiles)) {
    if (profile.groupId && !groupSet.has(String(profile.groupId))) {
      findings.push(finding("warning", "PROFILE_GROUP_ORPHAN", "Perfil aponta para grupo inexistente.", { profileId, groupId: profile.groupId }));
    }
    const rawProfile = raw.profiles?.[profileId] ?? {};
    const rosterIds = Array.isArray(profile.subjectIds) ? profile.subjectIds.map(String) : [];
    if (new Set(rosterIds).size !== rosterIds.length) {
      findings.push(finding("error", "PROFILE_ROSTER_DUPLICATE", "Perfil contém personagem duplicado no roster visível.", { profileId }));
    }
    for (const subjectId of rosterIds) {
      if (!subjectSet.has(subjectId)) {
        findings.push(finding("error", "PROFILE_ROSTER_ORPHAN", "Roster do Perfil aponta para Subject inexistente.", { profileId, subjectId }));
      }
      if (!Object.hasOwn(profile.relationships ?? {}, subjectId)) {
        findings.push(finding("error", "PROFILE_ROSTER_RELATIONSHIP_MISSING", "Personagem visível no Perfil não possui Relationship correspondente.", { profileId, subjectId }));
      }
    }
    for (const subjectId of subjectIds) {
      if (!Object.hasOwn(rawProfile.relationships ?? {}, subjectId)) {
        findings.push(finding("error", "RELATIONSHIP_MISSING", "Profile não possui Relationship explícita para um Subject.", { profileId, subjectId }));
      }
    }
    for (const [subjectId, rawRelationship] of Object.entries(rawProfile.relationships ?? {})) {
      if (!subjectSet.has(subjectId)) {
        findings.push(finding("error", "RELATIONSHIP_ORPHAN", "Relationship aponta para Subject inexistente.", { profileId, subjectId }));
        continue;
      }
      const normalized = normalizeRelationship(rawRelationship);
      const expectedScore = clampScore(rawRelationship?.score, normalized);
      if (Number(rawRelationship?.score) !== expectedScore) {
        findings.push(finding("warning", "SCORE_NORMALIZED", "Score fora do passo/limite canônico.", { profileId, subjectId, received: rawRelationship?.score, normalized: expectedScore }));
      }
      if (Object.hasOwn(rawRelationship ?? {}, "dualSync") || Object.hasOwn(rawRelationship ?? {}, "specialState") || Object.hasOwn(rawRelationship ?? {}, "scoreLimit")) {
        findings.push(finding("error", "DERIVED_FIELD_PERSISTED", "Relationship contém campo derivado que não deve ser persistido.", { profileId, subjectId }));
      }
      // Exercita as derivações centrais e garante que não produzam estado impossível.
      const specialState = deriveSpecialState(normalized);
      const limit = getScoreLimit(normalized);
      if (normalized.score > limit) findings.push(finding("error", "SCORE_LIMIT_CONFLICT", "Score excede o limite derivado.", { profileId, subjectId, specialState, limit }));
    }
  }

  for (const event of state.history ?? []) {
    if (event?.subjectId && !subjectSet.has(String(event.subjectId))) {
      findings.push(finding("info", "HISTORY_SUBJECT_MISSING", "Histórico referencia Subject removido/ausente; evento foi preservado para auditoria.", { eventId: event.id, subjectId: event.subjectId }));
    }
    if (event?.profileId && !state.profiles?.[String(event.profileId)]) {
      findings.push(finding("info", "HISTORY_PROFILE_MISSING", "Histórico referencia Profile removido/ausente; evento foi preservado para auditoria.", { eventId: event.id, profileId: event.profileId }));
    }
  }

  const errors = findings.filter((entry) => entry.severity === "error").length;
  const warnings = findings.filter((entry) => entry.severity === "warning").length;
  return Object.freeze({
    ok: errors === 0,
    moduleVersion: MODULE_VERSION,
    schemaVersion: DATA_SCHEMA_VERSION,
    revision: state.revision,
    counts: Object.freeze({ groups: groupIds.length, subjects: subjectIds.length, profiles: Object.keys(state.profiles).length, history: state.history.length, errors, warnings }),
    findings: Object.freeze(findings)
  });
}

export function auditRuntimeEnvironment({ foundryVersion = globalThis.game?.version ?? globalThis.game?.release?.version ?? "" } = {}) {
  const version = String(foundryVersion || "");
  const major = Number(version.split(".")[0]);
  const findings = [];
  if (Number.isFinite(major) && major !== 13) findings.push(finding("warning", "FOUNDRY_VERSION_UNVERIFIED", "Este checkpoint foi verificado para Foundry VTT v13.", { version }));
  return Object.freeze({ ok: !findings.some((entry) => entry.severity === "error"), foundryVersion: version || null, findings: Object.freeze(findings) });
}

export function runSystemAudit({ state, foundryVersion } = {}) {
  const data = auditWorldState(state ?? {});
  const runtime = auditRuntimeEnvironment({ foundryVersion });
  return Object.freeze({ ok: data.ok && runtime.ok, data, runtime });
}
