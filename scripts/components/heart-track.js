import { SCORE, SPECIAL_STATE } from "../constants.js";
import { getRelationshipDerivedState } from "../core/score.js";
import { getSemanticBand } from "../core/semantic-bands.js";
import { getSpecialPresentation } from "../core/special-presentation.js";

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
    // Convergência fica legível sem uma terceira barra: slot 11 = ciano,
    // slot 12 = magenta; branco permanece como acento secundário comum.
    return ordinal === SCORE.BASE_MAX + 1
      ? { accent: specialState.secondary, secondaryAccent: specialState.accent, specialKind: SPECIAL_STATE.DUAL_SYNC }
      : { accent: specialState.tertiary, secondaryAccent: specialState.accent, specialKind: SPECIAL_STATE.DUAL_SYNC };
  }

  return { accent: bandAccent, secondaryAccent: bandAccent, specialKind: null };
}

/**
 * Componente canônico de corações — único modelo usado por Mestre e Player.
 * Nenhum estado de slot é persistido: tudo nasce do score e dos dois booleanos especiais.
 */
export function buildHeartTrackModel(relationship = {}) {
  const derived = getRelationshipDerivedState(relationship);
  const band = getSemanticBand(derived.score, derived);
  const special = getSpecialPresentation(derived);
  const magnitude = Math.abs(derived.score);
  const fullCount = Math.floor(magnitude);
  const hasHalf = magnitude - fullCount >= SCORE.STEP;

  const slots = Array.from({ length: derived.scoreLimit }, (_unused, index) => {
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
    fullCount,
    hasHalf,
    baseAccent: band.accent,
    specialState: special.state,
    slots: Object.freeze(slots)
  });
}

function escapeAttribute(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

/**
 * Renderizador estrutural sem estilos inline e sem animações permanentes.
 * A folha de estilo adapta automaticamente 10/12 slots à largura disponível.
 */
export function renderHeartTrackHTML(modelOrRelationship = {}, { className = "" } = {}) {
  const model = Array.isArray(modelOrRelationship?.slots)
    ? modelOrRelationship
    : buildHeartTrackModel(modelOrRelationship);
  const safeExtraClass = String(className).replace(/[^\w\-\s]/g, "").trim();
  const classes = [
    "gms-reputation-heart-track",
    safeExtraClass,
    `gms-reputation-heart-track--${model.limit}`,
    `is-${model.polarity}`,
    `is-band-${model.bandId}`,
    `is-special-${model.specialState}`
  ].filter(Boolean).join(" ");

  const slotHTML = model.slots.map((slot) => {
    const specialClass = slot.specialKind ? ` is-${slot.specialKind}` : "";
    return `<span class="gms-reputation-heart${specialClass}" data-heart-state="${slot.state}" data-special-slot="${slot.specialSlot}" data-heart-ordinal="${slot.ordinal}" aria-hidden="true"><i></i></span>`;
  }).join("");

  const scoreLabel = Number.isInteger(model.score) ? String(model.score) : String(model.score).replace(".", ",");
  return `<span class="${classes}" data-heart-limit="${model.limit}" data-heart-band="${escapeAttribute(model.bandId)}" data-special-state="${escapeAttribute(model.specialState)}" role="img" aria-label="Reputação ${escapeAttribute(scoreLabel)} de ${model.limit}">${slotHTML}</span>`;
}
