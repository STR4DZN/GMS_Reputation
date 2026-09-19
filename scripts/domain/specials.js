import { SCORE, SPECIAL_STATE } from "../constants.js";
import { deriveSpecialState, normalizeRelationship } from "./score.js";

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

export const COMMUNION_PRESENTATION = Object.freeze({
  state: SPECIAL_STATE.COMMUNION,
  label: "COMUNHÃO",
  compactLabel: "COMUNHÃO",
  accent: "#4BC7FF",
  secondary: "#B266FF",
  heartAccent: "#4BC7FF",
  expandedSlots: Object.freeze([SCORE.BASE_MAX + 1, SCORE.BASE_MAX + 2]),
  sigilAsset: "modules/gms-reputation/assets/icons/communion-sigil.svg"
});

export const DUAL_SYNC_PRESENTATION = Object.freeze({
  state: SPECIAL_STATE.DUAL_SYNC,
  label: "DUPLO//SINC",
  compactLabel: "DUPLO//SINC",
  accent: "#FFFFFF",
  secondary: "#4BC7FF",
  tertiary: "#FF2A6D",
  heartAccent: "#4BC7FF",
  expandedSlots: Object.freeze([SCORE.BASE_MAX + 1, SCORE.BASE_MAX + 2]),
  sigilAsset: "modules/gms-reputation/assets/icons/dual-sync-sigil.svg"
});

export const STANDARD_PRESENTATION = Object.freeze({
  active: false,
  state: SPECIAL_STATE.STANDARD,
  label: "",
  compactLabel: "",
  accent: null,
  secondary: null,
  tertiary: null,
  heartAccent: null,
  expandedSlots: Object.freeze([]),
  sigilAsset: null
});

export function getBondState(relationship = {}) {
  const normalized = normalizeRelationship(relationship);
  return Object.freeze({
    active: normalized.bond,
    ...BOND_PRESENTATION
  });
}

export function getCommunionState(relationship = {}) {
  const normalized = normalizeRelationship(relationship);
  return Object.freeze({
    active: normalized.communion,
    ...COMMUNION_PRESENTATION
  });
}

export function getDualSyncState(relationship = {}) {
  const normalized = normalizeRelationship(relationship);
  const active = Boolean(normalized.communion && normalized.bond);
  return Object.freeze({
    active,
    ...DUAL_SYNC_PRESENTATION
  });
}

export function getSpecialPresentation(relationship = {}) {
  const normalized = normalizeRelationship(relationship);
  const state = deriveSpecialState(normalized);
  if (state === SPECIAL_STATE.DUAL_SYNC) return getDualSyncState(normalized);
  if (state === SPECIAL_STATE.COMMUNION) return getCommunionState(normalized);
  if (state === SPECIAL_STATE.BOND) return getBondState(normalized);
  return STANDARD_PRESENTATION;
}
