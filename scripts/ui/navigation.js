/** Session-only navigation. Never writes a campaign setting. */
export class NavigationTrail {
  constructor(initial = {}, { limit = 40 } = {}) {
    this.limit = Math.max(2, limit);
    this.entries = [{ ...initial }];
    this.index = 0;
  }
  get current() { return { ...this.entries[this.index] }; }
  get canBack() { return this.index > 0; }
  get canForward() { return this.index < this.entries.length - 1; }
  visit(next) {
    const value = { ...this.current, ...next };
    if (JSON.stringify(value) === JSON.stringify(this.current)) return this.current;
    this.entries.splice(this.index + 1);
    this.entries.push(value);
    if (this.entries.length > this.limit) this.entries.shift();
    this.index = this.entries.length - 1;
    return this.current;
  }
  back() { if (this.canBack) this.index--; return this.current; }
  forward() { if (this.canForward) this.index++; return this.current; }
}

export function adjacentId(items = [], currentId = "", direction = 1) {
  const index = items.findIndex((item) => String(item.id) === String(currentId));
  return items[index + Math.sign(direction)]?.id ?? null;
}

function searchable(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function filterNavigationItems(items = [], query = "", limit = 30) {
  const words = searchable(query).trim().split(/\s+/).filter(Boolean);
  return items.filter((item) => words.every((word) => searchable(`${item.label} ${item.description ?? ""} ${item.group ?? ""}`).includes(word))).slice(0, limit);
}

/** Native dialog provides focus trapping and Escape without global keyboard listeners. */
export function wireNavigationPalette(root, { items = [], onNavigate = null } = {}) {
  const dialog = root?.querySelector?.("[data-navigation-dialog]");
  const input = dialog?.querySelector?.("[data-navigation-query]");
  const results = dialog?.querySelector?.("[data-navigation-results]");
  if (!dialog || !input || !results) return { open() {}, close() {}, destroy() {} };
  const doc = root.ownerDocument ?? globalThis.document;
  const removers = [];
  let previousFocus = null;
  let selectedIndex = 0;
  let matches = [];
  const on = (node, type, fn) => {
    node?.addEventListener?.(type, fn);
    removers.push(() => node?.removeEventListener?.(type, fn));
  };
  const updateSelection = () => {
    const buttons = [...results.querySelectorAll("[data-navigation-result]")];
    buttons.forEach((button, index) => {
      button.dataset.active = String(index === selectedIndex);
      button.setAttribute("aria-selected", String(index === selectedIndex));
    });
    input.setAttribute("aria-activedescendant", buttons[selectedIndex]?.id ?? "");
    buttons[selectedIndex]?.scrollIntoView?.({ block: "nearest" });
  };
  const render = () => {
    matches = filterNavigationItems(items, input.value);
    selectedIndex = 0;
    results.replaceChildren();
    for (const [index, item] of matches.entries()) {
      const button = doc.createElement("button");
      button.type = "button";
      button.id = `${dialog.id}-result-${index}`;
      button.dataset.navigationResult = String(index);
      button.setAttribute("role", "option");
      const group = doc.createElement("small");
      group.textContent = item.group;
      const label = doc.createElement("strong");
      label.textContent = item.label;
      const description = doc.createElement("span");
      description.textContent = item.description ?? "";
      button.append(group, label, description);
      results.append(button);
    }
    const empty = dialog.querySelector("[data-navigation-empty]");
    if (empty) empty.hidden = matches.length > 0;
    const count = dialog.querySelector("[data-navigation-result-count]");
    if (count) count.textContent = `${matches.length} destino${matches.length === 1 ? "" : "s"}`;
    updateSelection();
  };
  const close = () => {
    if (dialog.open) dialog.close();
    previousFocus?.focus?.();
  };
  const open = () => {
    previousFocus = doc.activeElement;
    input.value = "";
    dialog.showModal();
    render();
    input.focus();
  };
  const choose = async (index) => {
    const item = matches[index];
    if (!item) return;
    close();
    try { await onNavigate?.(item.target); }
    catch (error) { console.warn("GMS Reputation | Navigation failed.", error); }
  };
  for (const trigger of root.querySelectorAll("[data-navigation-open]")) on(trigger, "click", open);
  on(dialog.querySelector("[data-navigation-close]"), "click", close);
  on(input, "input", render);
  on(input, "keydown", (event) => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      selectedIndex = matches.length ? (selectedIndex + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length : 0;
      updateSelection();
    } else if (event.key === "Enter") { event.preventDefault(); choose(selectedIndex); }
  });
  on(results, "click", (event) => {
    const button = event.target.closest?.("[data-navigation-result]");
    if (button) choose(Number(button.dataset.navigationResult));
  });
  on(root, "keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (dialog.open) close(); else open();
    }
  });
  on(dialog, "click", (event) => { if (event.target === dialog) close(); });
  return { open, close, destroy() { if (dialog.open) dialog.close(); removers.splice(0).forEach((remove) => remove()); } };
}
