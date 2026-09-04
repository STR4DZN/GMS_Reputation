export function wireTablistKeyboard(root, {
  tabSelector = '[role="tab"]',
  activate = (tab) => tab?.click?.()
} = {}) {
  if (!root?.querySelectorAll) return { destroy() {} };
  const tabs = [...root.querySelectorAll(tabSelector)];
  const listeners = [];
  const on = (node, event, handler) => {
    node?.addEventListener?.(event, handler);
    listeners.push(() => node?.removeEventListener?.(event, handler));
  };
  for (const tab of tabs) {
    on(tab, "keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index = Math.max(0, tabs.indexOf(tab));
      let nextIndex = index;
      if (["ArrowRight", "ArrowDown"].includes(event.key)) nextIndex = (index + 1) % tabs.length;
      if (["ArrowLeft", "ArrowUp"].includes(event.key)) nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      const next = tabs[nextIndex];
      next?.focus?.();
      activate(next);
    });
  }
  return Object.freeze({ destroy() { for (const remove of listeners.splice(0)) remove(); } });
}

export function wireApplicationAccessibility(root, {
  onEscape = null,
  tablistRoot = root
} = {}) {
  if (!root?.addEventListener) return { destroy() {} };
  const listeners = [];
  const on = (node, event, handler, options) => {
    node?.addEventListener?.(event, handler, options);
    listeners.push(() => node?.removeEventListener?.(event, handler, options));
  };
  on(root, "keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    const active = globalThis.document?.activeElement;
    if (active?.closest?.("[role='dialog'][open],dialog[open]")) return;
    onEscape?.(event);
  });
  const tabs = wireTablistKeyboard(tablistRoot);
  return Object.freeze({
    destroy() {
      tabs.destroy();
      for (const remove of listeners.splice(0)) remove();
    }
  });
}
