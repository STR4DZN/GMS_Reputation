// This companion lives outside the Foundry window so neither its clipping nor
// its dossier layout can be affected by opening the navigation.
const PANEL_WIDTH = 240;
const MIN_PANEL_WIDTH = 156;
const TAB_WIDTH = 32;

export function playerNavigationPosition(rect, open = true) {
  const available = Math.max(0, Number(rect.left) - 8);
  const width = open ? Math.min(PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, available)) : TAB_WIDTH;
  return { left: Number(rect.left) - width, top: Number(rect.top), width, height: Number(rect.height) };
}

export function mountPlayerProfileNavigation(app, library) {
  const root = app?.element?.[0] ?? app?.element;
  const doc = root?.ownerDocument;
  if (!library || !root?.getBoundingClientRect || !doc?.body) return null;
  const view = doc.defaultView ?? globalThis;
  const element = doc.createElement("aside");
  element.className = "gms-player-profile-navigation";
  element.setAttribute("aria-label", "Navegação de NPCs");
  element.append(library);
  doc.body.append(element);
  let frame = null;
  let destroyed = false;

  const update = () => {
    frame = null;
    if (destroyed) return;
    const rect = root.getBoundingClientRect();
    const style = view.getComputedStyle(root);
    const content = root.querySelector(".window-content");
    element.hidden = !root.isConnected || root.classList.contains("minimized")
      || style.display === "none" || style.visibility === "hidden"
      || (content && view.getComputedStyle(content).display === "none");
    const position = playerNavigationPosition(rect, library.open);
    Object.assign(element.style, {
      left: `${position.left}px`, top: `${position.top}px`,
      width: `${position.width}px`, height: `${position.height}px`,
      zIndex: style.zIndex === "auto" ? "100" : style.zIndex
    });
  };
  const schedule = () => {
    if (!destroyed && frame === null) frame = view.requestAnimationFrame(update);
  };
  // When there is spare room, move the whole window just enough to expose its
  // companion. Its width and height are never changed to accommodate the panel.
  const reveal = () => {
    if (library.open && typeof app.setPosition === "function") {
      const rect = root.getBoundingClientRect();
      const missing = MIN_PANEL_WIDTH + 8 - rect.left;
      if (missing > 0 && view.innerWidth - rect.right >= missing) {
        app.setPosition({ left: rect.left + missing });
      }
    }
    update();
  };
  const toggle = () => { if (library.open) reveal(); else update(); };
  const focus = () => { app.bringToFront?.(); update(); };
  const resizeObserver = view.ResizeObserver ? new view.ResizeObserver(schedule) : null;
  const mutationObserver = view.MutationObserver ? new view.MutationObserver(schedule) : null;
  resizeObserver?.observe(root);
  mutationObserver?.observe(root, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
  view.addEventListener("resize", schedule);
  library.addEventListener("toggle", toggle);
  element.addEventListener("pointerdown", focus);
  reveal();

  return {
    element,
    get scrollTop() { return library.querySelector(".gms-profile-library__list")?.scrollTop ?? 0; },
    destroy() {
      destroyed = true;
      if (frame !== null) view.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      view.removeEventListener("resize", schedule);
      library.removeEventListener("toggle", toggle);
      element.removeEventListener("pointerdown", focus);
      element.remove();
    }
  };
}
