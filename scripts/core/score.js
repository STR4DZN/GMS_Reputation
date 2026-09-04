import { SCORE, SPECIAL_STATE } from "../constants.js";

export function hasExpandedLimit(special = {}) {
  const source = special && typeof special === "object" ? special : {};
  return Boolean(source.communion || source.bond);
}

export function getScoreLimit(special = {}) {
  return hasExpandedLimit(special) ? SCORE.EXPANDED_MAX : SCORE.BASE_MAX;
}

export function clampScore(value, special = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const rounded = Math.round(numeric / SCORE.STEP) * SCORE.STEP;
  const clamped = Math.min(getScoreLimit(special), Math.max(SCORE.MIN, rounded));
  return Object.is(clamped, -0) ? 0 : clamped;
}

export function deriveSpecialState(special = {}) {
  const source = special && typeof special === "object" ? special : {};
  const communion = Boolean(source.communion);
  const bond = Boolean(source.bond);
  if (communion && bond) return SPECIAL_STATE.DUAL_SYNC;
  if (communion) return SPECIAL_STATE.COMMUNION;
  if (bond) return SPECIAL_STATE.BOND;
  return SPECIAL_STATE.STANDARD;
}

export function normalizeRelationship(relationship = {}) {
  const source = relationship && typeof relationship === "object" ? relationship : {};
  const communion = Boolean(source.communion);
  const bond = Boolean(source.bond);
  return {
    score: clampScore(source.score, { communion, bond }),
    communion,
    bond,
    note: String(source.note ?? "").slice(0, 12000),
    revision: Math.max(0, Math.trunc(Number(source.revision) || 0)),
    updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : 0,
    updatedBy: source.updatedBy ? String(source.updatedBy) : null
  };
}

export function getRelationshipDerivedState(relationship = {}) {
  const normalized = normalizeRelationship(relationship);
  return Object.freeze({
    ...normalized,
    scoreLimit: getScoreLimit(normalized),
    specialState: deriveSpecialState(normalized)
  });
}
