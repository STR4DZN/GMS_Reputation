export const SUPPORTED_PORTRAIT_EXTENSIONS = Object.freeze([
  "apng", "avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"
]);

export const PORTRAIT_RECOMMENDATIONS = Object.freeze({
  subject: Object.freeze({ width: 1024, height: 1024, bytes: 5 * 1024 * 1024, aspect: "1:1" }),
  focal: Object.freeze({ width: 1600, height: 900, bytes: 5 * 1024 * 1024, aspect: "16:9" })
});

function clampRange(value, minimum, maximum, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(numeric * 10) / 10));
}

export function emptyPortrait() {
  return { src: "", zoom: 100, x: 50, y: 50 };
}

export function normalizePortraitSource(value) {
  const source = String(value ?? "").trim();
  if (!source || /^(?:javascript|vbscript):/i.test(source)) return "";
  return source;
}

export function isSupportedPortraitSource(value) {
  const source = normalizePortraitSource(value);
  if (!source) return false;
  if (/^https?:\/\//i.test(source)) return true;
  if (/^(?:data:image\/|blob:)/i.test(source)) return true;
  const cleanSource = source.split(/[?#]/, 1)[0];
  return new RegExp(`\\.(?:${SUPPORTED_PORTRAIT_EXTENSIONS.join("|")})$`, "i").test(cleanSource);
}

export function portraitSourceMeta(value) {
  const source = normalizePortraitSource(value);
  if (!source) return Object.freeze({
    source: "",
    origin: "none",
    format: null,
    animated: false,
    remote: false,
    supported: false
  });

  const remote = /^https?:\/\//i.test(source);
  const dataImage = /^data:image\//i.test(source);
  const blob = /^blob:/i.test(source);
  const cleanSource = source.split(/[?#]/, 1)[0];
  const extension = cleanSource.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "";
  const supportedExtension = SUPPORTED_PORTRAIT_EXTENSIONS.includes(extension);
  const format = supportedExtension ? extension.toUpperCase() : dataImage ? "DATA" : blob ? "BLOB" : remote ? "REMOTE" : "FILE";

  return Object.freeze({
    source,
    origin: remote ? "remote" : dataImage ? "data" : blob ? "blob" : "foundry",
    format,
    animated: extension === "gif" || extension === "apng",
    remote,
    supported: isSupportedPortraitSource(source)
  });
}

export function normalizePortrait(value = {}) {
  return Object.freeze({
    src: normalizePortraitSource(value?.src),
    zoom: clampRange(value?.zoom, 50, 300, 100),
    x: clampRange(value?.x, 0, 100, 50),
    y: clampRange(value?.y, 0, 100, 50)
  });
}

export function portraitEquals(left, right) {
  const a = normalizePortrait(left);
  const b = normalizePortrait(right);
  return a.src === b.src && a.zoom === b.zoom && a.x === b.x && a.y === b.y;
}

export function resetPortraitFrame(portrait = {}) {
  const normalized = normalizePortrait(portrait);
  return normalizePortrait({ src: normalized.src, zoom: 100, x: 50, y: 50 });
}

export function removePortrait() {
  return emptyPortrait();
}

export function adjustPortraitFrame(portrait = {}, patch = {}) {
  const current = normalizePortrait(portrait);
  return normalizePortrait({
    src: patch.src === undefined ? current.src : patch.src,
    zoom: patch.zoom === undefined ? current.zoom : patch.zoom,
    x: patch.x === undefined ? current.x : patch.x,
    y: patch.y === undefined ? current.y : patch.y
  });
}

export function nudgePortraitFrame(portrait = {}, { x = 0, y = 0, zoom = 0 } = {}) {
  const current = normalizePortrait(portrait);
  return normalizePortrait({
    ...current,
    zoom: current.zoom + Number(zoom || 0),
    x: current.x + Number(x || 0),
    y: current.y + Number(y || 0)
  });
}

/**
 * Converte deslocamento de ponteiro em alteração percentual do enquadramento.
 * A semântica replica a macro: arrastar a imagem para a direita desloca o foco X para a esquerda.
 */
export function dragPortraitFrame(portrait = {}, {
  deltaX = 0,
  deltaY = 0,
  viewportWidth = 1,
  viewportHeight = 1
} = {}) {
  const current = normalizePortrait(portrait);
  const base = Math.max(1, Math.min(Number(viewportWidth) || 1, Number(viewportHeight) || 1));
  const sensitivity = 100 / base;
  return normalizePortrait({
    ...current,
    x: current.x - (Number(deltaX) || 0) * sensitivity,
    y: current.y - (Number(deltaY) || 0) * sensitivity
  });
}

export function getPortraitFitMode(portrait = {}) {
  return normalizePortrait(portrait).zoom < 100 ? "contain" : "cover";
}

/**
 * Soft advisory only. These are QoL recommendations, never validation gates.
 */
export function getPortraitAdvisory({ kind = "subject", width = null, height = null, bytes = null } = {}) {
  const key = kind === "focal" ? "focal" : "subject";
  const recommendation = PORTRAIT_RECOMMENDATIONS[key];
  const warnings = [];
  const numericWidth = Number(width);
  const numericHeight = Number(height);
  const numericBytes = Number(bytes);

  if (Number.isFinite(numericWidth) && Number.isFinite(numericHeight)
      && (numericWidth > recommendation.width * 1.5 || numericHeight > recommendation.height * 1.5)) {
    warnings.push("dimensions-large");
  }
  if (Number.isFinite(numericBytes) && numericBytes > recommendation.bytes) warnings.push("file-large");

  return Object.freeze({
    kind: key,
    recommendation,
    warnings: Object.freeze(warnings),
    shouldRecommendOptimization: warnings.length > 0
  });
}
