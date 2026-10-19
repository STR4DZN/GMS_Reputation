/** Native choreography for the cyan/violet console. See docs/MOTION_DESIGN.md. */
export const MOTION_TIMING = Object.freeze({
  feedback: 160, enter: 320, emphasis: 420, step: 32, maxDelay: 192,
  ease: "cubic-bezier(0.2, 0, 0.38, 0.9)",
  entranceEase: "cubic-bezier(0, 0, 0.3, 1)"
});

const ROWS = ".gms-reputation-player-card, .gms-master-panel__subject-list > article, .gms-master-profile-entry, .gms-master-panel__history > article, .gms-master-cleanup__row, .gms-npc-navigation__profile";
const SHELL = ".gms-player-dashboard__header, .gms-master-panel__selection-bus, .gms-master-panel__savebar, .gms-master-panel__nav, .gms-player-dashboard__focal, [data-master-section-panel]:not([hidden]), .gms-subject-detail__header, .gms-subject-detail__hero, .gms-subject-detail__section";
const CONTROL = "button, summary, [data-player-card][tabindex]";

export function wireChoreography(root) {
  const animations = new Map();
  const seen = new WeakSet();
  const decorations = new Set();
  const removers = [];
  let revealObserver;
  let stateObserver;
  let destroyed = false;
  root.dataset.gmsMotionEdition = "70.10";

  const nodes = (target, selector) => [...(target?.querySelectorAll?.(selector) ?? [])];
  const visible = (node) => !node.closest?.("[hidden]") && Boolean(node.getClientRects?.().length);

  // Cancel only effects owned by this controller, including on rapid repeated input.
  const play = (node, frames, { duration = MOTION_TIMING.enter, delay = 0, ease = MOTION_TIMING.ease } = {}) => {
    if (destroyed || !node?.animate || !visible(node)) return false;
    animations.get(node)?.cancel();
    node.dataset.gmsMotionManaged = "true";
    const effect = node.animate(frames, {
      duration, delay: Math.min(MOTION_TIMING.maxDelay, Math.max(0, delay)),
      easing: ease, fill: "backwards"
    });
    animations.set(node, effect);
    const release = () => {
      if (animations.get(node) === effect) animations.delete(node);
      effect.onfinish = effect.oncancel = null;
      effect.cancel();
    };
    effect.onfinish = release;
    effect.oncancel = () => { if (animations.get(node) === effect) animations.delete(node); };
    return true;
  };

  const entrance = (node, order = 0, axis = "y") => play(node, [
    { opacity: .25, translate: axis === "x" ? "8px 0" : "0 8px" },
    { opacity: 1, translate: "0 0" }
  ], { delay: order * MOTION_TIMING.step, ease: MOTION_TIMING.entranceEase });

  const revealRows = (target = root) => {
    const rows = nodes(target, ROWS).filter(node => !seen.has(node) && visible(node));
    if (typeof globalThis.IntersectionObserver === "function") {
      revealObserver ??= new globalThis.IntersectionObserver(entries => {
        let order = 0;
        for (const { target: node, isIntersecting } of entries) {
          if (!isIntersecting || !visible(node)) continue;
          revealObserver.unobserve(node);
          if (seen.has(node)) continue;
          seen.add(node);
          entrance(node, order++);
        }
      }, { threshold: .05 });
      for (const node of rows) revealObserver.observe(node);
    } else {
      rows.forEach((node, order) => { seen.add(node); entrance(node, order); });
    }
  };

  const enter = (target = root) => {
    nodes(target, SHELL).filter(visible).forEach((node, order) => entrance(node, order));
    revealRows(target);
  };

  const section = (panel, order = 0) => {
    entrance(panel, order);
    revealRows(panel);
  };

  const transition = (type, target = root) => {
    if (target !== root && target.matches?.(".gms-reputation-focal-profile")) entrance(target);
    else enter(target);
    if (type === "subject") {
      nodes(root, ".gms-master-character-editor__head, .gms-reputation-portrait-editor__preview").filter(visible).forEach(node => entrance(node));
    }
  };

  const relationship = (target) => {
    nodes(target, ".gms-reputation-player-card__score > strong, [data-master-score-preview], .gms-subject-detail__score > strong").forEach(node => play(node, [
      { opacity: .5, scale: ".94" }, { opacity: 1, scale: "1.035", offset: .55 }, { opacity: 1, scale: "1" }
    ], { duration: MOTION_TIMING.emphasis }));
    nodes(target, '.gms-reputation-heart:not([data-heart-state="empty"])').forEach((node, order) => play(node, [
      { opacity: .5, scale: ".88" }, { opacity: 1, scale: "1.08", offset: .5 }, { opacity: 1, scale: "1" }
    ], { duration: 300, delay: order * 18 }));
  };

  const protocol = (target) => {
    nodes(target, ".gms-reputation-player-card__special-sigil, .gms-subject-detail__special-sigil, .gms-master-panel__special-readout img, .gms-master-panel__protocol-derived").forEach(node => play(node, [
      { opacity: .35, scale: ".92" }, { opacity: 1, scale: "1.04", offset: .6 }, { opacity: 1, scale: "1" }
    ], { duration: MOTION_TIMING.emphasis }));
  };

  const sync = () => {
    nodes(root, ".gms-master-panel__save-state, [data-player-live-update]").forEach(node => play(node, [
      { opacity: .35 }, { opacity: 1 }
    ], { duration: 240 }));
  };

  // One decorative rail per touched control; it never participates in layout.
  const controlFrom = (event) => {
    const control = event.target?.closest?.(CONTROL);
    return control && root.contains?.(control) && !control.disabled ? control : null;
  };
  const prepareControl = (event) => {
    const control = controlFrom(event);
    if (!control || control.querySelector?.(":scope > .gms-motion-control-rail")) return control;
    const rail = root.ownerDocument.createElement("span");
    rail.className = "gms-motion-control-rail";
    rail.setAttribute("aria-hidden", "true");
    control.append(rail);
    decorations.add(rail);
    return control;
  };
  const feedback = (event) => {
    const control = prepareControl(event);
    const rail = control?.querySelector?.(":scope > .gms-motion-control-rail");
    play(rail, [{ opacity: 1, scale: "1 1" }, { opacity: .35, scale: ".92 1" }], { duration: MOTION_TIMING.feedback });
  };
  for (const [event, handler] of [["pointerover", prepareControl], ["focusin", prepareControl], ["click", feedback]]) {
    root.addEventListener?.(event, handler);
    removers.push(() => root.removeEventListener?.(event, handler));
  }

  for (const details of nodes(root, "details")) {
    const onToggle = () => {
      if (!details.open) return;
      const body = [...details.children].find(node => node.tagName !== "SUMMARY");
      if (body) entrance(body, 0, details.classList.contains("gms-npc-navigation") ? "x" : "y");
      revealRows(details);
    };
    details.addEventListener("toggle", onToggle);
    removers.push(() => details.removeEventListener("toggle", onToggle));
  }

  if (typeof globalThis.MutationObserver === "function") {
    stateObserver = new globalThis.MutationObserver(mutations => {
      for (const { target, attributeName } of mutations) {
        if (attributeName === "data-open" && target.dataset.open === "true") {
          entrance(target.querySelector(".gms-smart-selector__popover"));
          revealRows(target);
        }
        if (attributeName === "data-master-save-state") sync();
      }
    });
    for (const node of nodes(root, ".gms-smart-selector, [data-master-save-state]")) {
      stateObserver.observe(node, { attributes: true, attributeFilter: ["data-open", "data-master-save-state"] });
    }
  }

  revealRows();
  return Object.freeze({
    enter, section, transition, relationship, protocol, sync,
    destroy() {
      destroyed = true;
      revealObserver?.disconnect();
      stateObserver?.disconnect();
      for (const effect of animations.values()) { effect.onfinish = effect.oncancel = null; effect.cancel(); }
      animations.clear();
      for (const remove of removers) remove();
      for (const rail of decorations) rail.remove();
      decorations.clear();
      for (const node of nodes(root, "[data-gms-motion-managed]")) delete node.dataset.gmsMotionManaged;
      delete root.dataset.gmsMotionEdition;
    }
  });
}
