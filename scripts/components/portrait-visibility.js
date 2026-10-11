const IMAGE_SELECTOR = "img[data-gms-portrait-src]";

/** Update the desired source without starting an offscreen download. */
export function setPortraitImageSource(image, source = "") {
  if (!image?.setAttribute) return;
  const next = String(source || "");
  if (image.getAttribute("data-gms-portrait-src") === next) return;
  image.removeAttribute("src");
  image.setAttribute("data-gms-portrait-src", next);
  image.setAttribute("data-gms-portrait-state", "suspended");
}

/**
 * Owns only DOM image sources, never portrait data or framing.
 * A viewport observer respects nested scroll clipping and collapsed sections.
 * Removing src releases the element's association with the animated image;
 * browser caches remain browser-owned. Returning GIFs may restart playback.
 */
export function wirePortraitVisibility(root, { releaseDelay = 120 } = {}) {
  const doc = root?.ownerDocument ?? globalThis.document;
  const win = doc?.defaultView ?? globalThis;
  if (!root?.querySelectorAll || !doc?.addEventListener) {
    return Object.freeze({ refresh() {}, destroy() {} });
  }
  const images = new Map();
  let destroyed = false;
  let refreshQueued = false;

  const suppressed = (image) => {
    if (doc.hidden || !image.isConnected || image.hidden || image.closest("[hidden]")) return true;
    for (let ancestor = image.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === "DETAILS" && !ancestor.open
          && !ancestor.querySelector(":scope > summary")?.contains(image)) return true;
    }
    if (!image.getClientRects().length) return true;
    const visibility = win.getComputedStyle?.(image.parentElement)?.visibility;
    return visibility === "hidden" || visibility === "collapse";
  };
  const cancelRelease = (record) => {
    if (record.timer != null) win.clearTimeout(record.timer);
    record.timer = null;
  };
  const release = (image, record) => {
    cancelRelease(record);
    image.removeAttribute("src");
    image.setAttribute("data-gms-portrait-state", "suspended");
  };
  const apply = (image, record, { immediate = false } = {}) => {
    if (destroyed) return;
    const source = image.getAttribute("data-gms-portrait-src") || "";
    if (source && record.intersecting && !suppressed(image)) {
      cancelRelease(record);
      if (image.getAttribute("src") !== source) image.setAttribute("src", source);
      image.setAttribute("data-gms-portrait-state", "active");
    } else if (immediate || suppressed(image) || !source) {
      release(image, record);
    } else if (record.timer == null && image.hasAttribute("src")) {
      record.timer = win.setTimeout(() => {
        record.timer = null;
        if (!destroyed && images.has(image) && !record.intersecting) release(image, record);
      }, releaseDelay);
    }
  };
  const Observer = win.IntersectionObserver;
  const observer = typeof Observer === "function" ? new Observer((entries) => {
    for (const entry of entries) {
      const record = images.get(entry.target);
      if (!record) continue;
      record.intersecting = entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0;
      apply(entry.target, record);
    }
  }, { root: null, rootMargin: "0px", threshold: [0, 0.001] }) : null;

  const refresh = () => {
    if (destroyed) return;
    for (const [image, record] of images) {
      if (root.contains(image) && image.matches(IMAGE_SELECTOR)) continue;
      observer?.unobserve(image);
      release(image, record);
      images.delete(image);
    }
    for (const image of root.querySelectorAll(IMAGE_SELECTOR)) {
      let record = images.get(image);
      if (!record) {
        record = { intersecting: !observer, timer: null };
        images.set(image, record);
        image.decoding = "async";
        // IntersectionObserver owns loading; native lazy thresholds must not defer a visible portrait.
        image.loading = "eager";
        image.setAttribute("data-gms-portrait-state", "suspended");
        observer?.observe(image);
      }
      apply(image, record);
    }
  };
  const scheduleRefresh = () => {
    if (destroyed || refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(() => { refreshQueued = false; refresh(); });
  };
  const Mutations = win.MutationObserver;
  const mutations = typeof Mutations === "function" ? new Mutations(scheduleRefresh) : null;
  mutations?.observe(root, { subtree: true, childList: true, attributes: true,
    attributeFilter: ["data-gms-portrait-src", "hidden", "open"] });
  const visibilityChanged = () => {
    for (const [image, record] of images) apply(image, record, { immediate: Boolean(doc.hidden) });
  };
  doc.addEventListener("visibilitychange", visibilityChanged);
  // Capturing also covers nested details/popovers without wiring each component.
  root.addEventListener("toggle", scheduleRefresh, true);
  refresh();

  return Object.freeze({
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      mutations?.disconnect();
      doc.removeEventListener("visibilitychange", visibilityChanged);
      root.removeEventListener("toggle", scheduleRefresh, true);
      for (const [image, record] of images) release(image, record);
      images.clear();
    }
  });
}
