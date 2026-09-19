import { SCORE, SPECIAL_STATE } from "../constants.js";
import { getRelationshipDerivedState } from "../domain/score.js";
import { getSemanticBand } from "../domain/semantic-bands.js";
import { getSpecialPresentation } from "../domain/specials.js";

function specialSlotPalette(specialState, ordinal, bandAccent) {
  if (ordinal <= SCORE.BASE_MAX) {
    return { accent: bandAccent, secondaryAccent: bandAccent, specialKind: null };
  }

  if (specialState.state === SPECIAL_STATE.COMMUNION) {
    return {
      accent: specialState.accent,
      secondaryAccent: specialState.secondary,
      specialKind: SPECIAL_STATE.COMMUNION
    };
  }

  if (specialState.state === SPECIAL_STATE.BOND) {
    return {
      accent: specialState.heartAccent ?? specialState.accent,
      secondaryAccent: specialState.secondary,
      specialKind: SPECIAL_STATE.BOND
    };
  }

  if (specialState.state === SPECIAL_STATE.DUAL_SYNC) {
    return ordinal === SCORE.BASE_MAX + 1
      ? { accent: specialState.secondary, secondaryAccent: specialState.accent, specialKind: SPECIAL_STATE.DUAL_SYNC }
      : { accent: specialState.tertiary, secondaryAccent: specialState.accent, specialKind: SPECIAL_STATE.DUAL_SYNC };
  }

  return { accent: bandAccent, secondaryAccent: bandAccent, specialKind: null };
}

export function buildHeartTrackModel(relationship = {}) {
  const derived = getRelationshipDerivedState(relationship);
  const band = getSemanticBand(derived.score, derived);
  const special = getSpecialPresentation(derived);
  const magnitude = Math.abs(derived.score);
  const fullCount = Math.floor(magnitude);
  const hasHalf = magnitude - fullCount >= SCORE.STEP;

  const slots = Array.from({ length: derived.scoreLimit }, (_, index) => {
    const ordinal = index + 1;
    const state = index < fullCount
      ? "full"
      : index === fullCount && hasHalf
        ? "half"
        : "empty";
    const specialSlot = ordinal > SCORE.BASE_MAX;
    const palette = specialSlotPalette(special, ordinal, band.accent);

    return Object.freeze({
      index,
      ordinal,
      state,
      specialSlot,
      ...palette
    });
  });

  const scoreText = Number.isInteger(derived.score) ? String(derived.score) : String(derived.score).replace(".", ",");
  return Object.freeze({
    score: derived.score,
    scoreText,
    accessibleLabel: `Reputação ${scoreText} de ${derived.scoreLimit}`,
    limit: derived.scoreLimit,
    polarity: band.polarity,
    bandId: band.id,
    baseAccent: band.accent,
    specialState: special.state,
    slots: Object.freeze(slots)
  });
}
