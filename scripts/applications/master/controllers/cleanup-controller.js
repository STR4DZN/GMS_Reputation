import { MODULE_ID } from "../../../constants.js";
import { WorldStateRepository } from "../../../state/repository.js";
import { CleanupService } from "../../../services/cleanup-service.js";

const TEMPLATE = `modules/${MODULE_ID}/templates/master/cleanup.hbs`;

async function renderTemplateSafe(path, context) {
  const render = globalThis.foundry?.applications?.handlebars?.renderTemplate
    ?? globalThis.renderTemplate;
  if (typeof render === "function") {
    return render(path, context);
  }
  return "";
}

export class CleanupController {
  constructor() {
    this.container = null;
    this.shell = null;
    this._listeners = [];
  }

  async mount(container, { shell = null } = {}) {
    this.container = container;
    this.shell = shell;
    const state = WorldStateRepository.load();

    const impact = CleanupService.getImpact(state);
    const html = await renderTemplateSafe(TEMPLATE, impact);
    if (this.container) {
      this.container.innerHTML = html;
      this._wireEvents();
    }
  }

  _wireEvents() {
    if (!this.container) return;
    this._cleanupListeners();

    // Delete Subject Permanent
    const deleteSubjectBtns = this.container.querySelectorAll("[data-action='delete-subject-permanent']");
    for (const btn of deleteSubjectBtns) {
      const onDelete = async () => {
        const id = btn.dataset.subjectId;
        const name = btn.dataset.subjectName || id;
        const confirmed = globalThis.confirm?.(`Atenção: Excluir permanentemente o personagem "${name}"?\nEsta ação apagará todas as suas relações em todas as matrizes e não pode ser desfeita.`);
        if (confirmed) {
          await CleanupService.deleteSubjectPermanently(id);
          await this.mount(this.container, { shell: this.shell });
        }
      };
      btn.addEventListener("click", onDelete);
      this._listeners.push(() => btn.removeEventListener("click", onDelete));
    }

    // Delete Profile Permanent
    const deleteProfileBtns = this.container.querySelectorAll("[data-action='delete-profile-permanent']");
    for (const btn of deleteProfileBtns) {
      const onDelete = async () => {
        const id = btn.dataset.profileId;
        const name = btn.dataset.profileName || id;
        const confirmed = globalThis.confirm?.(`Atenção: Excluir permanentemente a matriz "${name}"?\nEsta ação apagará todo o perfil e seu histórico de relações associado.`);
        if (confirmed) {
          await CleanupService.deleteProfilePermanently(id);
          await this.mount(this.container, { shell: this.shell });
        }
      };
      btn.addEventListener("click", onDelete);
      this._listeners.push(() => btn.removeEventListener("click", onDelete));
    }

    // Purge Orphans
    const purgeOrphansBtn = this.container.querySelector("[data-action='purge-orphans']");
    if (purgeOrphansBtn) {
      const onPurge = async () => {
        await CleanupService.purgeOrphanedRelationships();
        await this.mount(this.container, { shell: this.shell });
      };
      purgeOrphansBtn.addEventListener("click", onPurge);
      this._listeners.push(() => purgeOrphansBtn.removeEventListener("click", onPurge));
    }

    // Compact History
    const compactHistoryBtn = this.container.querySelector("[data-action='compact-history']");
    if (compactHistoryBtn) {
      const onCompact = async () => {
        await CleanupService.purgeHistory({ keepLast: 100 });
        await this.mount(this.container, { shell: this.shell });
      };
      compactHistoryBtn.addEventListener("click", onCompact);
      this._listeners.push(() => compactHistoryBtn.removeEventListener("click", onCompact));
    }
  }

  _cleanupListeners() {
    this._listeners.forEach((cleanup) => cleanup());
    this._listeners = [];
  }

  async patch(diff, state) {
    await this.mount(this.container, { shell: this.shell });
    return true;
  }

  unmount() {
    this._cleanupListeners();
    this.container = null;
    this.shell = null;
  }
}
