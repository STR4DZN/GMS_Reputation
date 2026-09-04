import { SPECIAL_STATE } from "../constants.js";
import { deriveSpecialState, normalizeRelationship } from "./score.js";
import { getBondState } from "./bond.js";
import { getCommunionState } from "./communion.js";
import { getDualSyncState } from "./dual-sync.js";

export const STANDARD_PRESENTATION = Object.freeze({
  active: false,
  state: SPECIAL_STATE.STANDARD,
  label: "",
  compactLabel: "",
  accent: null,
  secondary: null,
  tertiary: null,
  expandedSlots: Object.freeze([]),
  sigilAsset: null
});

/**
 * Único resolvedor de apresentação especial para todas as interfaces.
 * A precedência é derivada e impossível de contradizer:
 * DUPLO//SINC > COMUNHÃO > VÍNCULO > STANDARD.
 */
export function getSpecialPresentation(relationship = {}) {
  const normalized = normalizeRelationship(relationship);
  const state = deriveSpecialState(normalized);
  if (state === SPECIAL_STATE.DUAL_SYNC) return getDualSyncState(normalized);
  if (state === SPECIAL_STATE.COMMUNION) return getCommunionState(normalized);
  if (state === SPECIAL_STATE.BOND) return getBondState(normalized);
  return STANDARD_PRESENTATION;
}
