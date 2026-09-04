import { SCORE, SPECIAL_STATE } from "../constants.js";
import { normalizeRelationship } from "./score.js";

export const DUAL_SYNC_PRESENTATION = Object.freeze({
  state: SPECIAL_STATE.DUAL_SYNC,
  label: "DUPLO//SINC",
  compactLabel: "DUPLO//SINC",
  accent: "#F0EAE0",
  secondary: "#27F3FF",
  tertiary: "#FF2BD6",
  expandedSlots: Object.freeze([SCORE.BASE_MAX + 1, SCORE.BASE_MAX + 2]),
  sigilAsset: "modules/gms-reputation/assets/icons/dual-sync-sigil.svg"
});

/**
 * DUPLO//SINC nunca é persistido. Ele existe somente quando Comunhão + Vínculo
 * estão simultaneamente ativos na Relationship canônica.
 */
export function getDualSyncState(relationship = {}) {
  const normalized = normalizeRelationship(relationship);
  const active = Boolean(normalized.communion && normalized.bond);
  return Object.freeze({
    active,
    ...DUAL_SYNC_PRESENTATION
  });
}
