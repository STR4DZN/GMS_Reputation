import { SCORE } from "../constants.js";
import { clampScore, getScoreLimit } from "./score.js";

/**
 * Bloco 08 — faixas semânticas canônicas.
 * A ordem é deliberada e os limites trabalham apenas em passos válidos de 0,5.
 * Nenhuma UI deve reimplementar estas faixas localmente.
 */
export const RELATION_BAND = Object.freeze({
  HOSTILE: "hostile",
  CAUTION: "caution",
  NEUTRAL: "neutral",
  CONTACT: "contact",
  TRUSTED: "trusted",
  ALLY: "ally",
  EXTREME: "extreme"
});

const BAND_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: RELATION_BAND.HOSTILE,
    min: SCORE.MIN,
    max: -7,
    label: "Rivalidade",
    code: "HOSTIL",
    tone: "hostile",
    accent: "#FF304F",
    secondary: "#8F1228"
  }),
  Object.freeze({
    id: RELATION_BAND.CAUTION,
    min: -6.5,
    max: -0.5,
    label: "Desconfiança",
    code: "CAUTELA",
    tone: "caution",
    accent: "#FFB51B",
    secondary: "#7C4B00"
  }),
  Object.freeze({
    id: RELATION_BAND.NEUTRAL,
    min: 0,
    max: 0,
    label: "Desconhecido",
    code: "NEUTRO",
    tone: "neutral",
    accent: "#9AA8B3",
    secondary: "#4F5E69"
  }),
  Object.freeze({
    id: RELATION_BAND.CONTACT,
    min: 0.5,
    max: 3,
    label: "Conhecido",
    code: "CONTATO",
    tone: "contact",
    accent: "#4BC7FF",
    secondary: "#155A83"
  }),
  Object.freeze({
    id: RELATION_BAND.TRUSTED,
    min: 3.5,
    max: 6,
    label: "Confiança",
    code: "CONFIANÇA",
    tone: "trusted",
    accent: "#7DFF9B",
    secondary: "#247A43"
  }),
  Object.freeze({
    id: RELATION_BAND.ALLY,
    min: 6.5,
    max: 9,
    label: "Grande amizade",
    code: "ALIANÇA",
    tone: "ally",
    accent: "#28F0D0",
    secondary: "#126D61"
  }),
  Object.freeze({
    id: RELATION_BAND.EXTREME,
    min: 9.5,
    max: SCORE.EXPANDED_MAX,
    label: "Laço inquebrável",
    code: "EXTREMO",
    tone: "extreme",
    accent: "#FF375F",
    secondary: "#7A1632"
  })
]);

export function listSemanticBands() {
  return BAND_DEFINITIONS;
}

export function getRelationshipPolarity(value, special = {}) {
  const score = clampScore(value, special);
  return score < 0 ? "negative" : score > 0 ? "positive" : "neutral";
}

export function getSemanticBand(value, special = {}) {
  const score = clampScore(value, special);
  const band = BAND_DEFINITIONS.find((entry) => score >= entry.min && score <= entry.max);
  // Guard rail: valid normalized scores must always resolve to one band.
  if (!band) throw new Error(`No semantic reputation band for score ${score}.`);
  return Object.freeze({
    ...band,
    score,
    scoreLimit: getScoreLimit(special),
    polarity: getRelationshipPolarity(score, special)
  });
}
