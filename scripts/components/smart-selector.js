function text(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function buildSmartSelectorContext({
  id,
  label,
  value = "",
  items = [],
  searchPlaceholder = "Buscar…",
  emptyText = "Nenhum resultado.",
  searchable = null,
  icon = "fa-chevron-down"
} = {}) {
  const normalizedItems = items.map((item, index) => {
    const primary = text(item?.primary ?? item?.label, "Sem identificação");
    const secondary = text(item?.secondary);
    const badge = text(item?.badge);
    const image = text(item?.image);
    const itemValue = text(item?.value, String(index));
    return Object.freeze({
      value: itemValue,
      primary,
      secondary,
      badge,
      image,
      disabled: Boolean(item?.disabled),
      searchText: normalizeSearch(item?.searchText ?? [primary, secondary, badge].filter(Boolean).join(" ")),
      selected: itemValue === String(value)
    });
  });

  const selected = normalizedItems.find((item) => item.selected) ?? normalizedItems.find((item) => !item.disabled) ?? null;
  const finalItems = normalizedItems.map((item) => Object.freeze({ ...item, selected: item.value === selected?.value }));

  return Object.freeze({
    id: text(id, "selector"),
    label: text(label, "Selecionar"),
    value: selected?.value ?? "",
    current: selected ?? Object.freeze({ primary: "Nenhum disponível", secondary: "", badge: "", image: "" }),
    items: Object.freeze(finalItems),
    searchPlaceholder: text(searchPlaceholder, "Buscar…"),
    emptyText: text(emptyText, "Nenhum resultado."),
    searchable: searchable == null ? finalItems.length >= 6 : Boolean(searchable),
    icon: text(icon, "fa-chevron-down"),
    count: finalItems.length
  });
}

export function wireSmartSelector(root, {
  onSelect = null,
  closeOnSelect = true
} = {}) {
  if (!root?.querySelector) return Object.freeze({ open() {}, close() {}, destroy() {} });

  const toggle = root.querySelector("[data-smart-selector-toggle]");
  const popover = root.querySelector("[data-smart-selector-popover]");
  const search = root.querySelector("[data-smart-selector-search]");
  const empty = root.querySelector("[data-smart-selector-empty]");
  const options = [...root.querySelectorAll("[data-smart-selector-option]")];
  const currentPrimary = root.querySelector("[data-smart-selector-current-primary]");
  const currentSecondary = root.querySelector("[data-smart-selector-current-secondary]");
  const currentBadge = root.querySelector("[data-smart-selector-current-badge]");
  const currentImage = root.querySelector("[data-smart-selector-current-image]");
  const listeners = [];
  let opened = false;

  const listen = (target, eventName, handler, optionsValue) => {
    if (!target?.addEventListener) return;
    target.addEventListener(eventName, handler, optionsValue);
    listeners.push(() => target.removeEventListener(eventName, handler, optionsValue));
  };

  const visibleOptions = () => options.filter((option) => !option.hidden && option.getAttribute("aria-disabled") !== "true");

  const setOpen = (next, { focusSearch = true } = {}) => {
    opened = Boolean(next);
    root.dataset.open = String(opened);
    toggle?.setAttribute?.("aria-expanded", String(opened));
    if (popover) popover.hidden = !opened;
    if (opened && focusSearch && search) queueMicrotask(() => search.focus?.());
  };

  const applyFilter = () => {
    const query = normalizeSearch(search?.value);
    let visible = 0;
    for (const option of options) {
      const haystack = normalizeSearch(option.dataset.smartSelectorSearch || option.textContent || "");
      option.hidden = Boolean(query) && !haystack.includes(query);
      if (!option.hidden) visible += 1;
    }
    if (empty) empty.hidden = visible > 0;
  };

  const focusRelative = (direction) => {
    const visible = visibleOptions();
    if (!visible.length) return;
    const active = globalThis.document?.activeElement;
    let index = visible.indexOf(active);
    if (direction === "home") index = 0;
    else if (direction === "end") index = visible.length - 1;
    else index = (index + Number(direction) + visible.length) % visible.length;
    visible[index]?.focus?.();
  };

  const selectOption = async (option) => {
    if (!option || option.getAttribute("aria-disabled") === "true") return;
    const value = String(option.dataset.smartSelectorOption ?? "");
    const previous = String(root.dataset.value ?? "");
    if (!value) return;

    for (const item of options) {
      const selected = item === option;
      item.dataset.selected = String(selected);
      item.setAttribute("aria-selected", String(selected));
    }
    root.dataset.value = value;

    const primary = option.querySelector("[data-smart-selector-option-primary]")?.textContent?.trim() ?? "";
    const secondary = option.querySelector("[data-smart-selector-option-secondary]")?.textContent?.trim() ?? "";
    const badge = option.querySelector("[data-smart-selector-option-badge]")?.textContent?.trim() ?? "";
    const image = option.querySelector("img")?.getAttribute?.("src") ?? "";
    if (currentPrimary) currentPrimary.textContent = primary;
    if (currentSecondary) { currentSecondary.textContent = secondary; currentSecondary.hidden = !secondary; }
    if (currentBadge) { currentBadge.textContent = badge; currentBadge.hidden = !badge; }
    if (currentImage) {
      if (image) { currentImage.setAttribute("src", image); currentImage.hidden = false; }
      else currentImage.hidden = true;
    }

    if (closeOnSelect) setOpen(false, { focusSearch: false });
    toggle?.focus?.();
    if (value !== previous && typeof onSelect === "function") await onSelect(value, option);
  };

  listen(toggle, "click", () => setOpen(!opened));
  listen(toggle, "keydown", (event) => {
    if (event.key === "Escape") { setOpen(false, { focusSearch: false }); return; }
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (!opened) setOpen(true, { focusSearch: false });
      queueMicrotask(() => {
        const selected = options.find((option) => option.dataset.selected === "true" && !option.hidden);
        (selected ?? visibleOptions()[0])?.focus?.();
      });
    }
  });

  listen(search, "input", applyFilter);
  listen(search, "keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false, { focusSearch: false }); toggle?.focus?.(); }
    if (event.key === "ArrowDown") { event.preventDefault(); visibleOptions()[0]?.focus?.(); }
  });

  for (const option of options) {
    listen(option, "click", () => selectOption(option));
    listen(option, "keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false, { focusSearch: false }); toggle?.focus?.(); return; }
      if (event.key === "ArrowDown") { event.preventDefault(); focusRelative(1); }
      if (event.key === "ArrowUp") { event.preventDefault(); focusRelative(-1); }
      if (event.key === "Home") { event.preventDefault(); focusRelative("home"); }
      if (event.key === "End") { event.preventDefault(); focusRelative("end"); }
    });
  }

  const outsidePointer = (event) => {
    if (!opened || root.contains?.(event.target)) return;
    setOpen(false, { focusSearch: false });
  };
  listen(globalThis.document, "pointerdown", outsidePointer, true);

  applyFilter();
  setOpen(false, { focusSearch: false });

  return Object.freeze({
    open: () => setOpen(true),
    close: () => setOpen(false, { focusSearch: false }),
    destroy() {
      for (const remove of listeners.splice(0)) {
        try { remove(); } catch (_error) { /* no-op */ }
      }
    }
  });
}
