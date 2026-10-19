/** Event-driven motion for the GM workbench. No ambient timers, particles, or layout animation. */
export function wireMasterMotion(root, { boot = false } = {}) {
  const effects = new Map(),
    removers = [];
  const view = root.ownerDocument?.defaultView;
  const media = view?.matchMedia?.("(prefers-reduced-motion: reduce)");
  let destroyed = false;
  const heading = root.querySelector(".gms-workbench-heading");
  const trace = heading && root.ownerDocument?.createElement?.("span");
  if (trace) {
    trace.className = "gms-master-target-trace";
    trace.setAttribute("aria-hidden", "true");
    heading.append(trace);
  }
  const play = (node, frames, duration = 180) => {
    if (
      destroyed ||
      media?.matches ||
      !node?.animate ||
      node.closest?.("[hidden]")
    )
      return;
    effects.get(node)?.cancel();
    const effect = node.animate(frames, {
      duration,
      easing: "cubic-bezier(.2,.8,.2,1)",
      fill: "none",
    });
    effects.set(node, effect);
    const release = () => {
      if (effects.get(node) === effect) effects.delete(node);
      effect.onfinish = effect.oncancel = null;
      effect.cancel();
    };
    effect.onfinish = release;
    effect.oncancel = () => {
      if (effects.get(node) === effect) effects.delete(node);
    };
  };
  const feedback = (node) =>
    play(
      node,
      [
        { transform: "scale(.985)", opacity: 0.85 },
        { transform: "scale(1)", opacity: 1 },
      ],
      220,
    );
  const section = (node) =>
    play(
      node,
      [
        { transform: "translateX(8px)", opacity: 0.88 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      200,
    );
  const acquire = () =>
    play(
      trace,
      [
        { transform: "translateX(-20%) scaleX(.3)", opacity: 0 },
        { transform: "translateX(70%) scaleX(1)", opacity: 0.9, offset: 0.5 },
        { transform: "translateX(190%) scaleX(.3)", opacity: 0 },
      ],
      560,
    );
  const navigate = () => {
    const selected = root.querySelector(
      '[data-master-section-choice][data-active="true"]',
    );
    if (selected) feedback(selected);
  };
  const handle = (event) => {
    const button = event.target.closest?.("button,summary");
    if (button && !button.disabled && !button.closest("[data-grid-cell]"))
      feedback(button);
  };
  root.addEventListener?.("click", handle);
  removers.push(() => root.removeEventListener?.("click", handle));
  const reduce = () => {
    if (media?.matches) for (const effect of effects.values()) effect.cancel();
  };
  media?.addEventListener?.("change", reduce);
  removers.push(() => media?.removeEventListener?.("change", reduce));
  root.dataset.gmsMasterMotion = "workbench";
  if (boot) {
    section(root.querySelector('[data-master-section-panel="relationship"]'));
    acquire();
  }
  return {
    feedback,
    section,
    navigate,
    transition() {
      section(root.querySelector("[data-master-section-panel]:not([hidden])"));
      acquire();
      for (const row of [...root.querySelectorAll("[data-grid-row]")].slice(
        0,
        6,
      ))
        play(
          row,
          [
            { transform: "translateY(4px)", opacity: 0.9 },
            { transform: "translateY(0)", opacity: 1 },
          ],
          200,
        );
    },
    relationship: feedback,
    protocol: feedback,
    sync() {
      feedback(root.querySelector("[data-master-save-state]"));
    },
    destroy() {
      destroyed = true;
      for (const effect of effects.values()) effect.cancel();
      effects.clear();
      for (const remove of removers) remove();
      trace?.remove();
      delete root.dataset.gmsMasterMotion;
    },
  };
}
