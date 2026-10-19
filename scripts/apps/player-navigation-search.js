export function normalizeNpcSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}
export function matchesNpcSearch(value, query) {
  const haystack = normalizeNpcSearch(value);
  return normalizeNpcSearch(query)
    .split(" ")
    .every((token) => haystack.includes(token));
}
/** Filters only the external NPC library. It never changes the profile's roster or world data. */
export function wirePlayerNavigationSearch(
  library,
  { query = "", onChange = () => {}, onVisibilityChange = () => {} } = {},
) {
  const input = library?.querySelector("[data-player-npc-search]");
  if (!input) return null;
  const clear = library.querySelector("[data-player-npc-search-clear]"),
    status = library.querySelector("[data-player-npc-search-status]"),
    empty = library.querySelector("[data-player-npc-search-empty]");
  const groups = [...library.querySelectorAll("[data-profile-group]")];
  const entries = groups.map((group) => ({
    group,
    buttons: [...group.querySelectorAll("[data-player-profile-choice]")].map(
      (button) => ({
        button,
        keywords: normalizeNpcSearch(
          `${group.dataset.playerNpcGroupName} ${button.dataset.playerNpcKeywords}`,
        ),
      }),
    ),
  }));
  const total = entries.reduce((sum, entry) => sum + entry.buttons.length, 0);
  let previousOpen = null;
  const apply = () => {
    const active = Boolean(normalizeNpcSearch(input.value));
    if (active && !previousOpen)
      previousOpen = new Map(groups.map((group) => [group, group.open]));
    library.dataset.gmsNpcSearchActive = String(active);
    let found = 0;
    for (const { group, buttons } of entries) {
      let count = 0;
      for (const { button, keywords } of buttons) {
        const match = matchesNpcSearch(keywords, input.value);
        button.hidden = !match;
        if (match) count++;
      }
      group.hidden = count === 0;
      if (active && count) group.open = true;
      else if (!active && previousOpen) group.open = previousOpen.get(group);
      found += count;
    }
    if (!active) previousOpen = null;
    clear.hidden = !input.value;
    status.textContent = active
      ? `${found} de ${total} NPCs`
      : `${total} NPCs disponíveis`;
    empty.hidden = found > 0;
    onChange(input.value);
    onVisibilityChange();
  };
  const handleInput = () => {
    const list = library.querySelector("[data-player-navigation-list]");
    if (list) list.scrollTop = 0;
    apply();
  };
  const reset = () => {
    input.value = "";
    apply();
    input.focus({ preventScroll: true });
  };
  input.value = query;
  apply();
  input.addEventListener("input", handleInput);
  clear.addEventListener("click", reset);
  return {
    clear: reset,
    destroy() {
      input.removeEventListener("input", handleInput);
      clear.removeEventListener("click", reset);
    },
  };
}
