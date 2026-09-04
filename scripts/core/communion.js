import { SCORE, SPECIAL_STATE } from "../constants.js";
import { normalizeRelationship } from "./score.js";

export const COMMUNION_PRESENTATION = Object.freeze({
  state: SPECIAL_STATE.COMMUNION,
  label: "COMUNHÃO",
  compactLabel: "COMUNHÃO",
  accent: "#27F3FF",
  secondary: "#8B5CF6",
  heartAccent: "#27F3FF",
  heartSecondary: "#8B5CF6",
  expandedSlots: Object.freeze([SCORE.BASE_MAX + 1, SCORE.BASE_MAX + 2]),
  sigilAsset: "modules/gms-reputation/assets/icons/communion-sigil.svg"
});

/**
 * Comunhão é persistida apenas como relationship.communion.
 * Cor, sigilo, slots especiais e nomenclatura são sempre derivados.
 */
export function getCommunionState(relationship = {}) {
  const normalized = normalizeRelationship(relationship);
  return Object.freeze({
    active: normalized.communion,
    ...COMMUNION_PRESENTATION
  });
}
