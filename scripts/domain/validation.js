/**
 * Validações de domínio puras para o GMS Reputation.
 */

export function assertValidId(id, fieldName = "ID") {
  const normalized = String(id ?? "").trim();
  if (!normalized) throw new Error(`${fieldName} é obrigatório.`);
  if (normalized.length > 128) throw new Error(`${fieldName} excede o limite de 128 caracteres.`);
  return normalized;
}

export function sanitizeText(value, maxLength = 240, fallback = "") {
  if (value == null) return fallback;
  return String(value).trim().slice(0, maxLength) || fallback;
}

export function sanitizeMultilineText(value, maxLength = 12000) {
  if (value == null) return "";
  return String(value).replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
}

export function finiteTimestamp(value, fallback = Date.now()) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

export function nonNegativeInteger(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : fallback;
}
