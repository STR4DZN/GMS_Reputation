import { loadWorldState } from "../../persistence/world-store.js";
import { canUser, MODULE_CAPABILITY } from "../../persistence/permissions.js";
import { normalizeRelationship } from "../../core/score.js";
import { computeRelationshipCandidate } from "../../data/reputation-registry.js";
import {
  applyRelationshipGridEdits,
  relationshipKey,
  sameRelationshipValue,
} from "../../data/relationship-grid.js";
import { buildWorkbenchCell } from "../../application/queries/reputation-workbench-query.js";
import { notify } from "../application-compat.js";

/** Delegated events and bounded DOM updates. Drafts belong to the app, never to DOM nodes. */
export function wireReputationWorkbench(app, root, context) {
  const host = root.querySelector("[data-reputation-workbench]");
  if (!host) return { destroy() {} };
  const ui = app._workbenchState;
  const listeners = [];
  const timers = new Map();
  const scroll = host.querySelector("[data-grid-scroll]");
  if (scroll) {
    scroll.scrollTop = ui.scrollTop;
    scroll.scrollLeft = ui.scrollLeft;
  }
  const on = (node, event, fn, options) => {
    node?.addEventListener(event, fn, options);
    listeners.push(() => node?.removeEventListener(event, fn, options));
  };
  const canEdit = () =>
    canUser(globalThis.game?.user, MODULE_CAPABILITY.RELATIONSHIPS) &&
    app._saveController.status !== "saving" &&
    !app._saveController.pending.has("relationship") &&
    !root.querySelector("[data-grid-advanced]")?.open;
  const cells = new Map();
  for (const cell of host.querySelectorAll("[data-grid-cell]")) {
    const key = relationshipKey(
      cell.dataset.gridProfile,
      cell.dataset.gridSubject,
    );
    const list = cells.get(key) || [];
    list.push(cell);
    cells.set(key, list);
  }
  const getValue = (state, profileId, subjectId) =>
    ui.drafts.get(relationshipKey(profileId, subjectId))?.patch ??
    normalizeRelationship(
      state.profiles?.[profileId]?.relationships?.[subjectId],
    );
  const updateStatus = () => {
    const status = host.querySelector("[data-grid-status]");
    if (status)
      status.textContent = ui.drafts.size
        ? `${ui.drafts.size} relações editadas · salve para sincronizar`
        : "Sem alterações pendentes";
  };
  const queue = () => {
    if (!ui.drafts.size) {
      app._saveController.remove("reputation-grid");
      updateStatus();
      return;
    }
    const snapshot = new Map(ui.drafts);
    const reason = ui.reason;
    app._saveController.queue("reputation-grid", async () => {
      const result = await applyRelationshipGridEdits([...snapshot.values()], {
        reason,
      });
      for (const [key, entry] of snapshot)
        if (ui.drafts.get(key) === entry) ui.drafts.delete(key);
      return result;
    });
    updateStatus();
  };
  const renderCell = (state, profileId, subjectId, { animate = true } = {}) => {
    const profile = state.profiles?.[profileId],
      subject = state.subjects?.[subjectId];
    if (!profile || !subject) return;
    const model = buildWorkbenchCell(profile, subject, ui.drafts);
    for (const cell of cells.get(model.key) ?? []) {
      cell.dataset.dirty = String(model.dirty);
      cell.style.setProperty("--gms-grid-accent", model.accent);
      if (ui.view !== "matrix")
        cell
          .closest("[data-grid-row]")
          ?.style.setProperty("--gms-row-accent", model.accent);
      const input = cell.querySelector("[data-grid-score]");
      if (input) {
        input.value = String(model.score);
        input.max = String(model.limit);
      }
      const label = cell.querySelector("[data-grid-relation-label]");
      if (label) label.textContent = model.label;
      const special = cell.querySelector("[data-grid-special]");
      if (special) special.textContent = model.special;
      const pending = cell.querySelector("[data-grid-pending]");
      if (pending) {
        pending.hidden = !model.dirty;
        pending.textContent = model.changeText;
      }
      for (const button of cell.querySelectorAll("[data-grid-polarity]"))
        button.setAttribute(
          "aria-pressed",
          String(
            (button.dataset.gridPolarity === "negative") === model.negative,
          ),
        );
      for (const button of cell.querySelectorAll("[data-grid-protocol]"))
        button.setAttribute(
          "aria-pressed",
          String(model[button.dataset.gridProtocol]),
        );
      const hearts = cell.querySelector("[data-grid-hearts]");
      if (hearts) {
        while (hearts.children.length > model.limit)
          hearts.lastElementChild.remove();
        while (hearts.children.length < model.limit) {
          const heart = hearts.firstElementChild.cloneNode(true);
          heart.dataset.gridHeart = String(hearts.children.length + 1);
          heart.dataset.heartOrdinal = heart.dataset.gridHeart;
          heart.tabIndex = -1;
          heart.title = `Definir até ${heart.dataset.gridHeart} corações; metade esquerda vale meio`;
          hearts.append(heart);
        }
        hearts.dataset.specialState = model.specialState;
        for (let i = 0; i < model.hearts.length; i++) {
          const button = hearts.children[i],
            slot = model.hearts[i];
          button.dataset.heartState = slot.state;
          button.dataset.specialSlot = String(slot.specialSlot);
          button.dataset.specialKind = slot.specialKind || "";
          button.setAttribute("aria-label", `Definir ${slot.value} corações`);
        }
      }
      if (animate) app._masterMotion?.feedback(cell);
    }
  };
  const stage = (state, profileId, subjectId, patch) => {
    const profile = state.profiles?.[profileId];
    const roster = new Set(
      profile?.subjectIds ?? Object.keys(profile?.relationships ?? {}),
    );
    if (!profile || !roster.has(subjectId)) return false;
    const key = relationshipKey(profileId, subjectId);
    if (!context.workbench.canBulk && ui.drafts.size && !ui.drafts.has(key)) {
      notify(
        "warn",
        "Sua permissão permite editar uma relação por vez. Salve ou descarte a atual.",
      );
      return false;
    }
    const base = normalizeRelationship(profile.relationships?.[subjectId]);
    const previous = ui.drafts.get(key);
    const candidate = computeRelationshipCandidate(
      previous?.patch ?? base,
      patch,
    );
    if (sameRelationshipValue(base, candidate)) ui.drafts.delete(key);
    else
      ui.drafts.set(key, {
        profileId,
        subjectId,
        expectedRevision: previous?.expectedRevision ?? base.revision,
        patch: candidate,
      });
    renderCell(state, profileId, subjectId);
    return true;
  };
  const targetProfiles = () =>
    ui.view === "matrix"
      ? context.workbench.profiles
          .filter((p) => ui.selectedProfiles.has(p.id))
          .map((p) => p.id)
      : [app.profileId];
  const updateSelection = () => {
    const selected = ui.selectedSubjects.size;
    const batch = host.querySelector("[data-grid-batch]");
    if (batch) batch.hidden = !selected;
    const label = host.querySelector("[data-grid-selection-label]");
    if (label)
      label.textContent = `${selected} personagens × ${targetProfiles().length} NPCs`;
    const page = host.querySelector("[data-grid-select-page]");
    const ids = context.workbench.rows.map((r) => r.id);
    if (page) {
      page.checked =
        ids.length > 0 && ids.every((id) => ui.selectedSubjects.has(id));
      page.indeterminate =
        !page.checked && ids.some((id) => ui.selectedSubjects.has(id));
    }
    for (const row of host.querySelectorAll("[data-grid-row]"))
      row.dataset.selected = String(
        ui.selectedSubjects.has(row.dataset.gridRow),
      );
    for (const input of host.querySelectorAll("[data-grid-select-subject]"))
      input.checked = ui.selectedSubjects.has(input.dataset.gridSelectSubject);
    for (const control of host.querySelectorAll(
      "[data-grid-cell] button,[data-grid-cell] input",
    ))
      control.disabled =
        !context.workbench.canEdit || Boolean(selected) || !canEdit();
    for (const control of host.querySelectorAll(
      "[data-grid-batch-delta],[data-grid-batch-apply]",
    ))
      control.disabled = !targetProfiles().length || !context.workbench.canBulk;
  };
  const rerender = async (focusSelector = "") => {
    ui.scrollTop = scroll?.scrollTop ?? 0;
    ui.scrollLeft = scroll?.scrollLeft ?? 0;
    app._pendingMotion = "workbench";
    await app.render({ force: true });
    if (focusSelector) app.element?.querySelector(focusSelector)?.focus();
  };
  const search = (key, input, selector) => {
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        ui[key] = input.value;
        ui.page = 0;
        ui.columnPage = 0;
        ui.selectedSubjects.clear();
        rerender(selector);
      }, 180),
    );
  };
  const batchApply = (operation) => {
    if (!canEdit() || !canUser(globalThis.game?.user, MODULE_CAPABILITY.BULK))
      return;
    const state = loadWorldState();
    let count = 0;
    for (const profileId of targetProfiles())
      for (const subjectId of ui.selectedSubjects) {
        const current = getValue(state, profileId, subjectId);
        count += Number(
          stage(state, profileId, subjectId, {
            score:
              operation.mode === "delta"
                ? current.score + operation.value
                : operation.value,
          }),
        );
      }
    if (!count) {
      notify("warn", "A seleção não contém relações no elenco desses NPCs.");
      return;
    }
    queue();
    updateSelection();
    notify("info", `${count} relações ajustadas no rascunho. Confira e salve.`);
  };
  on(host, "click", async (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button.hasAttribute("data-grid-npc")) {
      ui.advancedOpen = false;
      app.profileId = button.dataset.gridNpc;
      ui.view = "roster";
      ui.page = 0;
      ui.selectedSubjects.clear();
      ui.scrollTop = 0;
      ui.scrollLeft = 0;
      await rerender();
      return;
    }
    if (button.hasAttribute("data-grid-view")) {
      ui.view = button.dataset.gridView;
      ui.page = 0;
      ui.selectedSubjects.clear();
      ui.scrollTop = 0;
      ui.scrollLeft = 0;
      await rerender(`[data-grid-view="${ui.view}"]`);
      return;
    }
    if (button.hasAttribute("data-grid-manage")) {
      app._setSection(root, button.dataset.gridManage);
      return;
    }
    if (button.hasAttribute("data-grid-character")) {
      app.subjectId = button.dataset.gridCharacter;
      app.activeSection = "characters";
      await rerender();
      return;
    }
    if (button.hasAttribute("data-grid-page")) {
      ui.page = context.workbench.page + Number(button.dataset.gridPage);
      ui.scrollTop = 0;
      await rerender("[data-grid-scroll]");
      return;
    }
    if (button.hasAttribute("data-grid-columns")) {
      ui.columnPage =
        context.workbench.columnPage + Number(button.dataset.gridColumns);
      ui.page = 0;
      ui.selectedSubjects.clear();
      ui.scrollLeft = 0;
      await rerender("[data-grid-scroll]");
      return;
    }
    if (button.hasAttribute("data-grid-clear-selection")) {
      ui.selectedSubjects.clear();
      updateSelection();
      return;
    }
    if (button.hasAttribute("data-grid-batch-delta")) {
      batchApply({
        mode: "delta",
        value: Number(button.dataset.gridBatchDelta),
      });
      return;
    }
    if (button.hasAttribute("data-grid-batch-apply")) {
      const input = host.querySelector("[data-grid-batch-value]");
      const value = Number(input.value);
      if (input.value === "" || !Number.isFinite(value)) {
        notify("warn", "Informe um valor válido.");
        return;
      }
      batchApply({
        mode: host.querySelector("[data-grid-batch-mode]").value,
        value,
      });
      return;
    }
    const cell = button.closest("[data-grid-cell]");
    if (!cell || !canEdit() || ui.selectedSubjects.size) return;
    const profileId = cell.dataset.gridProfile,
      subjectId = cell.dataset.gridSubject;
    const state = loadWorldState(),
      current = getValue(state, profileId, subjectId);
    let patch;
    if (button.hasAttribute("data-grid-delta"))
      patch = { score: current.score + Number(button.dataset.gridDelta) };
    if (button.hasAttribute("data-grid-protocol"))
      patch = {
        [button.dataset.gridProtocol]: !current[button.dataset.gridProtocol],
      };
    if (button.hasAttribute("data-grid-zero")) patch = { score: 0 };
    if (button.hasAttribute("data-grid-polarity"))
      patch = {
        score:
          button.dataset.gridPolarity === "negative"
            ? -Math.max(0.5, Math.abs(current.score))
            : Math.abs(current.score),
      };
    if (button.hasAttribute("data-grid-heart")) {
      const box = button.getBoundingClientRect();
      const half =
        event.detail === 0
          ? event.shiftKey
          : event.shiftKey || event.clientX - box.left < box.width / 2;
      patch = {
        score:
          (Number(button.dataset.gridHeart) - (half ? 0.5 : 0)) *
          (current.score < 0 ? -1 : 1),
      };
    }
    if (patch) {
      stage(state, profileId, subjectId, patch);
      queue();
      updateSelection();
    }
  });
  on(host, "input", (event) => {
    const input = event.target;
    if (input.matches("[data-grid-search]"))
      search("search", input, "[data-grid-search]");
    if (input.matches("[data-grid-npc-search]"))
      search("npcSearch", input, "[data-grid-npc-search]");
    if (input.matches("[data-grid-reason]")) {
      ui.reason = input.value;
      queue();
    }
  });
  on(host, "change", async (event) => {
    const input = event.target;
    if (input.matches("[data-grid-select-subject]")) {
      input.checked
        ? ui.selectedSubjects.add(input.dataset.gridSelectSubject)
        : ui.selectedSubjects.delete(input.dataset.gridSelectSubject);
      updateSelection();
    }
    if (input.matches("[data-grid-select-profile]")) {
      input.checked
        ? ui.selectedProfiles.add(input.dataset.gridSelectProfile)
        : ui.selectedProfiles.delete(input.dataset.gridSelectProfile);
      updateSelection();
    }
    if (input.matches("[data-grid-select-page]")) {
      for (const row of context.workbench.rows)
        input.checked
          ? ui.selectedSubjects.add(row.id)
          : ui.selectedSubjects.delete(row.id);
      updateSelection();
    }
    if (input.matches("[data-grid-advanced-subject]")) {
      app.subjectId = input.value;
      await rerender();
    }
    if (input.matches("[data-grid-group]")) {
      ui.groupId = input.value;
      ui.columnPage = 0;
      ui.page = 0;
      ui.selectedSubjects.clear();
      await rerender("[data-grid-group]");
    }
    if (input.matches("[data-grid-score]")) {
      if (!canEdit() || ui.selectedSubjects.size) return;
      if (input.value === "" || !Number.isFinite(Number(input.value))) {
        input.setAttribute("aria-invalid", "true");
        notify("warn", "Informe um número válido.");
        return;
      }
      input.removeAttribute("aria-invalid");
      const cell = input.closest("[data-grid-cell]");
      stage(
        loadWorldState(),
        cell.dataset.gridProfile,
        cell.dataset.gridSubject,
        { score: Number(input.value) },
      );
      queue();
    }
  });
  on(host, "keydown", (event) => {
    const heart = event.target.closest("[data-grid-heart]");
    if (heart && !heart.disabled && canEdit() && !ui.selectedSubjects.size) {
      const group = heart.closest("[data-grid-hearts]"),
        buttons = [...group.children];
      const index = buttons.indexOf(heart);
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const nextIndex =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? buttons.length - 1
              : Math.max(
                  0,
                  Math.min(
                    buttons.length - 1,
                    index + (event.key === "ArrowLeft" ? -1 : 1),
                  ),
                );
        for (const button of buttons) button.tabIndex = -1;
        buttons[nextIndex].tabIndex = 0;
        buttons[nextIndex].focus();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const cell = heart.closest("[data-grid-cell]"),
          state = loadWorldState();
        const current = getValue(
          state,
          cell.dataset.gridProfile,
          cell.dataset.gridSubject,
        );
        stage(state, cell.dataset.gridProfile, cell.dataset.gridSubject, {
          score:
            (Number(heart.dataset.gridHeart) - (event.shiftKey ? 0.5 : 0)) *
            (current.score < 0 ? -1 : 1),
        });
        queue();
        updateSelection();
        return;
      }
    }
    if (event.key === "Enter" && event.target.matches("[data-grid-score]")) {
      event.preventDefault();
      event.target.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (
      event.key === "Escape" &&
      (event.target.matches("input") || ui.selectedSubjects.size)
    ) {
      event.preventDefault();
      ui.selectedSubjects.clear();
      updateSelection();
      event.target.blur();
    }
  });
  const advanced = root.querySelector("[data-grid-advanced]");
  on(
    root.querySelector("[data-grid-advanced-subject]"),
    "change",
    async (event) => {
      app.subjectId = event.target.value;
      await rerender();
    },
  );
  on(advanced, "toggle", () => {
    if (advanced.open && ui.drafts.size) {
      advanced.open = false;
      notify(
        "warn",
        "Salve ou descarte os ajustes da tabela antes de abrir o editor individual.",
      );
      return;
    }
    if (ui.advancedOpen !== advanced.open) {
      ui.advancedOpen = advanced.open;
      rerender();
      return;
    }
    updateSelection();
    app._updateSaveStatus(root);
  });
  updateSelection();
  updateStatus();
  return {
    refresh: updateSelection,
    destroy() {
      ui.scrollTop = scroll?.scrollTop ?? 0;
      ui.scrollLeft = scroll?.scrollLeft ?? 0;
      for (const timer of timers.values()) clearTimeout(timer);
      for (const remove of listeners) remove();
    },
  };
}
