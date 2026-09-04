/**
 * BLOCO 16 — contrato de leitura rápida.
 * Esta ordem é deliberadamente estável e deve orientar Card, Dashboard e detalhe:
 * Retrato → Nome → Relação → Corações → Score → Especial.
 */
export const QUICK_READ_SEQUENCE = Object.freeze([
  "portrait",
  "identity",
  "relationship",
  "hearts",
  "score",
  "special"
]);

export const QUICK_READ_PRIORITY = Object.freeze({
  portrait: 1,
  identity: 2,
  relationship: 3,
  hearts: 4,
  score: 5,
  special: 6
});

export const CARD_PRIMARY_FIELDS = Object.freeze([
  "portrait",
  "identity",
  "relationship",
  "hearts",
  "score",
  "special"
]);

export const CARD_SECONDARY_FIELDS = Object.freeze([
  "descriptionPreview"
]);

export function getQuickReadContract() {
  return Object.freeze({
    sequence: QUICK_READ_SEQUENCE,
    priority: QUICK_READ_PRIORITY,
    primaryFields: CARD_PRIMARY_FIELDS,
    secondaryFields: CARD_SECONDARY_FIELDS,
    rules: Object.freeze({
      noRedundantCodes: true,
      noBiographyByDefault: true,
      noPermanentTelemetry: true,
      noColorOnlyMeaning: true,
      specialAfterScore: true
    })
  });
}
