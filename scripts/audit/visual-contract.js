export const VISUAL_GENERATION = 3;
export const VISUAL_AUTHORITY_STYLE = "styles/gms-reputation-59.10.css";
export const VISUAL_REQUIRED_STYLES = Object.freeze([VISUAL_AUTHORITY_STYLE]);

export const VISUAL_SURFACES = Object.freeze({
  PLAYER_DASHBOARD: "player-dashboard",
  PLAYER_CARD: "player-card",
  HEARTS_SPECIALS: "hearts-specials",
  FOCAL_DETAIL: "focal-detail",
  SUBJECT_DETAIL: "subject-detail",
  MASTER_DECK: "master-deck",
  MASTER_EDITORS: "master-editors"
});

export const VISUAL_READING_ORDER = Object.freeze([
  "portrait",
  "identity",
  "relationship",
  "hearts",
  "score",
  "special"
]);

export const VISUAL_STYLE_PILLARS = Object.freeze([
  "gothic-tech",
  "acid-y2k",
  "lancer-sci-fi",
  "dark-glass",
  "neon-minimal",
  "quick-read",
  "full-motion",
  "botanical-vector"
]);

export const VISUAL_FORBIDDEN_PATTERNS = Object.freeze([
  "persistent-scanline-over-portraits",
  "infinite-card-glitch",
  "thick-left-reputation-rail",
  "fake-telemetry-before-primary-content",
  "external-texture-dependency",
  "performance-motion-veto"
]);

/** Contrato 59.10: uma única autoridade visual declarada no manifesto. */
export function auditVisualManifest(moduleJson = {}) {
  const styles = Array.isArray(moduleJson.styles) ? moduleJson.styles : [];
  const missingStyles = VISUAL_REQUIRED_STYLES.filter((path) => !styles.includes(path));
  const unexpectedStyles = styles.filter((path) => path !== VISUAL_AUTHORITY_STYLE);
  return Object.freeze({
    ok: missingStyles.length === 0 && unexpectedStyles.length === 0 && styles.length === 1,
    missingStyles: Object.freeze(missingStyles),
    unexpectedStyles: Object.freeze(unexpectedStyles),
    authorityStyle: VISUAL_AUTHORITY_STYLE,
    visualGeneration: VISUAL_GENERATION
  });
}

export function auditPlayerCardReadingOrder(readingOrder) {
  const normalized = String(readingOrder ?? "").trim().split(/\s+/).filter(Boolean);
  return Object.freeze({
    ok: normalized.join(" ") === VISUAL_READING_ORDER.join(" "),
    actual: Object.freeze(normalized),
    expected: VISUAL_READING_ORDER
  });
}
