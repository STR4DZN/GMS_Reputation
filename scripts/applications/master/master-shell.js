import { MODULE_ID, MASTER_SAVE_MODE } from "../../constants.js";
import { WorldStateRepository } from "../../state/repository.js";
import { subscribeWorldStateChanges } from "../../state/sync.js";
import { HistoryService } from "../../services/history-service.js";
import { MasterSaveController, SAVE_STATUS } from "./save-controller.js";
import { getMasterSaveMode, getMasterAutoSaveDelay } from "../../persistence/master-preferences.js";
import { motionEngine } from "../../motion/motion-engine.js";
import { ProfilesController } from "./controllers/profiles-controller.js";
import { CharactersController } from "./controllers/characters-controller.js";
import { RelationshipController } from "./controllers/relationship-controller.js";
import { HistoryController } from "./controllers/history-controller.js";
import { CleanupController } from "./controllers/cleanup-controller.js";
import { SystemController } from "./controllers/system-controller.js";

const ApplicationV2Class = globalThis.foundry?.applications?.api?.HandlebarsApplicationV2
  ?? class StandaloneApplication {
    constructor(options = {}) {
      this.options = options;
      this.rendered = false;
    }
    async render(force = false) {
      this.rendered = true;
      return this;
    }
    async close() {
      this.rendered = false;
      return this;
    }
  };

const WORKSPACES = Object.freeze([
  { id: "profiles", label: "Perfis", eyebrow: "MATRIZES", icon: "fa-layer-group" },
  { id: "characters", label: "Personagens", eyebrow: "CADASTRO", icon: "fa-user-pen" },
  { id: "relationship", label: "Reputação", eyebrow: "RELAÇÕES", icon: "fa-heart-pulse" },
  { id: "history", label: "Histórico", eyebrow: "AUDITORIA", icon: "fa-clock-rotate-left" },
  { id: "cleanup", label: "Limpeza", eyebrow: "DADOS", icon: "fa-trash-can" },
  { id: "system", label: "Sistema", eyebrow: "CONTROLE", icon: "fa-sliders" }
]);

export class MasterShellApplication extends ApplicationV2Class {
  static DEFAULT_OPTIONS = {
    id: "gms-reputation-master-shell",
    classes: ["gms-reputation-app", "gms-reputation-master-shell"],
    tag: "section",
    window: {
      title: "GMS // Painel de Gestão Social",
      icon: "fa-solid fa-network-wired",
      resizable: true
    },
    position: { width: 1100, height: 860 }
  };

  static PARTS = {
    main: {
      root: true,
      template: `modules/${MODULE_ID}/templates/master/shell.hbs`,
      scrollable: ["[data-master-workspace-container]"]
    }
  };

  constructor(options = {}) {
    super(options);
    this.activeWorkspace = options.workspace || options.initialWorkspace || "profiles";
    this.selectedProfileId = options.profileId || "";
    this.selectedSubjectId = options.subjectId || "";
    this._syncUnsubscribe = null;
    this._controllers = new Map();
    this._activeController = null;

    // Save Controller instance
    this.saveController = new MasterSaveController({
      mode: getMasterSaveMode(),
      idleDelay: getMasterAutoSaveDelay(),
      onStatus: (snapshot) => this._updateSaveIndicator(snapshot)
    });

    this.registerController("profiles", new ProfilesController());
    this.registerController("characters", new CharactersController());
    this.registerController("relationship", new RelationshipController());
    this.registerController("history", new HistoryController());
    this.registerController("cleanup", new CleanupController());
    this.registerController("system", new SystemController());

    this._syncUnsubscribe = subscribeWorldStateChanges((event) => this._onWorldStateSync(event));
  }

  registerController(id, controllerInstance) {
    this._controllers.set(id, controllerInstance);
  }

