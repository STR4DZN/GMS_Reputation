import { openPortraitOriginal } from "./portrait-original-viewer.js";
import { setPortraitImageSource } from "./master-visible-portraits.js";
import {
  dragPortraitFrame,
  getPortraitFitMode,
  isSupportedPortraitSource,
  normalizePortrait,
  normalizePortraitSource,
  resetPortraitFrame,
  portraitSourceMeta,
  portraitEquals,
} from "../core/portrait.js";
import { openPortraitFilePicker } from "../utils/file-picker.js";

function portraitSourceName(source) {
  if (!source) return "Nenhuma imagem selecionada";
  if (/^data:image\//i.test(source)) return "Imagem incorporada";
  return (
    String(source).split(/[?#]/)[0].split("/").pop() || "Imagem selecionada"
  );
}

function readNumber(input, fallback) {
  const value = Number(input?.value);
  return Number.isFinite(value) ? value : fallback;
}

function setOutput(input, value) {
  const label = input?.closest?.("label");
  const output = label?.querySelector?.("output");
  if (output) output.textContent = `${value}%`;
}

export function buildPortraitEditorContext(
  portrait = {},
  { label = "Retrato", kind = "subject" } = {},
) {
  const normalized = normalizePortrait(portrait);
  const remoteUrl = /^https?:\/\//i.test(normalized.src) ? normalized.src : "";
  return Object.freeze({
    portrait: normalized,
    portraitScale: normalized.zoom / 100,
    label: String(label || "Retrato"),
    kind: kind === "focal" ? "focal" : "subject",
    fit: getPortraitFitMode(normalized),
    fitOptions: Object.freeze([
      Object.freeze({
        value: "contain",
        label: "Imagem inteira — sem cortes",
        selected: normalized.fit === "contain",
      }),
      Object.freeze({
        value: "cover",
        label: "Preencher quadro — com recorte",
        selected: normalized.fit === "cover",
      }),
    ]),
    hasImage: Boolean(normalized.src),
    isFocal: kind === "focal",
    previewTitle: kind === "focal" ? "Perfil dos Players" : "Tabela dos Players",
    secondaryTitle: kind === "focal" ? "Menu de NPCs" : "Ficha ampliada",
    secondaryHint: kind === "focal" ? "A miniatura do menu mostra sempre a imagem inteira." : "O mesmo ajuste dentro do quadro quadrado da ficha.",
    secondaryPreview: Object.freeze({
      portrait: kind === "focal" ? normalizePortrait({...normalized,fit:"contain",zoom:100,x:50,y:50}) : normalized,
      portraitScale: kind === "focal" ? 1 : normalized.zoom / 100,
      kind: kind === "focal" ? "focal" : "subject",
      fit: kind === "focal" ? "contain" : normalized.fit,
      hasImage: Boolean(normalized.src), source: portraitSourceMeta(normalized.src),
      label: kind === "focal" ? "Imagem inteira no menu de NPCs" : "Enquadramento na ficha ampliada",
    }),
    source: portraitSourceMeta(normalized.src),
    remoteUrl,
    sourceName: portraitSourceName(normalized.src),
  });
}

/**
 * Controller reutilizável do partial portrait-editor.hbs.
 * Não persiste nada sozinho: apenas produz Portrait normalizado via onChange.
 */
export function wirePortraitEditor(
  root,
  {
    initialPortrait = {},
    verifiedSource = initialPortrait?.src || "",
    savedPortrait = initialPortrait,
    onChange = null,
    onError = null,
    filePicker = openPortraitFilePicker,
  } = {},
) {
  if (!root?.querySelector)
    throw new TypeError("Portrait editor root element is required.");

  const sourceInput = root.querySelector('input[name="portraitSrc"]');
  const urlInput = root.querySelector('input[name="portraitUrl"]');
  const zoomInput = root.querySelector('input[name="portraitZoom"]');
  const fitInput = root.querySelector('select[name="portraitFit"]');
  const xInput = root.querySelector('input[name="portraitX"]');
  const yInput = root.querySelector('input[name="portraitY"]');
  const preview = root.querySelector("[data-portrait-preview]");
  const frames = [...root.querySelectorAll(".gms-reputation-portrait")];
  const frame = frames[0];
  const originalButton = root.querySelector('[data-action="openPortraitOriginal"]');
  const restoreButton = root.querySelector('[data-action="restoreSavedPortrait"]');
  let originalView = null;
  const listeners = [];
  let portrait = normalizePortrait(
    initialPortrait?.src !== undefined
      ? initialPortrait
      : {
          src: sourceInput?.value,
          fit: fitInput?.value,
          zoom: zoomInput?.value,
          x: xInput?.value,
          y: yInput?.value,
        },
  );
  const registered = normalizePortrait(savedPortrait?.src !== undefined ? savedPortrait : portrait);
  const verifiedSources = new Set([String(verifiedSource || "")]);
  const pendingVerifications = new Set();
  let dragState = null;
  const status = root.querySelector("[data-portrait-status]");
  const showStatus = (message, error = false) => {
    if (status) {
      status.textContent = message;
      status.dataset.error = String(error);
    }
    urlInput?.setAttribute?.("aria-invalid", String(error));
    const retry = root.querySelector('[data-action="retryPortrait"]');
    if (retry) retry.hidden = !error || !portrait.src;
  };

  const listen = (target, type, handler, options) => {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };

  const ensurePreviewNodes = (frame) => {
    if (!frame) return {};
    let image = frame.querySelector(".gms-reputation-portrait__image");
    let placeholder = frame.querySelector(
      ".gms-reputation-portrait__placeholder",
    );
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
    const previous = portrait;
    portrait = normalizePortrait(next);
    if (sourceInput) sourceInput.value = portrait.src;
    if (urlInput && urlInput !== globalThis.document?.activeElement) {
      urlInput.value = /^https?:\/\//i.test(portrait.src) ? portrait.src : "";
    }
    const sourceLabel = root.querySelector("[data-portrait-source-label]");
    if (sourceLabel) sourceLabel.textContent = portraitSourceName(portrait.src);
    if (fitInput) fitInput.value = portrait.fit;
    if (zoomInput) zoomInput.value = String(portrait.zoom);
    if (xInput) xInput.value = String(portrait.x);
    if (yInput) yInput.value = String(portrait.y);
    setOutput(zoomInput, portrait.zoom);
    setOutput(xInput, portrait.x);
    setOutput(yInput, portrait.y);
    for (const number of root.querySelectorAll("[data-portrait-number]"))
      number.value = String(portrait[number.dataset.portraitNumber]);

    if (originalButton) originalButton.disabled = !portrait.src;
    if (restoreButton) restoreButton.disabled = portraitEquals(portrait, registered);
    const framingHint = root.querySelector("[data-portrait-framing-hint]");
    if (framingHint) framingHint.textContent = portrait.fit === "cover"
      ? "Preencher ocupa o quadro sem deformar; as bordas podem ser cortadas."
      : portrait.zoom > 100 ? "Imagem inteira com zoom acima de 100%: parte da imagem pode sair do quadro."
      : "Imagem inteira preserva a proporção; margens são normais quando o formato é diferente do quadro.";
    for (const frame of frames) {
      const effective = frame.closest("[data-portrait-secondary-preview]") && root.dataset.portraitKind === "focal"
        ? {...portrait, fit:"contain", zoom:100, x:50, y:50} : portrait;
      const meta = portraitSourceMeta(portrait.src);
      frame.dataset.portraitSource = meta.origin;
      frame.dataset.portraitAnimated = String(meta.animated);
      frame.style.setProperty(
        "--gms-portrait-zoom",
        String(effective.zoom / 100),
      );
      frame.style.setProperty("--gms-portrait-x", `${effective.x}%`);
      frame.style.setProperty("--gms-portrait-y", `${effective.y}%`);
      frame.classList.toggle(
        "is-fit-contain",
        getPortraitFitMode(effective) === "contain",
      );
      frame.classList.toggle(
        "is-fit-fill",
        getPortraitFitMode(effective) === "fill",
      );
      frame.classList.toggle(
        "is-fit-cover",
        getPortraitFitMode(effective) === "cover",
      );
      frame.classList.toggle("has-image", Boolean(portrait.src));
      frame.classList.toggle("is-empty", !portrait.src);
      const { image, placeholder } = ensurePreviewNodes(frame);
      if (image) {
        setPortraitImageSource(image, portrait.src);
        image.hidden = !portrait.src;
      }
      if (placeholder) placeholder.hidden = Boolean(portrait.src);
    }
    if (emitChange && !portraitEquals(previous, portrait)) emit();
    return portrait;
  };

  const reloadCurrentSource = () => {
    for (const candidate of frames)
      setPortraitImageSource(candidate.querySelector(".gms-reputation-portrait__image"), portrait.src, {force:true});
    preview?.scrollIntoView?.({block:"nearest",behavior:"auto"});
  };

  const applySource = (source) => {
    const normalized = normalizePortraitSource(source);
    if (!normalized || !isSupportedPortraitSource(normalized)) {
      const error = new TypeError(
        "Informe um caminho de imagem do Foundry ou um link direto válido.",
      );
      showStatus(error.message, true);
      if (typeof onError === "function") onError(error);
      return false;
    }
    if (urlInput)
      urlInput.value = /^https?:\/\//i.test(normalized) ? normalized : "";
    showStatus("Carregando a prévia…");
    if (normalized === portrait.src) {
      reloadCurrentSource();
      return true;
    }
    apply({ src: normalized, fit: "contain", zoom: 100, x: 50, y: 50 });
    preview?.scrollIntoView?.({block:"nearest",behavior:"auto"});
    return true;
  };

  for (const [input, field] of [[zoomInput,"zoom"],[xInput,"x"],[yInput,"y"]])
    listen(input, "input", () => apply({...portrait, [field]:readNumber(input,portrait[field])}));
  for (const input of root.querySelectorAll("[data-portrait-number]"))
    listen(input, "change", () => {
      if (input.value === "" || !Number.isFinite(Number(input.value))) {
        input.value = String(portrait[input.dataset.portraitNumber]);
        return;
      }
      apply({
        ...portrait,
        [input.dataset.portraitNumber]: Number(input.value),
      });
    });
  listen(root.querySelector('[data-action="retryPortrait"]'), "click", () => {
    showStatus("Carregando a prévia…");
    reloadCurrentSource();
  });
  listen(fitInput, "change", () => apply({ ...portrait, fit: fitInput.value }));

  listen(originalButton, "click", () => {
    originalView?.destroy();
    originalView = openPortraitOriginal(root, {source:portrait.src, label:"Imagem ou GIF original", returnFocus:originalButton});
  });
  listen(restoreButton, "click", () => {
    apply(registered);
    showStatus("Enquadramento salvo recuperado. Nenhuma imagem foi substituída.");
  });

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

  listen(root.querySelector('[data-action="centerPortrait"]'), "click", () =>
    apply({ ...portrait, x: 50, y: 50 }),
  );
  listen(
    root,
    "load",
    (event) => {
      if (
        event.target?.matches?.(".gms-reputation-portrait__image") &&
        event.target.naturalWidth
      )
        verifiedSources.add(
          event.target.getAttribute("data-gms-media-src") || "",
        );
    },
    true,
  );
  listen(
    root,
    "load",
    (event) => {
      if (
        event.target?.matches?.(".gms-reputation-portrait__image") &&
        event.target.naturalWidth
      )
        showStatus(
          `${event.target.naturalWidth} × ${event.target.naturalHeight} px · imagem pronta para ajustar`,
        );
    },
    true,
  );
  listen(
    root,
    "error",
    (event) => {
      if (event.target?.matches?.(".gms-reputation-portrait__image"))
        showStatus(
          "Não foi possível carregar. Confira o caminho antes de salvar.",
          true,
        );
    },
    true,
  );
  listen(preview, "dragover", (event) => {
    event.preventDefault();
    preview.dataset.dropActive = "true";
  });
  listen(preview, "dragleave", () => {
    preview.dataset.dropActive = "false";
  });
  listen(preview, "drop", (event) => {
    event.preventDefault();
    preview.dataset.dropActive = "false";
    if (event.dataTransfer?.files?.length) {
      showStatus(
        "Use “Escolher no Foundry” para enviar um arquivo do computador.",
      );
      return;
    }
    const value =
      event.dataTransfer?.getData("text/uri-list") ||
      event.dataTransfer?.getData("text/plain");
    if (value)
      applySource(
        value.split("\n").find((line) => line && !line.startsWith("#")) || "",
      );
  });

  const resetButton = root.querySelector('[data-action="resetPortraitFrame"]');
  listen(resetButton, "click", () => apply(resetPortraitFrame(portrait)));

  const removeButton = root.querySelector('[data-action="removePortrait"]');
  listen(removeButton, "click", () => {
    if (urlInput) urlInput.value = "";
    apply({ src: "", zoom: 100, x: 50, y: 50 });
    showStatus("Imagem removida do rascunho. Salve para confirmar.");
  });

  listen(preview, "pointerdown", (event) => {
    if (!portrait.src || event.button !== 0) return;
    dragState = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      portrait,
    };
    preview.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  listen(preview, "pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const bounds = preview.getBoundingClientRect();
    apply(
      dragPortraitFrame(dragState.portrait, {
        deltaX: event.clientX - dragState.clientX,
        deltaY: event.clientY - dragState.clientY,
        viewportWidth: bounds.width,
        viewportHeight: bounds.height,
      }),
    );
  });

  const stopDrag = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    preview.releasePointerCapture?.(event.pointerId);
    dragState = null;
  };
  listen(preview, "pointerup", stopDrag);
  listen(preview, "pointercancel", stopDrag);

  listen(preview, "keydown", (event) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    const movement = event.shiftKey ? 5 : 1;
    const delta = {
      ArrowLeft: { x: -movement },
      ArrowRight: { x: movement },
      ArrowUp: { y: -movement },
      ArrowDown: { y: movement },
    }[event.key];
    apply({
      ...portrait,
      x: portrait.x + (delta.x ?? 0),
      y: portrait.y + (delta.y ?? 0),
    });
    event.preventDefault();
  });

  apply(portrait, { emitChange: false });

  return Object.freeze({
    get value() {
      return portrait;
    },
    apply,
    applySource,
    async assertSourceAvailable(source = portrait.src) {
      if (!source || verifiedSources.has(String(source))) return;
      const error = () =>
        new Error(
          "A imagem ainda não carregou ou apresentou erro. Volte ao editor e confira a prévia antes de salvar.",
        );
      if (!root.isConnected || source !== portrait.src) throw error();
      const image = frame?.querySelector(".gms-reputation-portrait__image");
      if (!image || image.dataset.gmsMediaState === "error") throw error();
      // Saving from below the preview must not deadlock a deferred image.
      preview?.scrollIntoView?.({ block: "nearest", behavior: "auto" });
      await new Promise((resolve, reject) => {
        let timer;
        const finish = (failed) => {
          clearTimeout(timer);
          image.removeEventListener("load", loaded);
          image.removeEventListener("error", failedLoad);
          pendingVerifications.delete(cancel);
          failed ? reject(error()) : resolve();
        };
        const loaded = () => {
          if (
            image.getAttribute("data-gms-media-src") !== source ||
            !image.naturalWidth
          ) {
            finish(true);
            return;
          }
          verifiedSources.add(String(source));
          finish(false);
        };
        const failedLoad = () => finish(true);
        const cancel = () => finish(true);
        pendingVerifications.add(cancel);
        image.addEventListener("load", loaded);
        image.addEventListener("error", failedLoad);
        timer = setTimeout(failedLoad, 15000);
        if (
          image.dataset.gmsMediaState === "ready" &&
          image.naturalWidth &&
          image.getAttribute("data-gms-media-src") === source
        )
          loaded();
      });
    },
    reset: () => apply(resetPortraitFrame(portrait)),
    destroy() {
      originalView?.destroy();
      for (const cancel of pendingVerifications) cancel();
      pendingVerifications.clear();
      listeners.splice(0).forEach((remove) => remove());
    },
  });
}
