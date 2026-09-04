import { SCORE, SPECIAL_STATE } from "../constants.js";
import { deriveSpecialState, getRelationshipDerivedState } from "./score.js";
import { getSemanticBand } from "./semantic-bands.js";
import { getBondState } from "./bond.js";
import { getCommunionState } from "./communion.js";
import { getDualSyncState } from "./dual-sync.js";
import { getSpecialPresentation } from "./special-presentation.js";
import { buildHeartTrackModel } from "../components/heart-track.js";

/**
 * Alias de compatibilidade: o motor expõe o mesmo componente canônico usado pelas UIs.
 */
export function buildHeartTrack(relationship = {}) {
  return buildHeartTrackModel(relationship);
}

/**
 * Snapshot único consumível por GM/Player UI.
 * Score, limite, faixa, polaridade, corações e estado especial saem da mesma Relationship.
 */
export function getReputationView(relationship = {}) {
  const derived = getRelationshipDerivedState(relationship);
  const band = getSemanticBand(derived.score, derived);
  const hearts = buildHeartTrackModel(derived);
  const specialState = deriveSpecialState(derived);
  const bond = getBondState(derived);
  const communion = getCommunionState(derived);
  const dualSync = getDualSyncState(derived);
  const presentation = getSpecialPresentation(derived);

  return Object.freeze({
    relationship: Object.freeze({ ...derived }),
    score: derived.score,
    scoreLimit: derived.scoreLimit,
    polarity: band.polarity,
    band,
    hearts,
    special: Object.freeze({
      state: specialState,
      hasExpandedLimit: derived.scoreLimit === SCORE.EXPANDED_MAX,
      presentation,
      communion,
      bond,
      dualSync,
      communionActive: communion.active,
      bondActive: bond.active,
      dualSyncActive: specialState === SPECIAL_STATE.DUAL_SYNC
    })
  });
}