  async _prepareContext(options) {
    const parent = await super._prepareContext?.(options) ?? {};
    const state = WorldStateRepository.load();
    const undoRedo = HistoryService.buildUndoRedoState(state);
    const saveSnapshot = this.saveController.snapshot();

    const workspaces = WORKSPACES.map((w) => ({
      ...w,
      active: w.id === this.activeWorkspace
    }));

    return {
      ...parent,
      activeWorkspace: this.activeWorkspace,
      workspaces,
      undoRedo,
      save: saveSnapshot,
      worldRevision: Number(state.revision) || 0
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    if (!root) return;

    this._wireNavigation(root);
    this._wireDeckActions(root);
    this._mountActiveWorkspace();
  }

  _wireNavigation(root) {
    const navButtons = root.querySelectorAll?.("[data-action='switch-workspace']") ?? [];
    for (const btn of navButtons) {
      btn.addEventListener("click", async () => {
        const next = btn.dataset.workspace;
        if (!next || next === this.activeWorkspace) return;
        await this.switchWorkspace(next);
      });
    }
  }

  _wireDeckActions(root) {
    // Manual Save
    const manualSaveBtn = root.querySelector?.("[data-action='manual-save']");
    if (manualSaveBtn) {
      manualSaveBtn.addEventListener("click", async () => {
        try {
          await this.saveController.flush();
        } catch (err) {
          console.error("[GMS Reputation] Failed to save pending changes:", err);
        }
      });
    }

    // Undo
    const undoBtn = root.querySelector?.("[data-action='undo']");
    if (undoBtn) {
      undoBtn.addEventListener("click", async () => {
        await HistoryService.undo();
        this._updateUndoRedoButtons();
      });
    }

    // Redo
    const redoBtn = root.querySelector?.("[data-action='redo']");
    if (redoBtn) {
      redoBtn.addEventListener("click", async () => {
        await HistoryService.redo();
        this._updateUndoRedoButtons();
      });
    }
  }

  async switchWorkspace(workspaceId) {
    if (!WORKSPACES.some((w) => w.id === workspaceId)) return;

    // Flush any pending save before switching
    if (this.saveController.hasPending) {
      try {
        await this.saveController.flush();
      } catch (err) {
        console.warn("[GMS Reputation] Flush before workspace switch warning:", err);
      }
    }

    const container = this.element?.querySelector?.("[data-master-workspace-container]");
    if (container) {
      await motionEngine.fade(container, "out", 120).finished;
    }

    this.activeWorkspace = workspaceId;
    await this.render({ force: true });
  }

  async _mountActiveWorkspace() {
    const container = this.element?.querySelector?.("[data-master-workspace-container]");
    if (!container) return;

    if (this._activeController?.unmount) {
      this._activeController.unmount();
      this._activeController = null;
    }

    const controller = this._controllers.get(this.activeWorkspace);
    if (controller?.mount) {
      this._activeController = controller;
      await controller.mount(container, {
        profileId: this.selectedProfileId,
        subjectId: this.selectedSubjectId,
        shell: this
      });
    }

    motionEngine.fade(container, "in", 150);
  }

  _updateSaveIndicator(snapshot) {
    const root = this.element;
    const indicator = root?.querySelector?.("[data-master-save-status]");
    if (!indicator) return;

    indicator.className = `gms-save-indicator is-${snapshot.status}`;
    indicator.dataset.masterSaveStatus = snapshot.status;
    const label = indicator.querySelector(".gms-save-indicator__label");
    if (label) label.textContent = snapshot.label;

    let manualBtn = indicator.querySelector("[data-action='manual-save']");
    if (snapshot.hasPending) {
      if (!manualBtn) {
        manualBtn = document.createElement("button");
        manualBtn.type = "button";
        manualBtn.className = "gms-btn gms-btn--xs gms-btn--accent";
        manualBtn.dataset.action = "manual-save";
        manualBtn.textContent = "Salvar";
        manualBtn.addEventListener("click", () => this.saveController.flush());
        indicator.appendChild(manualBtn);
      }
    } else if (manualBtn) {
      manualBtn.remove();
    }
  }

  _updateUndoRedoButtons() {
    const root = this.element;
    if (!root) return;
    const state = WorldStateRepository.load();
    const ur = HistoryService.buildUndoRedoState(state);

    const undoBtn = root.querySelector?.("[data-action='undo']");
    if (undoBtn) undoBtn.disabled = !ur.canUndo;

    const redoBtn = root.querySelector?.("[data-action='redo']");
    if (redoBtn) redoBtn.disabled = !ur.canRedo;
  }

  async _onWorldStateSync(event) {
    if (!this.rendered) return;
    this._updateUndoRedoButtons();

    // Delegate patching to active controller if supported (Section 50)
    if (this._activeController?.patch) {
      const handled = await this._activeController.patch(event.diff, event.state);
      if (handled) return;
    }

    // Fallback: If not handled by patch or structural change, re-render
    if (event.diff.structuralGroupIds?.length || event.diff.structuralProfileIds?.length || event.diff.structuralSubjectIds?.length) {
      await this.render({ force: true });
    }
  }

  async close(options) {
    if (this._activeController?.unmount) {
      this._activeController.unmount();
      this._activeController = null;
    }
    this._syncUnsubscribe?.();
    this._syncUnsubscribe = null;
    this.saveController.destroy();
    return super.close(options);
  }
}

let activeMasterShell = null;

export function openMasterShell(options = {}) {
  activeMasterShell?.close?.();
  activeMasterShell = new MasterShellApplication(options);
  activeMasterShell.render(true);
  return activeMasterShell;
}
