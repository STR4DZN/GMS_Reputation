import { MODULE_ID } from "../../../constants.js";
import { WorldStateRepository } from "../../../state/repository.js";
import { SubjectService } from "../../../services/subject-service.js";
import { ProfileService } from "../../../services/profile-service.js";
import { PortraitService } from "../../../services/portrait-service.js";
import { buildPortraitEditorContext, wirePortraitEditor } from "../../../components/portrait.js";

const TEMPLATE = `modules/${MODULE_ID}/templates/master/characters.hbs`;

async function renderTemplateSafe(path, context) {
  const render = globalThis.foundry?.applications?.handlebars?.renderTemplate
    ?? globalThis.renderTemplate;
  if (typeof render === "function") {
    return render(path, context);
  }
  return "";
}

export class CharactersController {
  constructor() {
    this.container = null;
    this.shell = null;
    this.selectedSubjectId = null;
    this.searchQuery = "";
    this._portraitEditorCleanup = null;
    this._listeners = [];
  }

  async mount(container, { subjectId = "", shell = null } = {}) {
    this.container = container;
    this.shell = shell;
    const state = WorldStateRepository.load();

    const subjectsList = Object.values(state.subjects ?? {})
      .filter((s) => s && !s.archived)
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));

    this.selectedSubjectId = subjectId || this.selectedSubjectId || subjectsList[0]?.id || null;

    const context = this._buildContext(state);
    const html = await renderTemplateSafe(TEMPLATE, context);
    if (this.container) {
      this.container.innerHTML = html;
      this._wireEvents();
    }
  }

  _buildContext(state) {
    const rawSubjects = Object.values(state.subjects ?? {});
    const profiles = Object.values(state.profiles ?? {}).filter((p) => !p.archived);

    // Profile membership count per subject
    const profileCounts = new Map();
    for (const p of profiles) {
      const roster = Array.isArray(p.subjectIds) ? p.subjectIds : Object.keys(p.relationships ?? {});
      for (const sId of roster) {
        profileCounts.set(String(sId), (profileCounts.get(String(sId)) || 0) + 1);
      }
    }

    let filtered = rawSubjects;
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = rawSubjects.filter((s) =>
        String(s.alias || "").toLowerCase().includes(q) ||
        String(s.realName || "").toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.alias || a.realName).localeCompare(String(b.alias || b.realName)));

    const subjects = filtered.map((s) => ({
      id: s.id,
      alias: s.alias,
      realName: s.realName,
      portrait: s.portrait ?? {},
      active: s.active !== false,
      profileCount: profileCounts.get(String(s.id)) || 0,
      selected: s.id === this.selectedSubjectId
    }));

    const selectedSubject = state.subjects?.[this.selectedSubjectId] ?? null;
    const hasSelectedSubject = Boolean(selectedSubject);

    let portraitContext = null;
    let tagsString = "";
    let profileMemberships = [];
    let membershipStats = { count: 0, total: profiles.length };

    if (hasSelectedSubject) {
      portraitContext = buildPortraitEditorContext(selectedSubject.portrait, {
        label: `Retrato de ${selectedSubject.alias}`,
        kind: "subject"
      });

      tagsString = Array.isArray(selectedSubject.metadata?.tags)
        ? selectedSubject.metadata.tags.join(", ")
        : "";

      profileMemberships = profiles.map((p) => {
        const roster = new Set(Array.isArray(p.subjectIds) ? p.subjectIds.map(String) : Object.keys(p.relationships ?? {}));
        const included = roster.has(String(selectedSubject.id));
        return {
          id: p.id,
          name: p.name,
          included
        };
      });

      membershipStats.count = profileMemberships.filter((m) => m.included).length;
    }

    return {
      subjects,
      totalSubjects: rawSubjects.length,
      searchQuery: this.searchQuery,
      hasSelectedSubject,
      selectedSubject,
      tagsString,
      portraitContext,
      profileMemberships,
      membershipStats
    };
  }

  _wireEvents() {
    if (!this.container) return;
    this._cleanupListeners();

    // Search filter
    const searchInput = this.container.querySelector("[data-action='search-character']");
    if (searchInput) {
      const onSearch = () => {
        this.searchQuery = searchInput.value;
        this.mount(this.container, { subjectId: this.selectedSubjectId, shell: this.shell });
      };
      searchInput.addEventListener("input", onSearch);
      this._listeners.push(() => searchInput.removeEventListener("input", onSearch));
    }

    // Select subject
    const subjectCards = this.container.querySelectorAll(".gms-character-card[data-subject-id]");
    for (const card of subjectCards) {
      const click = (e) => {
        if (e.target.closest("button, [data-action='move-subject']")) return;
        const id = card.dataset.subjectId;
        if (id && id !== this.selectedSubjectId) {
          this.selectedSubjectId = id;
          if (this.shell) this.shell.selectedSubjectId = id;
          this.mount(this.container, { subjectId: id, shell: this.shell });
        }
      };
      card.addEventListener("click", click);
      this._listeners.push(() => card.removeEventListener("click", click));
    }

    // Create character
    const createBtn = this.container.querySelector("[data-action='create-character']");
    if (createBtn) {
      const onCreate = async () => {
        const newSubj = await SubjectService.create({ alias: "Novo Personagem" });
        this.selectedSubjectId = newSubj.id;
        if (this.shell) this.shell.selectedSubjectId = newSubj.id;
        await this.mount(this.container, { subjectId: newSubj.id, shell: this.shell });
      };
      createBtn.addEventListener("click", onCreate);
      this._listeners.push(() => createBtn.removeEventListener("click", onCreate));
    }

    // Move character
    const moveButtons = this.container.querySelectorAll("[data-action='move-subject']");
    for (const btn of moveButtons) {
      const onMove = async (e) => {
        e.stopPropagation();
        const card = btn.closest("[data-subject-id]");
        const sId = card?.dataset?.subjectId;
        const direction = btn.dataset.direction;
        if (sId && direction) {
          await SubjectService.moveOneStep(sId, direction);
          await this.mount(this.container, { subjectId: this.selectedSubjectId, shell: this.shell });
        }
      };
      btn.addEventListener("click", onMove);
      this._listeners.push(() => btn.removeEventListener("click", onMove));
    }

    // Form inputs (Drafts & Save Controller)
    const aliasInput = this.container.querySelector("input[data-field='alias']");
    const realInput = this.container.querySelector("input[data-field='realName']");
    const tagsInput = this.container.querySelector("input[data-field='tags']");
    const descInput = this.container.querySelector("textarea[data-field='description']");
    const activeCb = this.container.querySelector("input[data-field='active']");
    const archivedCb = this.container.querySelector("input[data-field='archived']");

    let pendingPortrait = null;
    const onFormChange = (inputEl) => {
      if (!this.selectedSubjectId || !this.shell) return;
      if (inputEl) inputEl.dataset.dirty = "true";

      this.shell.saveController.queue(`subject-${this.selectedSubjectId}`, async () => {
        const tags = tagsInput?.value
          ? tagsInput.value.split(",").map((t) => t.trim()).filter(Boolean)
          : [];

        await SubjectService.update({
          subjectId: this.selectedSubjectId,
          alias: aliasInput?.value,
          realName: realInput?.value,
          description: descInput?.value,
          active: Boolean(activeCb?.checked),
          archived: Boolean(archivedCb?.checked),
          portrait: pendingPortrait ?? undefined
        });

        if (inputEl) inputEl.dataset.dirty = "false";
      });
    };

    [aliasInput, realInput, tagsInput, descInput, activeCb, archivedCb].filter(Boolean).forEach((el) => {
      const eventName = el.type === "checkbox" ? "change" : "input";
      const handler = () => onFormChange(el);
      el.addEventListener(eventName, handler);
      this._listeners.push(() => el.removeEventListener(eventName, handler));
    });

    // Wire Portrait Editor
    const editorRoot = this.container.querySelector("[data-portrait-editor]");
    if (editorRoot) {
      this._portraitEditorCleanup = wirePortraitEditor(editorRoot, {
        onChange: (portrait) => {
          pendingPortrait = portrait;
          onFormChange(null);
        }
      });
    }

    // Profile membership checkboxes
    const membershipCbs = this.container.querySelectorAll("[data-action='toggle-profile-membership']");
    for (const cb of membershipCbs) {
      const onToggle = async () => {
        const profileId = cb.dataset.profileId;
        const included = cb.checked;
        await ProfileService.updateRoster({
          profileId,
          subjectId: this.selectedSubjectId,
          included
        });
      };
      cb.addEventListener("change", onToggle);
      this._listeners.push(() => cb.removeEventListener("change", onToggle));
    }
  }

  _cleanupListeners() {
    this._listeners.forEach((cleanup) => cleanup());
    this._listeners = [];
    if (this._portraitEditorCleanup?.destroy) {
      this._portraitEditorCleanup.destroy();
      this._portraitEditorCleanup = null;
    }
  }

  async patch(diff, state) {
    if (diff.structuralSubjectIds?.length) {
      await this.mount(this.container, { subjectId: this.selectedSubjectId, shell: this.shell });
      return true;
    }

    if (diff.changedSubjectIds?.includes?.(this.selectedSubjectId)) {
      await this.mount(this.container, { subjectId: this.selectedSubjectId, shell: this.shell });
      return true;
    }

    return false;
  }

  unmount() {
    this._cleanupListeners();
    this.container = null;
    this.shell = null;
  }
}
