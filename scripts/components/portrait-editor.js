import {
  dragPortraitFrame,
  getPortraitFitMode,
  isSupportedPortraitSource,
  normalizePortrait,
  normalizePortraitSource,
  resetPortraitFrame
} from "../core/portrait.js";
import { openPortraitFilePicker } from "../utils/file-picker.js";

function readNumber(input, fallback) {
  const value = Number(input?.value);
  return Number.isFinite(value) ? value : fallback;
}

function setOutput(input, value) {
  const label = input?.closest?.("label");
  const output = label?.querySelector?.("output");
  if (output) output.textContent = `${value}%`;
}


export function buildPortraitEditorContext(portrait = {}, {
  label = "Retrato",
  kind = "subject"
} = {}) {
  const normalized = normalizePortrait(portrait);
  const remoteUrl = /^https?:\/\//i.test(normalized.src) ? normalized.src : "";
  return Object.freeze({
    portrait: normalized,
    portraitScale: normalized.zoom / 100,
    label: String(label || "Retrato"),
    kind: kind === "focal" ? "focal" : "subject",
    fit: getPortraitFitMode(normalized),
    hasImage: Boolean(normalized.src),
    source: Object.freeze({
      origin: /^https?:\/\//i.test(normalized.src) ? "remote" : normalized.src ? "foundry" : "none",
      animated: /\.(?:gif|apng)(?:[?#]|$)/i.test(normalized.src)
    }),
    remoteUrl
  });
}

/**
 * Controller reutilizável do partial portrait-editor.hbs.
 * Não persiste nada sozinho: apenas produz Portrait normalizado via onChange.
 */
export function wirePortraitEditor(root, {
  initialPortrait = {},
  onChange = null,
  onError = null,
  filePicker = openPortraitFilePicker
} = {}) {
  if (!root?.querySelector) throw new TypeError("Portrait editor root element is required.");

  const sourceInput = root.querySelector('input[name="portraitSrc"]');
  const urlInput = root.querySelector('input[name="portraitUrl"]');
  const zoomInput = root.querySelector('input[name="portraitZoom"]');
  const xInput = root.querySelector('input[name="portraitX"]');
  const yInput = root.querySelector('input[name="portraitY"]');
  const preview = root.querySelector("[data-portrait-preview]");
  const frame = root.querySelector(".gms-reputation-portrait");
  const listeners = [];
  let portrait = normalizePortrait(initialPortrait?.src !== undefined ? initialPortrait : {
    src: sourceInput?.value,
    zoom: zoomInput?.value,
    x: xInput?.value,
    y: yInput?.value
  });
  let dragState = null;

  const listen = (target, type, handler, options) => {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };

  const ensurePreviewNodes = () => {
    if (!frame) return {};
    let image = frame.querySelector(".gms-reputation-portrait__image");
    let placeholder = frame.querySelector(".gms-reputation-portrait__placeholder");
    if (!image) {
      image = document.createElement("img");
      image.className = "gms-reputation-portrait__image";
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.draggable = false;
      image.decoding = "async";
      frame.append(image);
    }
    if (!placeholder) {
      placeholder = document.createElement("span");
      placeholder.className = "gms-reputation-portrait__placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.innerHTML = "<i></i><b>SEM IMG</b>";
      frame.append(placeholder);
    }
    return { image, placeholder };
  };

  const emit = () => {
    if (typeof onChange === "function") onChange(portrait);
  };

  const apply = (next, { emitChange = true } = {}) => {
    portrait = normalizePortrait(next);
    if (sourceInput) sourceInput.value = portrait.src;
    if (zoomInput) zoomInput.value = String(portrait.zoom);
    if (xInput) xInput.value = String(portrait.x);
    if (yInput) yInput.value = String(portrait.y);
    setOutput(zoomInput, portrait.zoom);
    setOutput(xInput, portrait.x);
    setOutput(yInput, portrait.y);

    if (frame) {
      frame.style.setProperty("--gms-portrait-zoom", String(portrait.zoom / 100));
      frame.style.setProperty("--gms-portrait-x", `${portrait.x}%`);
      frame.style.setProperty("--gms-portrait-y", `${portrait.y}%`);
      frame.classList.toggle("is-fit-contain", getPortraitFitMode(portrait) === "contain");
      frame.classList.toggle("is-fit-cover", getPortraitFitMode(portrait) === "cover");
      frame.classList.toggle("has-image", Boolean(portrait.src));
      frame.classList.toggle("is-empty", !portrait.src);
      const { image, placeholder } = ensurePreviewNodes();
      if (image) {
        if (portrait.src && image.getAttribute("src") !== portrait.src) image.setAttribute("src", portrait.src);
        if (!portrait.src) image.removeAttribute("src");
        image.hidden = !portrait.src;
      }
      if (placeholder) placeholder.hidden = Boolean(portrait.src);
    }
    if (emitChange) emit();
    return portrait;
  };

  const applySource = (source) => {
    const normalized = normalizePortraitSource(source);
    if (!normalized || !isSupportedPortraitSource(normalized)) {
      const error = new TypeError("Unsupported portrait source.");
      if (typeof onError === "function") onError(error);
      return false;
    }
    if (urlInput) urlInput.value = /^https?:\/\//i.test(normalized) ? normalized : "";
    apply({ src: normalized, zoom: 100, x: 50, y: 50 });
    return true;
  };

  [zoomInput, xInput, yInput].forEach((input) => listen(input, "input", () => {
    apply({
      ...portrait,
      zoom: readNumber(zoomInput, portrait.zoom),
      x: readNumber(xInput, portrait.x),
      y: readNumber(yInput, portrait.y)
    });
  }));

  const useUrlButton = root.querySelector('[data-action="usePortraitUrl"]');
  listen(useUrlButton, "click", () => applySource(urlInput?.value));
  listen(urlInput, "keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applySource(urlInput.value);
  });

  const pickerButton = root.querySelector('[data-action="pickPortrait"]');
  listen(pickerButton, "click", async () => {
    try {
      await filePicker({ current: portrait.src, onSelect: applySource });
    } catch (error) {
      if (typeof onError === "function") onError(error);
    }
  });

  const resetButton = root.querySelector('[data-action="resetPortraitFrame"]');
  listen(resetButton, "click", () => apply(resetPortraitFrame(portrait)));

  const removeButton = root.querySelector('[data-action="removePortrait"]');
  listen(removeButton, "click", () => {
    if (urlInput) urlInput.value = "";
    apply({ src: "", zoom: 100, x: 50, y: 50 });
  });

  listen(preview, "pointerdown", (event) => {
    if (!portrait.src || event.button !== 0) return;
    dragState = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      portrait
    };
    preview.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  listen(preview, "pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const bounds = preview.getBoundingClientRect();
    apply(dragPortraitFrame(dragState.portrait, {
      deltaX: event.clientX - dragState.clientX,
      deltaY: event.clientY - dragState.clientY,
      viewportWidth: bounds.width,
      viewportHeight: bounds.height
    }));
  });

  const stopDrag = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    preview.releasePointerCapture?.(event.pointerId);
    dragState = null;
  };
  listen(preview, "pointerup", stopDrag);
  listen(preview, "pointercancel", stopDrag);

  listen(preview, "keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const movement = event.shiftKey ? 5 : 1;
    const delta = {
      ArrowLeft: { x: -movement },
      ArrowRight: { x: movement },
      ArrowUp: { y: -movement },
      ArrowDown: { y: movement }
    }[event.key];
    apply({ ...portrait, x: portrait.x + (delta.x ?? 0), y: portrait.y + (delta.y ?? 0) });
    event.preventDefault();
  });

  apply(portrait, { emitChange: false });

  return Object.freeze({
    get value() { return portrait; },
    apply,
    applySource,
    reset: () => apply(resetPortraitFrame(portrait)),
    destroy() { listeners.splice(0).forEach((remove) => remove()); }
  });
}
