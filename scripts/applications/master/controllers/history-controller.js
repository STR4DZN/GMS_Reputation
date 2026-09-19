import { MODULE_ID } from "../../../constants.js";
import { WorldStateRepository } from "../../../state/repository.js";
import { HistoryService } from "../../../services/history-service.js";

const TEMPLATE = `modules/${MODULE_ID}/templates/master/history.hbs`;

async function renderTemplateSafe(path, context) {
  const render = globalThis.foundry?.applications?.handlebars?.renderTemplate
    ?? globalThis.renderTemplate;
  if (typeof render === "function") {
    return render(path, context);
  }
  return "";
}

function formatActorName(userId) {
  const id = String(userId || "").trim();
  if (!id) return "Sistema";
  const user = globalThis.game?.users?.get?.(id)
    ?? globalThis.game?.users?.find?.((u) => String(u?.id) === id);
  return String(user?.name || user?.displayName || id);
}

function formatTimestamp(timestamp) {
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(numeric));
  } catch {
    return new Date(numeric).toLocaleString("pt-BR");
  }
}

export class HistoryController {
  constructor() {
    this.container = null;
    this.shell = null;
    this.filter = "all";
    this.searchQuery = "";
    this._listeners = [];
  }

  async mount(container, { shell = null } = {}) {
    this.container = container;
    this.shell = shell;
    const state = WorldStateRepository.load();

    const context = this._buildContext(state);
    const html = await renderTemplateSafe(TEMPLATE, context);
    if (this.container) {
      this.container.innerHTML = html;
      this._wireEvents();
    }
  }

  _buildContext(state) {
    const rawEvents = HistoryService.list({ state, filter: this.filter, limit: 100 });
    const ur = HistoryService.buildUndoRedoState(state);
    const undoTargetId = ur.undoTarget;

    const formatted = rawEvents.map((evt) => {
      const changes = [];
      const before = evt.before ?? {};
      const after = evt.after ?? {};

      if (evt.type === "relationship") {
        if (before.score !== after.score && after.score !== undefined) {
          changes.push({ label: "Score", before: String(before.score ?? "—"), after: String(after.score) });
        }
        if (before.bond !== after.bond && after.bond !== undefined) {
          changes.push({ label: "Vínculo", before: before.bond ? "ATIVO" : "INATIVO", after: after.bond ? "ATIVO" : "INATIVO" });
        }
        if (before.communion !== after.communion && after.communion !== undefined) {
          changes.push({ label: "Comunhão", before: before.communion ? "ATIVA" : "INATIVA", after: after.communion ? "ATIVA" : "INATIVA" });
        }
      } else if (evt.type === "portrait") {
        changes.push({ label: "Retrato", before: before.src ? "EDITADO" : "VAZIO", after: after.src ? "EDITADO" : "VAZIO" });
      } else if (evt.type === "profile-create" || evt.type === "profile-update") {
        if (after.name) changes.push({ label: "Nome", before: String(before.name || "—"), after: String(after.name) });
      } else if (evt.type === "subject-create" || evt.type === "subject-update") {
        if (after.alias) changes.push({ label: "Apelido", before: String(before.alias || "—"), after: String(after.alias) });
      }

      const txKey = String(evt.transactionId || evt.id || "").trim();
      const isUndoTarget = Boolean(undoTargetId && txKey === undoTargetId);

      return {
        id: evt.id,
        transactionId: evt.transactionId,
        type: evt.type,
        typeLabel: evt.type.toUpperCase(),
        actorLabel: formatActorName(evt.userId),
        timestampText: formatTimestamp(evt.timestamp),
        reason: evt.reason || "",
        hasChanges: changes.length > 0,
        changes,
        isUndoTarget
      };
    });

    let filtered = formatted;
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = formatted.filter((e) =>
        e.actorLabel.toLowerCase().includes(q) ||
        e.reason.toLowerCase().includes(q) ||
        e.typeLabel.toLowerCase().includes(q)
      );
    }

    return {
      filter: this.filter,
      searchQuery: this.searchQuery,
      totalEvents: (state.history ?? []).length,
      events: filtered
    };
  }

  _wireEvents() {
    if (!this.container) return;
    this._cleanupListeners();

    // Filter tabs
    const filterButtons = this.container.querySelectorAll("[data-action='filter-history']");
    for (const btn of filterButtons) {
      const onFilter = () => {
        this.filter = btn.dataset.filter;
        this.mount(this.container, { shell: this.shell });
      };
      btn.addEventListener("click", onFilter);
      this._listeners.push(() => btn.removeEventListener("click", onFilter));
    }

    // Search
    const searchInput = this.container.querySelector("[data-action='search-history']");
    if (searchInput) {
      const onSearch = () => {
        this.searchQuery = searchInput.value;
        this.mount(this.container, { shell: this.shell });
      };
      searchInput.addEventListener("input", onSearch);
      this._listeners.push(() => searchInput.removeEventListener("input", onSearch));
    }
  }

  _cleanupListeners() {
    this._listeners.forEach((cleanup) => cleanup());
    this._listeners = [];
  }

  async patch(diff, state) {
    // If new history events were appended, remount
    await this.mount(this.container, { shell: this.shell });
    return true;
  }

  unmount() {
    this._cleanupListeners();
    this.container = null;
    this.shell = null;
  }
}
