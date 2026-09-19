import { MODULE_ID, DATA_SCHEMA_VERSION } from "../../../constants.js";
import { WorldStateRepository } from "../../../state/repository.js";
import { createEmptyWorldState } from "../../../state/schema.js";
import { restoreWorldStateBackup } from "../../../state/backup.js";
import {
  getMasterSaveMode,
  setMasterSaveMode,
  getMasterAutoSaveDelay,
  setMasterAutoSaveDelay
} from "../../../persistence/master-preferences.js";
import {
  getPermissionConfig,
  setPermissionConfig
} from "../../../services/permission-service.js";

const TEMPLATE = `modules/${MODULE_ID}/templates/master/system.hbs`;

async function renderTemplateSafe(path, context) {
  const render = globalThis.foundry?.applications?.handlebars?.renderTemplate
    ?? globalThis.renderTemplate;
  if (typeof render === "function") {
    return render(path, context);
  }
  return "";
}

export class SystemController {
  constructor() {
    this.container = null;
    this.shell = null;
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
    const saveMode = getMasterSaveMode();
    const saveDelay = getMasterAutoSaveDelay();
    const permissions = getPermissionConfig();

    let relCount = 0;
    for (const p of Object.values(state.profiles ?? {})) {
      relCount += Object.keys(p.relationships ?? {}).length;
    }

    const diagnostics = {
      schemaVersion: DATA_SCHEMA_VERSION,
      worldRevision: Number(state.revision) || 0,
      profileCount: Object.keys(state.profiles ?? {}).length,
      subjectCount: Object.keys(state.subjects ?? {}).length,
      relationshipCount: relCount,
      historyCount: Array.isArray(state.history) ? state.history.length : 0
    };

    return {
      saveMode,
      saveDelay,
      permissions,
      diagnostics
    };
  }

  _wireEvents() {
    if (!this.container) return;
    this._cleanupListeners();

    // Save Mode Select
    const saveModeSelect = this.container.querySelector("select[data-field='saveMode']");
    if (saveModeSelect) {
      const onChangeMode = async () => {
        const mode = saveModeSelect.value;
        await setMasterSaveMode(mode);
        if (this.shell?.saveController) {
          this.shell.saveController.configure({ mode });
        }
      };
      saveModeSelect.addEventListener("change", onChangeMode);
      this._listeners.push(() => saveModeSelect.removeEventListener("change", onChangeMode));
    }

    // Save Delay Range Slider
    const delaySlider = this.container.querySelector("input[data-field='saveDelay']");
    const delayOutput = this.container.querySelector("[data-save-delay-output]");
    if (delaySlider) {
      const onDelayChange = async () => {
        const seconds = Number(delaySlider.value);
        if (delayOutput) delayOutput.textContent = `${seconds}s`;
        await setMasterAutoSaveDelay(seconds);
        if (this.shell?.saveController) {
          this.shell.saveController.configure({ idleDelay: seconds });
        }
      };
      delaySlider.addEventListener("input", onDelayChange);
      this._listeners.push(() => delaySlider.removeEventListener("input", onDelayChange));
    }

    // Permissions Table Checkboxes
    const permCheckboxes = this.container.querySelectorAll("input[data-perm-role]");
    for (const cb of permCheckboxes) {
      const onPermToggle = async () => {
        const role = cb.dataset.permRole;
        const cap = cb.dataset.permCap;
        const checked = cb.checked;
        const current = getPermissionConfig();
        const next = {
          ...current,
          [role]: {
            ...current[role],
            [cap]: checked
          }
        };
        await setPermissionConfig(next);
      };
      cb.addEventListener("change", onPermToggle);
      this._listeners.push(() => cb.removeEventListener("change", onPermToggle));
    }

    // Export Backup JSON
    const exportBtn = this.container.querySelector("[data-action='export-backup']");
    if (exportBtn) {
      const onExport = () => {
        const state = WorldStateRepository.load();
        const json = JSON.stringify(state, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gms-reputation-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      };
      exportBtn.addEventListener("click", onExport);
      this._listeners.push(() => exportBtn.removeEventListener("click", onExport));
    }

    // Restore Backup from Settings
    const restoreBtn = this.container.querySelector("[data-action='restore-backup']");
    if (restoreBtn) {
      const onRestore = async () => {
        const confirmed = globalThis.confirm?.("Deseja restaurar o backup de segurança automático do mundo?\nO estado atual será substituído pelo backup salvo.");
        if (confirmed) {
          try {
            await restoreWorldStateBackup();
            await this.mount(this.container, { shell: this.shell });
          } catch (err) {
            console.error("[GMS Reputation] Restore failed:", err);
          }
        }
      };
      restoreBtn.addEventListener("click", onRestore);
      this._listeners.push(() => restoreBtn.removeEventListener("click", onRestore));
    }

    // Reset WorldState to Empty
    const resetBtn = this.container.querySelector("[data-action='reset-worldstate']");
    if (resetBtn) {
      const onReset = async () => {
        const confirmed = globalThis.confirm?.("PERIGO: Deseja reinicializar completamente o WorldState para um estado inicial vazio?\nTODOS os perfis, personagens e relações serão apagados.");
        if (confirmed) {
          await WorldStateRepository.commit(createEmptyWorldState());
          await this.mount(this.container, { shell: this.shell });
        }
      };
      resetBtn.addEventListener("click", onReset);
      this._listeners.push(() => resetBtn.removeEventListener("click", onReset));
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
