import { MODULE_ID } from "../../../constants.js";
import { WorldStateRepository } from "../../../state/repository.js";
import { ProfileService } from "../../../services/profile-service.js";
import { buildPortraitEditorContext, wirePortraitEditor } from "../../../components/portrait.js";

const TEMPLATE = `modules/${MODULE_ID}/templates/master/profiles.hbs`;

async function renderTemplateSafe(path, context) {
  const render = globalThis.foundry?.applications?.handlebars?.renderTemplate
    ?? globalThis.renderTemplate;
  if (typeof render === "function") {
    return render(path, context);
  }
  return "";
}

export class ProfilesController {
  constructor() {
    this.container = null;
    this.shell = null;
    this.selectedProfileId = null;
    this.groupFilter = "all";
    this._portraitEditorCleanup = null;
    this._listeners = [];
  }

  async mount(container, { profileId = "", shell = null } = {}) {
    this.container = container;
    this.shell = shell;
    const state = WorldStateRepository.load();

    const profilesList = Object.values(state.profiles ?? {})
      .filter((p) => p && !p.archived)
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));

    this.selectedProfileId = profileId || this.selectedProfileId || profilesList[0]?.id || null;

    const context = this._buildContext(state);
    const html = await renderTemplateSafe(TEMPLATE, context);
    if (this.container) {
      this.container.innerHTML = html;
      this._wireEvents();
    }
  }

  _buildContext(state) {
    const rawProfiles = Object.values(state.profiles ?? {});
    const groups = Object.values(state.groups ?? {}).map((g) => ({
      id: g.id,
      name: g.name,
      selected: g.id === this.groupFilter
    }));

    let filteredProfiles = rawProfiles;
    if (this.groupFilter !== "all") {
      filteredProfiles = rawProfiles.filter((p) => String(p.groupId) === String(this.groupFilter));
    }

    filteredProfiles.sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name)));

    const profiles = filteredProfiles.map((p) => ({
      id: p.id,
      name: p.name,
      focalName: p.focal?.name || p.name,
      active: p.active !== false,
      selected: p.id === this.selectedProfileId
    }));

    const selectedProfile = state.profiles?.[this.selectedProfileId] ?? null;
    const hasSelectedProfile = Boolean(selectedProfile);

    let focalPortraitContext = null;
    let rosterSubjects = [];
    let rosterStats = { included: 0, total: 0 };

    if (hasSelectedProfile) {
      focalPortraitContext = buildPortraitEditorContext(selectedProfile.focal?.portrait, {
        label: `Retrato Focal de ${selectedProfile.name}`,
        kind: "focal"
      });

      const rosterSet = new Set(Array.isArray(selectedProfile.subjectIds) ? selectedProfile.subjectIds.map(String) : Object.keys(selectedProfile.relationships ?? {}));
      const allSubjects = Object.values(state.subjects ?? {})
        .filter((s) => s.active !== false && !s.archived)
        .sort((a, b) => String(a.alias || a.realName).localeCompare(String(b.alias || b.realName)));

      rosterSubjects = allSubjects.map((s) => ({
        id: s.id,
        alias: s.alias,
        realName: s.realName,
        included: rosterSet.has(String(s.id))
      }));

      rosterStats = {
        included: rosterSubjects.filter((s) => s.included).length,
        total: rosterSubjects.length
      };
    }

    return {
      profiles,
      totalProfiles: rawProfiles.length,
      groups: groups.map((g) => ({
        ...g,
        isSelectedGroup: g.id === selectedProfile?.groupId
      })),
      hasSelectedProfile,
      selectedProfile,
      rosterSubjects,
      rosterStats,
      focalPortraitContext
    };
  }

  _wireEvents() {
    if (!this.container) return;
    this._cleanupListeners();

    // Select profile
    const profileItems = this.container.querySelectorAll("[data-profile-id]");
    for (const item of profileItems) {
      const click = (e) => {
        if (e.target.closest("button, [data-action='move-profile']")) return;
        const id = item.dataset.profileId;
        if (id && id !== this.selectedProfileId) {
          this.selectedProfileId = id;
          if (this.shell) this.shell.selectedProfileId = id;
          this.mount(this.container, { profileId: id, shell: this.shell });
        }
      };
      item.addEventListener("click", click);
      this._listeners.push(() => item.removeEventListener("click", click));
    }

    // Create profile
    const createBtn = this.container.querySelector("[data-action='create-profile']");
    if (createBtn) {
      const onCreate = async () => {
        const newProf = await ProfileService.create({ name: "Novo Perfil" });
        this.selectedProfileId = newProf.id;
        if (this.shell) this.shell.selectedProfileId = newProf.id;
        await this.mount(this.container, { profileId: newProf.id, shell: this.shell });
      };
      createBtn.addEventListener("click", onCreate);
      this._listeners.push(() => createBtn.removeEventListener("click", onCreate));
    }

    // Filter by group
    const filterSelect = this.container.querySelector("[data-action='filter-group']");
    if (filterSelect) {
      const onFilter = () => {
        this.groupFilter = filterSelect.value;
        this.mount(this.container, { profileId: this.selectedProfileId, shell: this.shell });
      };
      filterSelect.addEventListener("change", onFilter);
      this._listeners.push(() => filterSelect.removeEventListener("change", onFilter));
    }

    // Move profile up/down
    const moveButtons = this.container.querySelectorAll("[data-action='move-profile']");
    for (const btn of moveButtons) {
      const onMove = async (e) => {
        e.stopPropagation();
        const item = btn.closest("[data-profile-id]");
        const profileId = item?.dataset?.profileId;
        const direction = btn.dataset.direction;
        if (profileId && direction) {
          await ProfileService.moveOneStep(profileId, direction);
          await this.mount(this.container, { profileId: this.selectedProfileId, shell: this.shell });
        }
      };
      btn.addEventListener("click", onMove);
      this._listeners.push(() => btn.removeEventListener("click", onMove));
    }

    // Form inputs (Drafts & Save Controller)
    const nameInput = this.container.querySelector("input[data-field='name']");
    const groupSelect = this.container.querySelector("select[data-field='groupId']");
    const activeCb = this.container.querySelector("input[data-field='active']");
    const archivedCb = this.container.querySelector("input[data-field='archived']");

    const onProfileFormChange = (inputEl) => {
      if (!this.selectedProfileId || !this.shell) return;
      if (inputEl) inputEl.dataset.dirty = "true";

      this.shell.saveController.queue(`profile-${this.selectedProfileId}`, async () => {
        const payload = {
          profileId: this.selectedProfileId,
          name: nameInput?.value,
          groupId: groupSelect?.value || null,
          active: Boolean(activeCb?.checked),
          archived: Boolean(archivedCb?.checked)
        };
        await ProfileService.updateProfile(payload);
        if (inputEl) inputEl.dataset.dirty = "false";
      });
    };

    [nameInput, groupSelect, activeCb, archivedCb].filter(Boolean).forEach((el) => {
      const eventName = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input";
      const handler = () => onProfileFormChange(el);
      el.addEventListener(eventName, handler);
      this._listeners.push(() => el.removeEventListener(eventName, handler));
    });

    // Roster inclusion toggles
    const rosterCheckboxes = this.container.querySelectorAll("[data-action='toggle-roster-subject']");
    for (const cb of rosterCheckboxes) {
      const onToggle = async () => {
        const subjectId = cb.dataset.subjectId;
        const included = cb.checked;
        await ProfileService.updateRoster({
          profileId: this.selectedProfileId,
          subjectId,
          included
        });
      };
      cb.addEventListener("change", onToggle);
      this._listeners.push(() => cb.removeEventListener("change", onToggle));
    }

    // Focal form inputs
    const focalNameInput = this.container.querySelector("input[data-field='focalName']");
    const focalDescInput = this.container.querySelector("textarea[data-field='focalDescription']");

    let pendingPortrait = null;
    const onFocalChange = (inputEl) => {
      if (!this.selectedProfileId || !this.shell) return;
      if (inputEl) inputEl.dataset.dirty = "true";

      this.shell.saveController.queue(`focal-${this.selectedProfileId}`, async () => {
        await ProfileService.updateFocal({
          profileId: this.selectedProfileId,
          name: focalNameInput?.value,
          description: focalDescInput?.value,
          portrait: pendingPortrait ?? undefined
        });
        if (inputEl) inputEl.dataset.dirty = "false";
      });
    };

    [focalNameInput, focalDescInput].filter(Boolean).forEach((el) => {
      const handler = () => onFocalChange(el);
      el.addEventListener("input", handler);
      this._listeners.push(() => el.removeEventListener("input", handler));
    });

    // Wire Portrait Editor for Focal portrait
    const editorRoot = this.container.querySelector("[data-portrait-editor]");
    if (editorRoot) {
      this._portraitEditorCleanup = wirePortraitEditor(editorRoot, {
        onChange: (portrait) => {
          pendingPortrait = portrait;
          onFocalChange(null);
        }
      });
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
    // If profiles structurally changed or active profile changed externally
    if (diff.structuralProfileIds?.length || diff.changedGroupIds?.length) {
      await this.mount(this.container, { profileId: this.selectedProfileId, shell: this.shell });
      return true;
    }

    if (diff.changedProfileIds?.includes?.(this.selectedProfileId)) {
      // Refresh current profile view
      await this.mount(this.container, { profileId: this.selectedProfileId, shell: this.shell });
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
