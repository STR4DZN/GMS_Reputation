import { SCORE, SPECIAL_STATE } from "../constants.js";

/**
 * Domínio puro de pontuação de reputação.
 * Independente de Foundry, DOM ou Hooks.
 */
export function hasExpandedLimit(special = {}) {
  const source = special && typeof special === "object" ? special : {};
  return Boolean(source.communion || source.bond);
}

export function getScoreLimit(special = {}) {
  return hasExpandedLimit(special) ? SCORE.EXPANDED_MAX : SCORE.BASE_MAX;
}

export function deriveSpecialLimits(bond, communion) {
  const special = typeof bond === "object" ? bond : { bond, communion };
  const hasExpanded = hasExpandedLimit(special);
  return {
    min: SCORE.MIN,
    max: hasExpanded ? SCORE.EXPANDED_MAX : SCORE.BASE_MAX,
    bond: Boolean(special.bond),
    communion: Boolean(special.communion)
  };
}

export function clampScore(value, special = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  let max = SCORE.BASE_MAX;
  if (typeof special === "number") {
    max = special;
  } else if (Number.isFinite(Number(special?.max))) {
    max = Number(special.max);
  } else if (hasExpandedLimit(special)) {
    max = SCORE.EXPANDED_MAX;
  }
  const min = Number.isFinite(Number(special?.min)) ? Number(special.min) : SCORE.MIN;
  const rounded = Math.round(numeric * 2) * 0.5;
  if (rounded > max) return max;
  if (rounded < min) return min;
  return rounded === 0 ? 0 : rounded;
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
  const max = (communion || bond) ? SCORE.EXPANDED_MAX : SCORE.BASE_MAX;
  const numeric = Number(source.score);
  let score = 0;
  if (Number.isFinite(numeric)) {
    const rounded = Math.round(numeric * 2) * 0.5;
    score = rounded > max ? max : (rounded < SCORE.MIN ? SCORE.MIN : (rounded === 0 ? 0 : rounded));
  }
  return {
    score,
    communion,
    bond,
    note: source.note ? String(source.note).slice(0, 12000) : "",
    revision: source.revision ? Math.max(0, Math.trunc(Number(source.revision)) || 0) : 0,
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
