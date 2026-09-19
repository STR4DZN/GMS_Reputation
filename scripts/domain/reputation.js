import { clampScore, getRelationshipDerivedState } from "./score.js";
import { getSemanticBand } from "./semantic-bands.js";
import { getSpecialPresentation } from "./specials.js";

/**
 * Deriva a visão completa e pura de uma relação entre Perfil e Personagem.
 * Não conhece Foundry, UI ou DOM.
 */
export function deriveRelationshipView(relationship = {}) {
  const derived = getRelationshipDerivedState(relationship);
  const band = getSemanticBand(derived.score, derived);
  const special = getSpecialPresentation(derived);

  return Object.freeze({
    score: derived.score,
    scoreLimit: derived.scoreLimit,
    scoreFormatted: Number.isInteger(derived.score) ? String(derived.score) : String(derived.score).replace(".", ","),
    band,
    special,
    polarity: band.polarity,
    note: derived.note,
    revision: derived.revision,
    updatedAt: derived.updatedAt,
    updatedBy: derived.updatedBy
  });
}
