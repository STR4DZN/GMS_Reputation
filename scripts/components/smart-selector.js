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

/**
 * Controller interativo para o Smart Selector 2 com navegação por teclado e busca rápida.
 */
export function wireSmartSelector(root, { onSelect = null } = {}) {
  if (!root?.querySelector) return { destroy() {} };

  const trigger = root.querySelector("[data-smart-selector-toggle]");
  const popover = root.querySelector("[data-smart-selector-popover]");
  const searchInput = root.querySelector("[data-smart-selector-search]");
  const optionsList = root.querySelector(".gms-smart-selector__options");
  const emptyMessage = root.querySelector("[data-smart-selector-empty]");
  const options = [...(root.querySelectorAll("[data-smart-selector-option]") ?? [])];

  let isOpen = false;

  function setOpen(open) {
    isOpen = Boolean(open);
    root.dataset.open = String(isOpen);
    trigger?.setAttribute("aria-expanded", String(isOpen));
    if (popover) popover.hidden = !isOpen;

    if (isOpen) {
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
        filter("");
      } else {
        const selected = options.find((o) => o.dataset.selected === "true") ?? options[0];
        selected?.focus();
      }
    }
  }

  function filter(query) {
    const q = normalizeSearch(query);
    let visibleCount = 0;

    for (const opt of options) {
      const searchData = opt.dataset.smartSelectorSearch || "";
      const matches = !q || searchData.includes(q);
      opt.hidden = !matches;
      if (matches) visibleCount++;
    }

    if (emptyMessage) {
      emptyMessage.hidden = visibleCount > 0;
    }
  }

  function handleTriggerClick(e) {
    e.stopPropagation();
    setOpen(!isOpen);
  }

  function handleOptionClick(e) {
    const btn = e.target.closest("[data-smart-selector-option]");
    if (!btn || btn.disabled) return;
    const value = btn.dataset.smartSelectorOption;

    for (const opt of options) {
      const isSel = opt === btn;
      opt.dataset.selected = String(isSel);
      opt.setAttribute("aria-selected", String(isSel));
    }

    root.dataset.value = value;
    setOpen(false);
    trigger?.focus();

    if (typeof onSelect === "function") {
      onSelect(value);
    }
  }

  function handleSearchInput(e) {
    filter(e.target.value);
  }

  function handleKeydown(e) {
    if (!isOpen) {
      if (["Enter", " ", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      trigger?.focus();
      return;
    }

    if (["ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      const visible = options.filter((o) => !o.hidden && !o.disabled);
      if (!visible.length) return;

      const currentFocused = document.activeElement;
      const currentIndex = visible.indexOf(currentFocused);
      let nextIndex = 0;

      if (e.key === "ArrowDown") {
        nextIndex = currentIndex < visible.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : visible.length - 1;
      }

      visible[nextIndex]?.focus();
    }
  }

  function handleDocumentClick(e) {
    if (isOpen && !root.contains(e.target)) {
      setOpen(false);
    }
  }

  trigger?.addEventListener("click", handleTriggerClick);
  optionsList?.addEventListener("click", handleOptionClick);
  searchInput?.addEventListener("input", handleSearchInput);
  root.addEventListener("keydown", handleKeydown);
  document.addEventListener("click", handleDocumentClick);

  return {
    destroy() {
      trigger?.removeEventListener("click", handleTriggerClick);
      optionsList?.removeEventListener("click", handleOptionClick);
      searchInput?.removeEventListener("input", handleSearchInput);
      root.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("click", handleDocumentClick);
    }
  };
}
