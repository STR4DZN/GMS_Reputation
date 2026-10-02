const SELECTOR = "img[data-gms-media-src]";

// Keep the persisted URL separate from the live image request. Editors can
// change sources without starting downloads inside a hidden workspace.
export function setPortraitImageSource(image, source = "") {
  if (!image?.setAttribute) return;
  const next = String(source || "");
  if (image.getAttribute("data-gms-media-src") === next) return;
  image.removeAttribute("src");
  image.setAttribute("data-gms-media-state", "dormant");
  image.setAttribute("data-gms-media-src", next);
}

/**
 * Only live portraits intersecting their clipped viewport receive a src.
 * Removing src stops displaying the animated resource; the browser owns its
 * download/decoded-image caches, so this does not promise immediate memory GC.
 */
export function wireVisiblePortraits(root, { companion = null, concurrency = 2 } = {}) {
  const roots = [root, companion].filter((node) => node?.querySelectorAll);
  const doc = root?.ownerDocument;
  const view = doc?.defaultView;
  if (!roots.length || !view) return { refresh() {}, destroy() {} };
  const records = new Map();
  const queue = new Set();
  const limit = Math.max(1, Math.min(4, Number(concurrency) || 2));
  let active = 0;
  let destroyed = false;
  let frame = null;

  const isShown = (image) => {
    if (doc.hidden || !image.isConnected || !roots.some((node) => node.contains(image))) return false;
    if (image.closest("[hidden], .minimized")) return false;
    for (let node = image.parentElement; node; node = node.parentElement) {
      if (node.tagName === "DETAILS" && !node.open && !node.querySelector(":scope > summary")?.contains(image)) return false;
      const style = view.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    return image.getClientRects().length > 0;
  };

  // Fallback for runtimes without IntersectionObserver, including clipping by
  // nested scroll containers. Modern Foundry browsers use the observer below.
  const intersects = (image) => {
    if (!isShown(image)) return false;
    const rect = image.getBoundingClientRect();
    let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
    let right = Math.min(view.innerWidth, rect.right), bottom = Math.min(view.innerHeight, rect.bottom);
    for (let node = image.parentElement; node; node = node.parentElement) {
      const style = view.getComputedStyle(node);
      const bounds = node.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
    }
    return right > left && bottom > top;
  };

  const release = (record) => {
    queue.delete(record);
    record.cancel?.();
    record.cancel = null;
    record.image.removeAttribute("src");
    record.image.setAttribute("data-gms-media-state", "dormant");
  };

  const pump = () => {
    if (destroyed) return;
    for (const record of queue) {
      if (active >= limit) break;
      queue.delete(record);
      const image = record.image;
      if (!record.visible || !isShown(image) || !record.source) continue;
      active++;
      let settled = false;
      let timer;
      const finish = (state) => {
        if (settled) return;
        settled = true;
        view.clearTimeout(timer);
        image.removeEventListener("load", loaded);
        image.removeEventListener("error", failed);
        record.cancel = null;
        active--;
        if (state) image.setAttribute("data-gms-media-state", state);
        view.queueMicrotask(pump);
      };
      const loaded = () => finish("ready");
      const failed = () => finish("error");
      record.cancel = () => finish(null);
      image.addEventListener("load", loaded);
      image.addEventListener("error", failed);
      // A hung request must not block every remaining visible portrait.
      timer = view.setTimeout(() => { finish("error"); image.removeAttribute("src"); }, 60000);
      image.setAttribute("data-gms-media-state", "loading");
      image.decoding = "async";
      image.loading = "eager";
      image.setAttribute("src", record.source);
      if (image.complete && image.naturalWidth > 0) loaded();
    }
  };

  const reconcile = (record) => {
    const source = record.image.getAttribute("data-gms-media-src") || "";
    if (source !== record.source) { release(record); record.source = source; }
    if (!record.visible || !isShown(record.image) || !source) { release(record); return; }
    if (!record.image.hasAttribute("src") && record.image.getAttribute("data-gms-media-state") !== "error") queue.add(record);
  };

  const observer = view.IntersectionObserver ? new view.IntersectionObserver((entries) => {
    for (const entry of entries) {
      const record = records.get(entry.target);
      if (!record) continue;
      record.visible = entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0;
      reconcile(record);
    }
    pump();
  }, { root: null, rootMargin: "0px", threshold: [0, 0.001] }) : null;

  const refresh = () => {
    frame = null;
    if (destroyed) return;
    for (const [image, record] of records) {
      if (!image.isConnected || !roots.some((node) => node.contains(image))) {
        release(record);
        observer?.unobserve(image);
        records.delete(image);
      }
    }
    for (const node of roots) for (const image of node.querySelectorAll(SELECTOR)) {
      let record = records.get(image);
      if (!record) {
        record = { image, source: "", visible: false, cancel: null };
        records.set(image, record);
        observer?.observe(image);
      }
      if (!observer) record.visible = intersects(image);
      reconcile(record);
    }
    pump();
  };
  const schedule = () => { if (!destroyed && frame === null) frame = view.requestAnimationFrame(refresh); };
  const mutation = view.MutationObserver ? new view.MutationObserver((changes) => {
    if (changes.some((change) => change.type === "childList" || change.attributeName !== "class" || roots.includes(change.target))) schedule();
  }) : null;
  for (const node of roots) {
    mutation?.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-gms-media-src", "hidden", "open", "class"] });
    node.addEventListener("toggle", schedule, true);
  }
  doc.addEventListener("visibilitychange", refresh);
  view.addEventListener("resize", schedule);
  if (!observer) doc.addEventListener("scroll", schedule, true);
  refresh();

  return {
    refresh,
    destroy() {
      destroyed = true;
      observer?.disconnect();
      mutation?.disconnect();
      if (frame !== null) view.cancelAnimationFrame(frame);
      for (const node of roots) node.removeEventListener("toggle", schedule, true);
      doc.removeEventListener("visibilitychange", refresh);
      view.removeEventListener("resize", schedule);
      if (!observer) doc.removeEventListener("scroll", schedule, true);
      for (const record of records.values()) release(record);
      records.clear();
      queue.clear();
    }
  };
}
