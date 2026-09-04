import { SCORE, SPECIAL_STATE } from "../constants.js";
import { normalizeRelationship } from "./score.js";

export const BOND_PRESENTATION = Object.freeze({
  state: SPECIAL_STATE.BOND,
  label: "VÍNCULO",
  compactLabel: "VÍNCULO",
  accent: "#D7A45A",
  secondary: "#FFBD75",
  heartAccent: "#D7A45A",
  expandedSlots: Object.freeze([SCORE.BASE_MAX + 1, SCORE.BASE_MAX + 2]),
  sigilAsset: "modules/gms-reputation/assets/icons/bond-sigil.svg"
});

/**
 * Vínculo é persistido apenas como relationship.bond.
 * Todo o restante abaixo é apresentação/regra derivada.
 */
export function getBondState(relationship = {}) {
  const normalized = normalizeRelationship(relationship);
  return Object.freeze({
    active: normalized.bond,
    ...BOND_PRESENTATION
  });
}
