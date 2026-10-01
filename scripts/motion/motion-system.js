const DEFAULT_SCANNER_MS = 3200;
const AMBIENT_SCANNER_MS = 5000;
const AMBIENT_FIRST_DELAY_MS = 900;
const AMBIENT_INTERVAL_MS = 9000;
const BOOT_DELAY_MS = 240;

function now() {
  return Number(globalThis.performance?.now?.() ?? Date.now());
}


export function shouldRunMotion(root) {
  return Boolean(root) && !globalThis.document?.hidden && !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function shellHeight(root) {
  try {
    const rect = root?.getBoundingClientRect?.();
    const value = Number(rect?.height ?? root?.clientHeight ?? 0);
    return Math.max(420, Math.ceil(value + 96));
  } catch (_error) {
    return 900;
  }
}

function createScanner(root) {
  const doc = root?.ownerDocument ?? globalThis.document;
  if (!doc?.createElement || !root?.append) return null;
  const scanner = doc.createElement("span");
  scanner.className = "gms-motion-scanner";
  scanner.dataset.motionScanner = "true";
  scanner.dataset.variant = "boot";
  scanner.setAttribute("aria-hidden", "true");
  root.append(scanner);
  return scanner;
}

/**
 * Controller central de Motion Design.
 * Mantém o estilo visual e respeita movimento reduzido e abas em segundo plano.
 */
export function wireMotionSystem(root, {
  kind = "generic",
  boot = true,
  scannerDuration = DEFAULT_SCANNER_MS
} = {}) {
  if (!root?.querySelectorAll) {
    return Object.freeze({
      scan() { return false; },
      boot() { return false; },
      transition() { return false; },
      section() { return false; },
      relationship() { return false; },
      protocol() { return false; },
      sync() { return false; },
      reveal() { return false; },
      destroy() {}
    });
  }

  root.dataset.gmsMotionKind = String(kind || "generic");
  root.dataset.gmsMotionSystem = "59";
  root.dataset.gmsRuntimeBuild = "59.10";
  const timers = new Set();
  const animations = new Set();
  const frames = new Set();
  const removers = [];
  const cooldowns = new Map();
  let scanner = root.querySelector?.("[data-motion-scanner='true']") ?? null;
  let observer = null;
  let destroyed = false;

  const later = (fn, delay) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, Math.max(0, Number(delay) || 0));
    timers.add(id);
    return id;
  };

  const canTrigger = (key, cooldown = 0) => {
    if (!shouldRunMotion(root)) return false;
    const stamp = now();
    const previous = Number(cooldowns.get(key) || 0);
    if (cooldown > 0 && stamp - previous < cooldown) return false;
    cooldowns.set(key, stamp);
    return true;
  };

  const restartClass = (target, className, duration, { key = className, cooldown = 0 } = {}) => {
    if (!target?.classList || !canTrigger(key, cooldown)) return false;
    target.classList.remove(className);
    const activate = () => {
      if (destroyed || !shouldRunMotion(root)) return;
      target.classList.add(className);
      later(() => target?.classList?.remove?.(className), duration);
    };
    if (typeof globalThis.requestAnimationFrame === "function") {
      const id = requestAnimationFrame(() => { frames.delete(id); activate(); });
      frames.add(id);
    } else activate();
    return true;
  };

  const scan = (variant = "boot", { cooldown = 900, force = false, duration = scannerDuration } = {}) => {
    if (!force && !canTrigger(`scanner:${variant}`, cooldown)) return false;
    if (!shouldRunMotion(root)) return false;
    scanner ??= createScanner(root);
    if (!scanner) return false;
    const resolvedDuration = Math.max(800, Number(duration) || DEFAULT_SCANNER_MS);
    scanner.dataset.variant = String(variant || "boot");
    const distance = `${shellHeight(root)}px`;
    scanner.style?.setProperty?.("--gms54-scan-distance", distance);
    scanner.style?.setProperty?.("--gms54-scan-duration", `${resolvedDuration}ms`);
    scanner.style?.setProperty?.("--gms57-scan-distance", distance);
    scanner.style?.setProperty?.("--gms57-scan-duration", `${resolvedDuration}ms`);
    scanner.classList.remove("is-active");
    try { void scanner.offsetWidth; } catch (_error) { /* no-op */ }
    scanner.classList.add("is-active");
    later(() => scanner?.classList?.remove?.("is-active"), resolvedDuration + 160);
    return true;
  };

  const scheduleAmbientScan = (delay = AMBIENT_INTERVAL_MS) => later(() => {
    if (!destroyed && shouldRunMotion(root) && !scanner?.classList?.contains?.("is-active")) {
      scan("ambient", { cooldown: 0, force: true, duration: AMBIENT_SCANNER_MS });
    }
    if (!destroyed) scheduleAmbientScan(AMBIENT_INTERVAL_MS);
  }, delay);

  const bootShell = () => {
    if (!canTrigger("shell:boot", 0)) return false;
    restartClass(root, "is-gms-motion-booting", 1380, { key: "shell:boot-class" });
    later(() => scan("boot", { cooldown: 0, force: true }), BOOT_DELAY_MS);
    return true;
  };

  const transition = (type = "profile", target = root) => {
    const normalized = ["profile", "subject", "focal", "detail"].includes(type) ? type : "profile";
    const changed = restartClass(target, `is-gms-motion-${normalized}-change`, 680, {
      key: `transition:${normalized}`,
      cooldown: 120
    });
    if (changed && ["profile", "detail"].includes(normalized)) scan(normalized, { cooldown: 850 });
    return changed;
  };

  const section = (panel, order = 0) => {
    panel?.style?.setProperty?.("--gms57-section-delay", `${Math.max(0, Number(order) || 0) * 72}ms`);
    return restartClass(panel, "is-gms-motion-section-change", 660 + (Math.max(0, Number(order) || 0) * 80), {
      key: `section:${panel?.dataset?.masterSectionPanel || "unknown"}`,
      cooldown: 80
    });
  };

  const relationship = (target) => {
    if (!target) return false;
    const changed = restartClass(target, "is-gms-motion-relation-change", 680, {
      key: "relationship",
      cooldown: 95
    });
    const track = target.matches?.(".gms-reputation-heart-track")
      ? target
      : target.querySelector?.(".gms-reputation-heart-track");
    if (changed && track) restartClass(track, "is-gms-motion-heart-change", 640, {
      key: "heart-change",
      cooldown: 95
    });
    return changed;
  };

  const protocol = (target) => restartClass(target, "is-gms-motion-protocol-change", 820, {
    key: "protocol",
    cooldown: 180
  });

  const sync = (target = root) => {
    const changed = restartClass(target, "is-gms-motion-sync", 760, { key: "sync", cooldown: 600 });
    if (changed) scan("sync", { cooldown: 1400 });
    return changed;
  };

  const reveal = (elements) => {
    if (!shouldRunMotion(root)) return false;
    for (const [index, element] of [...elements].slice(0, 12).entries()) {
      if (!element?.animate) continue;
      const animation = element.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 260, delay: index * 24, easing: "cubic-bezier(.2,.8,.2,1)" });
      animations.add(animation);
      animation.finished?.then(() => animations.delete(animation), () => animations.delete(animation));
    }
    return true;
  };

  const stopAnimations = () => {
    if (shouldRunMotion(root)) return;
    for (const animation of animations) animation.cancel();
    animations.clear();
    scanner?.classList?.remove?.("is-active");
  };
  const media = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  media?.addEventListener?.("change", stopAnimations);
  globalThis.document?.addEventListener?.("visibilitychange", stopAnimations);
  removers.push(() => media?.removeEventListener?.("change", stopAnimations), () => globalThis.document?.removeEventListener?.("visibilitychange", stopAnimations));

  const wireAccordions = () => {
    for (const details of root.querySelectorAll("details")) {
      const onToggle = () => {
        if (!details.open) return;
        restartClass(details, "is-gms-motion-accordion-open", 520, {
          key: `accordion:${details.dataset?.profileGroup || details.dataset?.masterGroup || "details"}`,
          cooldown: 100
        });
      };
      details.addEventListener?.("toggle", onToggle);
      removers.push(() => details.removeEventListener?.("toggle", onToggle));
    }
  };

  const observeSelectors = () => {
    if (typeof globalThis.MutationObserver !== "function") return;
    const selectors = [...root.querySelectorAll(".gms-smart-selector")];
    if (!selectors.length) return;
    observer = new globalThis.MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const selector = mutation.target;
        if (mutation.attributeName !== "data-open" || selector?.dataset?.open !== "true") continue;
        restartClass(selector, "is-gms-motion-selector-open", 440, {
          key: `selector:${selector.dataset?.smartSelector || "selector"}`,
          cooldown: 80
        });
      }
    });
    for (const selector of selectors) observer.observe(selector, { attributes: true, attributeFilter: ["data-open"] });
  };

  wireAccordions();
  observeSelectors();
  if (boot) later(bootShell, 0);
  scheduleAmbientScan(AMBIENT_FIRST_DELAY_MS);

  return Object.freeze({
    scan,
    reveal,
    boot: bootShell,
    transition,
    section,
    relationship,
    protocol,
    sync,
    destroy() {
      destroyed = true;
      for (const animation of animations) animation.cancel();
      animations.clear();
      for (const id of frames) globalThis.cancelAnimationFrame?.(id);
      frames.clear();
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const remove of removers.splice(0)) {
        try { remove(); } catch (_error) { /* no-op */ }
      }
      observer?.disconnect?.();
      observer = null;
      scanner?.remove?.();
      scanner = null;
      for (const className of [...(root.classList ?? [])]) {
        if (String(className).startsWith("is-gms-motion-")) root.classList.remove(className);
      }
    }
  });
}
