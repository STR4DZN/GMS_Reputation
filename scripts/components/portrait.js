import {
  normalizePortrait,
  getPortraitFitMode,
  portraitSourceMeta,
  dragPortraitFrame,
  resetPortraitFrame
} from "../domain/portraits.js";

export function buildPortraitFrameModel(portrait = {}, {
  label = "Retrato",
  kind = "subject"
} = {}) {
  const normalized = normalizePortrait(portrait);
  const meta = portraitSourceMeta(normalized.src);

  return Object.freeze({
    portrait: normalized,
    portraitScale: normalized.zoom / 100,
    label: String(label || "Retrato"),
    kind: kind === "focal" ? "focal" : "subject",
    fit: getPortraitFitMode(normalized),
    hasImage: Boolean(normalized.src),
    source: meta
  });
}

export function buildPortraitEditorContext(portrait = {}, {
  label = "Retrato",
  kind = "subject"
} = {}) {
  const frame = buildPortraitFrameModel(portrait, { label, kind });
  return Object.freeze({
    ...frame,
    remoteUrl: frame.source.origin === "remote" ? frame.portrait.src : ""
  });
}

/**
 * Controller interativo para o Portrait Editor 2.
 * Atualiza propriedades CSS no elemento de preview sem recriar nós DOM.
 */
export function wirePortraitEditor(root, { onChange = null } = {}) {
  if (!root?.querySelector) return { destroy() {} };

  const previewFrame = root.querySelector(".gms-reputation-portrait");
  const zoomInput = root.querySelector('input[name="portraitZoom"]');
  const xInput = root.querySelector('input[name="portraitX"]');
  const yInput = root.querySelector('input[name="portraitY"]');
  const srcInput = root.querySelector('input[name="portraitSrc"]');
  const zoomOutput = root.querySelector("[data-portrait-zoom-output]");

  function updatePreview() {
    const zoom = Number(zoomInput?.value || 100);
    const x = Number(xInput?.value || 50);
    const y = Number(yInput?.value || 50);
    const src = srcInput?.value || "";

    if (previewFrame) {
      previewFrame.style.setProperty("--gms-portrait-zoom", String(zoom / 100));
      previewFrame.style.setProperty("--gms-portrait-x", `${x}%`);
      previewFrame.style.setProperty("--gms-portrait-y", `${y}%`);

      const img = previewFrame.querySelector("img");
      if (img && src) img.src = src;
    }

    if (zoomOutput) {
      zoomOutput.textContent = `${zoom}%`;
    }

    if (typeof onChange === "function") {
      onChange({ src, zoom, x, y });
    }
  }

  // Eventos de arrastar diretamente na imagem de preview
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  function onPointerDown(e) {
    if (e.button !== 0) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    previewFrame?.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    startX = e.clientX;
    startY = e.clientY;

    const currentX = Number(xInput?.value || 50);
    const currentY = Number(yInput?.value || 50);
    const rect = previewFrame?.getBoundingClientRect?.() ?? { width: 100, height: 100 };

    const sensitivity = 100 / Math.max(1, rect.width);
    const nextX = Math.min(100, Math.max(0, currentX - dx * sensitivity));
    const nextY = Math.min(100, Math.max(0, currentY - dy * sensitivity));

    if (xInput) xInput.value = String(Math.round(nextX));
    if (yInput) yInput.value = String(Math.round(nextY));
    updatePreview();
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    try { previewFrame?.releasePointerCapture?.(e.pointerId); } catch (_) {}
  }

  zoomInput?.addEventListener("input", updatePreview);
  xInput?.addEventListener("input", updatePreview);
  yInput?.addEventListener("input", updatePreview);
  srcInput?.addEventListener("input", updatePreview);

  previewFrame?.addEventListener("pointerdown", onPointerDown);
  previewFrame?.addEventListener("pointermove", onPointerMove);
  previewFrame?.addEventListener("pointerup", onPointerUp);
  previewFrame?.addEventListener("pointercancel", onPointerUp);

  return {
    destroy() {
      zoomInput?.removeEventListener("input", updatePreview);
      xInput?.removeEventListener("input", updatePreview);
      yInput?.removeEventListener("input", updatePreview);
      srcInput?.removeEventListener("input", updatePreview);
      previewFrame?.removeEventListener("pointerdown", onPointerDown);
      previewFrame?.removeEventListener("pointermove", onPointerMove);
      previewFrame?.removeEventListener("pointerup", onPointerUp);
      previewFrame?.removeEventListener("pointercancel", onPointerUp);
    }
  };
}
