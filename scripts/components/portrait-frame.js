import { getPortraitFitMode, normalizePortrait, portraitSourceMeta } from "../core/portrait.js";

function escapeAttribute(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

export function buildPortraitFrameModel(portrait = {}, {
  label = "Retrato",
  kind = "subject",
  lazy = true
} = {}) {
  const normalized = normalizePortrait(portrait);
  const source = portraitSourceMeta(normalized.src);
  return Object.freeze({
    portrait: normalized,
    source,
    label: String(label || "Retrato"),
    kind: kind === "focal" ? "focal" : "subject",
    fit: getPortraitFitMode(normalized),
    portraitScale: normalized.zoom / 100,
    hasImage: Boolean(normalized.src),
    lazy: Boolean(lazy)
  });
}

/**
 * Componente visual puro. Efeitos/scanlines não ficam sobre a imagem.
 * O style inline contém somente variáveis dinâmicas de enquadramento.
 */
export function renderPortraitFrameHTML(modelOrPortrait = {}, options = {}) {
  const model = modelOrPortrait?.portrait && Object.hasOwn(modelOrPortrait, "hasImage")
    ? modelOrPortrait
    : buildPortraitFrameModel(modelOrPortrait, options);
  const portrait = model.portrait;
  const styleVars = `--gms-portrait-zoom:${portrait.zoom / 100};--gms-portrait-x:${portrait.x}%;--gms-portrait-y:${portrait.y}%;`;
  const classes = [
    "gms-reputation-portrait",
    `gms-reputation-portrait--${model.kind}`,
    `is-fit-${model.fit}`,
    model.hasImage ? "has-image" : "is-empty"
  ].join(" ");

  const content = model.hasImage
    ? `<img class="gms-reputation-portrait__image" src="${escapeAttribute(portrait.src)}" alt="" aria-hidden="true" draggable="false" decoding="async"${model.lazy ? ' loading="lazy"' : ""}>`
    : `<span class="gms-reputation-portrait__placeholder" aria-hidden="true"><i></i><b>SEM IMG</b></span>`;

  return `<span class="${classes}" data-portrait-kind="${model.kind}" data-portrait-source="${escapeAttribute(model.source.origin)}" data-portrait-animated="${model.source.animated}" role="img" aria-label="${escapeAttribute(model.label)}" style="${styleVars}">${content}</span>`;
}
