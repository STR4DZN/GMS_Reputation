import { MASTER_SAVE_MODE, MODULE_ID } from "../constants.js";
import { loadWorldState, restoreWorldStateBackup } from "../persistence/world-store.js";
import { wirePortraitVisibility } from "../components/portrait-visibility.js";
import { computeRelationshipCandidate, updateRelationship } from "../data/reputation-registry.js";
import { setSubjectPortrait } from "../data/portrait-registry.js";
import { buildUndoRedoState, redoLastTransaction, undoLastTransaction } from "../data/undo-redo.js";
import {
  getMasterAutoSaveDelay,
  getMasterSaveMode,
  setMasterAutoSaveDelay,
  setMasterSaveMode
} from "../persistence/master-preferences.js";
import { MasterSaveController } from "./master/save-controller.js";
import { HandlebarsApplicationV2, appElement, destroyListeners, listen, notify, renderApplicationSafely } from "./application-compat.js";
import {
  MODULE_CAPABILITY,
  canOpenMasterPanel,
  canUser,
  getPermissionConfig,
  permissionContext,
  setPermissionConfig,
  subscribePermissionChanges
} from "../persistence/permissions.js";
import { subscribeWorldStateChanges } from "../events/world-sync.js";
import { wireApplicationAccessibility } from "../utils/accessibility.js";
import { wireMotionSystem } from "../motion/motion-system.js";
import { wireSmartSelector } from "../components/smart-selector.js";
import { NavigationTrail, adjacentId, wireNavigationPalette } from "../ui/navigation.js";
import { registerReputationFeedbackSurface, unregisterReputationFeedbackSurface } from "../ui/reputation-feedback.js";
import { openPlayerDashboard } from "./player-dashboard.js";
import { buildMasterPanelContext } from "./master/context.js";
import { SECTIONS, WORKSPACE_PANELS, normalizeWorkspace } from "./master/workspaces.js";
import { wireMasterPlayerBindings } from "./master/player-bindings.js";

import { confirmMasterAction } from "./master/confirmation.js";
import { wireMasterRegistryControls } from "./master/registry-controls.js";
import { wireMasterCleanupControls } from "./master/cleanup-controls.js";
import { wireMasterBulkControls } from "./master/bulk-controls.js";
import { wireMasterRelationshipControls } from "./master/relationship-controls.js";
import { wireMasterPortraitControls, wireMasterFocalControls } from "./master/portrait-controls.js";

// Keep the public module path and exported builder identity stable.
export { buildMasterPanelContext } from "./master/context.js";

const PARTIALS = [
  `modules/${MODULE_ID}/templates/partials/navigation-palette.hbs`,
  `modules/${MODULE_ID}/templates/partials/background-art.hbs`,
  `modules/${MODULE_ID}/templates/partials/portrait-frame.hbs`,
  `modules/${MODULE_ID}/templates/partials/portrait-editor.hbs`,
  `modules/${MODULE_ID}/templates/partials/identity.hbs`,
  `modules/${MODULE_ID}/templates/partials/heart-track.hbs`,
  `modules/${MODULE_ID}/templates/partials/focal-profile.hbs`,
  `modules/${MODULE_ID}/templates/partials/smart-selector.hbs`
];

export class ReputationMasterPanelApplication extends HandlebarsApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "gms-reputation-master-panel",
    classes: ["gms-reputation-app", "gms-reputation-master-panel-app"],
    tag: "section",
    window: { title: "GMS // Controle de Reputação", icon: "fa-solid fa-shield-halved", resizable: true },
    position: { width: 1080, height: 820 }
  };

  static PARTS = {
    main: {
      root: true,
      template: `modules/${MODULE_ID}/templates/apps/master-panel.hbs`,
      templates: PARTIALS,
      scrollable: [".gms-master-panel__nav", ".gms-master-panel__content"]
    }
  };

  constructor({ profileId = "", subjectId = "", activeSection = "profiles", newProfileGroupId = "", ...options } = {}) {
    super(options);
    this.profileId = String(profileId || "");
    this.subjectId = String(subjectId || "");
    this.activeSection = normalizeWorkspace(activeSection);
    this.newProfileGroupId = String(newProfileGroupId || "");
    this._listeners = [];
    this._controlControllers = [];
    this._portraitController = null;
    this._focalPortraitController = null;
    this._accessibilityController = null;
    this._profileSelectorController = null;
    this._subjectSelectorController = null;
    this._profileGroupSelectorController = null;
    this._newProfileGroupSelectorController = null;
    this._motionController = null;
    this._motionBooted = false;
    this._pendingMotion = "";
    this._navigationTrail = new NavigationTrail({ profileId: this.profileId, subjectId: this.subjectId, activeSection: this.activeSection });
    this._navigationController = null;
    this._relationshipDrafts = new Map();
    this._portraitDrafts = new Map();
    this._fieldDrafts = new Map();
    this._focalPortraitDrafts = new Map();
    this._settingsTab = "general";
    this._bindingDrafts = new Map();
    this._settingsTabController = null;
    this._sectionScroll = new Map();
    this._navigationTail = Promise.resolve();
    this._permissionUnsubscribe = subscribePermissionChanges(() => this._onPermissionChanged());
    this._syncUnsubscribe = subscribeWorldStateChanges((event) => this._onWorldStateSync(event).catch((error) => console.warn("GMS Reputation | Master sync failed.", error)));
    this._saveController = new MasterSaveController({
      mode: getMasterSaveMode(),
      idleDelay: getMasterAutoSaveDelay(),
      onStatus: (snapshot) => this._updateSaveStatus(appElement(this), snapshot),
      onCommitted: async (_results, keys = []) => {
        this._refreshUndoRedoControls(appElement(this));
        if (keys.some((key) => key.startsWith("relationship:")) && this.rendered && !this._saveController.hasPending) {
          this._captureFormDrafts(appElement(this));
          await this.render({ force: true });
        }
      }
    });
  }

  async _prepareContext(options) {
    const parent = await super._prepareContext?.(options) ?? {};
    const state = loadWorldState();
    for (const draft of this._relationshipDrafts.values()) {
      const relationship = state.profiles?.[draft.profileId]?.relationships?.[draft.subjectId];
      const profile = state.profiles?.[draft.profileId];
      if (profile && state.subjects[draft.subjectId]) profile.relationships[draft.subjectId] = { ...relationship, subjectId: draft.subjectId, ...computeRelationshipCandidate(relationship ?? {}, draft.patch) };
    }
    for (const [id, portrait] of this._portraitDrafts) if (state.subjects[id]) state.subjects[id].portrait = portrait;
    for (const [id, portrait] of this._focalPortraitDrafts) if (state.profiles[id]) state.profiles[id].focal.portrait = portrait;
    const context = buildMasterPanelContext({ profileId: this.profileId, subjectId: this.subjectId, activeSection: this.activeSection, newProfileGroupId: this.newProfileGroupId, settingsTab: this._settingsTab, state });
    for (const row of context.playerBindings ?? []) {
      const draft = this._bindingDrafts.get(row.userId);
      if (!draft) continue;
      row.draft = true;
      for (const profile of row.profiles) profile.selected = profile.id === draft.profileId;
      for (const subject of row.subjects) subject.selected = subject.id === draft.subjectId;
    }
    this.profileId = context.profileId;
    this.subjectId = context.subjectId;
    this.activeSection = context.activeSection;
    this.newProfileGroupId = context.newProfileGroupId;
    this._saveController.configure({ mode: context.savePreferences.mode, idleDelay: context.savePreferences.idleDelay });
    this._lastContext = context;
    this._navigationTrail.entries[this._navigationTrail.index] = { profileId: this.profileId, subjectId: this.subjectId, activeSection: this.activeSection };
    return { ...parent, ...context };
  }

  async _onPermissionChanged() {
    if (!canOpenMasterPanel()) {
      notify("warn", "Seu acesso ao painel de controle da Matriz de Reputação foi removido.");
      if (this.rendered) await this.close();
      return;
    }
    if (this.rendered) await this.render({ force: true });
  }

  async _onWorldStateSync(event) {
    if (!this.rendered) return;
    const local = String(event.state?.metadata?.updatedBy || "") === String(globalThis.game?.user?.id || "");
    if (local && this._saveController.isSaving) return;
    if (this._saveController.hasPending || this._saveController.isSaving || this._fieldDrafts.size || this._focalPortraitDrafts.size) {
      if (!local) notify("warn", "Outro usuário atualizou a Matriz enquanto existem alterações locais pendentes. Salve ou descarte antes de continuar.");
      return;
    }
    this._pendingMotion = "sync";
    await this.render({ force: true });
  }

  _applyPermissionState(root, context) {
    if (!root?.querySelector) return;
    const rules = [
      ["relationship", context.permissions.canEditRelationships],
      ["portrait", context.permissions.canEditPortraits],
      ["subjects", context.permissions.canEditSubjects],
      ["profile", context.permissions.canEditSubjects],
      ["focal", context.permissions.canEditFocal],
      ["characters", context.permissions.canBulkEdit || context.permissions.canEditSubjects],
      ["history", context.permissions.canUndoRedo]
    ];
    for (const [section, allowed] of rules) {
      const panel = root.querySelector(`[data-master-section-panel="${section}"]`);
      if (!panel) continue;
      panel.dataset.permissionAllowed = String(Boolean(allowed));
      if (!allowed) for (const control of panel.querySelectorAll("button,input,select,textarea")) control.disabled = true;
    }
    if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.BULK)) {
      for (const control of root.querySelectorAll("[data-master-bulk] button, [data-master-bulk] input, [data-master-bulk] select, [data-master-bulk-subject], [data-master-bulk-select-all]")) control.disabled = true;
    }
    if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.SUBJECTS)) {
      for (const control of root.querySelectorAll("[data-master-subject-admin] button, [data-master-subject-admin] input, [data-master-subject-admin] select, [data-master-subject-admin] textarea")) control.disabled = true;
      for (const selector of root.querySelectorAll("[data-master-subject-admin] [data-smart-selector-toggle]")) selector.disabled = true;
    }
    const undo = root.querySelector("[data-master-undo]");
    const redo = root.querySelector("[data-master-redo]");
    if (!context.permissions.canUndoRedo) { if (undo) undo.disabled = true; if (redo) redo.disabled = true; }
  }

  _wirePermissionSettings(root) {
    const save = root.querySelector("[data-master-save-permissions]");
    if (!save) return;
    listen(this._listeners, save, "click", async () => {
      if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.CONFIGURE_PERMISSIONS)) {
        notify("warn", "Somente um Gamemaster completo pode alterar estas permissões.");
        return;
      }
      const current = getPermissionConfig();
      const next = { schema: 1, assistant: { ...current.assistant }, trusted: { ...current.trusted } };
      for (const input of root.querySelectorAll("[data-master-permission-role][data-master-permission-capability]")) {
        const role = String(input.dataset.masterPermissionRole || "");
        const capability = String(input.dataset.masterPermissionCapability || "");
        if (!next[role] || !capability) continue;
        next[role][capability] = Boolean(input.checked);
      }
      try {
        await setPermissionConfig(next);
        notify("info", "Permissões da Matriz de Reputação atualizadas.");
      } catch (error) {
        notify("error", error?.message || "Não foi possível salvar as permissões.");
      }
    });
  }

  _wireBackupControls(root) {
    const restore = root.querySelector("[data-master-restore-backup]");
    if (!restore) return;
    listen(this._listeners, restore, "click", async () => {
      if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.CONFIGURE_PERMISSIONS)) {
        notify("warn", "Somente um Gamemaster completo pode restaurar o backup mundial.");
        return;
      }
      if (this._saveController.hasPending) {
        notify("warn", "Salve ou descarte as alterações pendentes antes de restaurar um backup.");
        return;
      }
      const confirmed = await confirmMasterAction({
        title: "Restaurar backup mundial",
        message: "Restaurar o último snapshot automático da Matriz? O estado atual será preservado como novo backup antes do rollback.",
        confirmLabel: "Restaurar backup"
      });
      if (!confirmed) return;
      try {
        await restoreWorldStateBackup();
        notify("info", "Backup mundial restaurado com sucesso.");
        await this.render({ force: true });
      } catch (error) {
        notify("error", error?.message || "Não foi possível restaurar o backup mundial.");
      }
    });
  }

  _setSection(root, sectionId, { animate = true } = {}) {
    const workspace = normalizeWorkspace(sectionId);
    const visiblePanels = new Set(WORKSPACE_PANELS[workspace]);
    const content = root.querySelector(".gms-master-panel__content");
    if (content && animate) this._sectionScroll.set(this.activeSection, content.scrollTop);
    this.activeSection = workspace;
    root.dataset.masterActiveSection = workspace;
    for (const button of root.querySelectorAll("[data-master-section-choice]")) {
      const active = button.dataset.masterSectionChoice === workspace;
      button.dataset.active = String(active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      if (active) button.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
    if (content) content.scrollTop = this._sectionScroll.get(workspace) ?? 0;
    const location = root.querySelector("[data-navigation-location]");
    if (location) location.textContent = SECTIONS.find(([id]) => id === workspace)?.[1] ?? "Perfis";
    this._updateNavigationState(root);
    const panels = [...root.querySelectorAll("[data-master-section-panel]")];
    for (const panel of panels) {
      const visible = visiblePanels.has(String(panel.dataset.masterSectionPanel || ""));
      panel.hidden = !visible;
      panel.dataset.workspaceVisible = String(visible);
    }
    if (animate) {
      panels
        .filter((panel) => !panel.hidden)
        .forEach((panel, order) => this._motionController?.section?.(panel, order));
    }
  }

  _updateNavigationState(root) {
    const back = root?.querySelector?.("[data-navigation-back]");
    const forward = root?.querySelector?.("[data-navigation-forward]");
    if (back) back.disabled = !this._navigationTrail.canBack;
    if (forward) forward.disabled = !this._navigationTrail.canForward;
  }

  _navigate(target = {}, options = {}) {
    if (this._closingRequested) return Promise.resolve(this);
    const task = this._navigationTail.catch(() => undefined).then(() => this._navigateNow(target, options));
    this._navigationTail = task;
    return task;
  }

  async _navigateNow(target = {}, { record = true } = {}) {
    this._captureFormDrafts(appElement(this));
    const next = { profileId: this.profileId, subjectId: this.subjectId, activeSection: this.activeSection, ...target };
    next.activeSection = normalizeWorkspace(next.activeSection);
    if (next.activeSection === "cleanup" && !permissionContext().isFullGM) next.activeSection = "profiles";
    const contextChanged = next.profileId !== this.profileId || next.subjectId !== this.subjectId;
    const needsCleanup = next.activeSection === "cleanup" && this.activeSection !== "cleanup";
    const needsSettings = next.activeSection === "settings" && this.activeSection !== "settings";
    if (record) this._navigationTrail.visit(next);
    this.profileId = String(next.profileId || "");
    this.subjectId = String(next.subjectId || "");
    if (!contextChanged && !needsCleanup && !needsSettings && appElement(this)) {
      this._setSection(appElement(this), next.activeSection);
      return;
    }
    const content = appElement(this)?.querySelector?.(".gms-master-panel__content");
    if (content) this._sectionScroll.set(this.activeSection, content.scrollTop);
    this.activeSection = next.activeSection;
    this._pendingMotion = contextChanged ? "subject" : "profile";
    await this.render({ force: true });
  }

  _wireNavigation(root, context) {
    this._navigationController = wireNavigationPalette(root, {
      items: [
        ...context.sections.map((section) => ({ label: section.label, description: section.kicker, group: "ÁREAS", target: { activeSection: section.id } })),
        ...context.profiles.map((profile) => ({ label: profile.name, description: profile.groupName, group: "PERFIS", target: { profileId: profile.id } })),
        ...context.subjects.map((subject) => ({ label: subject.alias, description: subject.realName, group: "PERSONAGENS", target: { subjectId: subject.id, activeSection: "relationship" } }))
      ], onNavigate: (target) => this._navigate(target)
    });
    const travel = (direction) => {
      if (!(direction < 0 ? this._navigationTrail.canBack : this._navigationTrail.canForward)) return;
      return this._navigate(direction < 0 ? this._navigationTrail.back() : this._navigationTrail.forward(), { record: false });
    };
    listen(this._listeners, root.querySelector("[data-navigation-back]"), "click", () => travel(-1));
    listen(this._listeners, root.querySelector("[data-navigation-forward]"), "click", () => travel(1));
    listen(this._listeners, root, "keydown", (event) => {
      if (event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); travel(event.key === "ArrowLeft" ? -1 : 1); }
    });
    listen(this._listeners, root, "input", () => this._captureFormDrafts(root));
    listen(this._listeners, root, "change", () => this._captureFormDrafts(root));
    for (const button of root.querySelectorAll("[data-navigation-subject-step]")) listen(this._listeners, button, "click", () => {
      const id = adjacentId(context.subjects, this.subjectId, Number(button.dataset.navigationSubjectStep));
      if (id) return this._navigate({ subjectId: id });
    });
    listen(this._listeners, root.querySelector("[data-master-open-player]"), "click", () => openPlayerDashboard({ profileId: this.profileId }));
    this._updateNavigationState(root);
  }

  _contextIds(root) {
    const surface = root?.matches?.("[data-master-panel-root]") ? root : root?.querySelector?.("[data-master-panel-root]");
    return { profileId: surface?.dataset?.masterContextProfile ?? this.profileId, subjectId: surface?.dataset?.masterContextSubject ?? this.subjectId, groupId: surface?.dataset?.masterContextGroup ?? this._lastContext?.profileEditor?.groupId };
  }

  _captureFormDrafts(root) {
    if (!root?.querySelector) return;
    const { profileId, subjectId, groupId } = this._contextIds(root);
    for (const [scope, id, fields] of [
      ["subject", subjectId, ["alias", "real-name", "description", "tags", "active", "archived"]],
      ["focal", profileId, ["name", "description"]],
      ["profile-editor", profileId, ["name", "active", "archived"]]
    ]) {
      const values = [];
      let changed = false;
      for (const field of fields) {
        const selector = `[data-master-${scope}-${field}]`;
        const node = root.querySelector(selector);
        if (!node) continue;
        const check = node.type === "checkbox";
        const value = check ? node.checked : node.value;
        if (value !== (check ? node.defaultChecked : node.defaultValue)) changed = true;
        values.push({ selector, value, check });
      }
      if (scope === "profile-editor") {
        const group = root.querySelector('[data-master-profile-editor-group-choice][aria-pressed="true"]');
        const selected = group?.dataset.masterProfileEditorGroupChoice;
        if (selected) {
          const persisted = groupId;
          changed ||= selected !== persisted;
          values.push({ group: selected });
        }
      }
      const key = `${scope}:${id}`;
      if (changed) {
        if (JSON.stringify(this._fieldDrafts.get(key)) !== JSON.stringify(values)) this._fieldDrafts.set(key, values);
      } else this._fieldDrafts.delete(key);
    }
  }

  _restoreFormDrafts(root) {
    for (const key of [`subject:${this.subjectId}`, `focal:${this.profileId}`, `profile-editor:${this.profileId}`]) {
      for (const field of this._fieldDrafts.get(key) ?? []) {
        if (field.group) {
          for (const button of root.querySelectorAll("[data-master-profile-editor-group-choice]")) {
            const active = button.dataset.masterProfileEditorGroupChoice === field.group;
            button.dataset.active = String(active); button.setAttribute("aria-pressed", String(active));
          }
        } else {
          const node = root.querySelector(field.selector);
          if (node) { if (field.check) node.checked = field.value; else node.value = field.value; }
        }
      }
    }
    const draft = this._relationshipDrafts.get(`relationship:${this.profileId}:${this.subjectId}`);
    const reason = root.querySelector('[data-master-reason="single"]');
    if (draft && reason) reason.value = draft.reason;
  }

  _reason(root, scope = "single") {
    return String(root.querySelector(`[data-master-reason="${scope}"]`)?.value || "").trim();
  }

  _selectedBulkIds(root) {
    return Array.from(root.querySelectorAll("[data-master-bulk-subject]:checked"), (input) => String(input.value || "")).filter(Boolean);
  }

  _refreshUndoRedoControls(root) {
    if (!root?.querySelector) return;
    const stack = buildUndoRedoState();
    if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.BULK)) {
      for (const control of root.querySelectorAll("[data-master-bulk] button, [data-master-bulk] input, [data-master-bulk] select, [data-master-bulk-subject], [data-master-bulk-select-all]")) control.disabled = true;
    }
    if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.SUBJECTS)) {
      for (const control of root.querySelectorAll("[data-master-subject-admin] button, [data-master-subject-admin] input, [data-master-subject-admin] select, [data-master-subject-admin] textarea")) control.disabled = true;
      for (const selector of root.querySelectorAll("[data-master-subject-admin] [data-smart-selector-toggle]")) selector.disabled = true;
    }
    const undo = root.querySelector("[data-master-undo]");
    const redo = root.querySelector("[data-master-redo]");
    const allowed = canUser(globalThis.game?.user, MODULE_CAPABILITY.HISTORY);
    if (undo) {
      undo.disabled = !allowed || !stack.canUndo;
      undo.title = stack.undoTarget?.label || "Nada para desfazer";
    }
    if (redo) {
      redo.disabled = !allowed || !stack.canRedo;
      redo.title = stack.redoTarget?.label || "Nada para refazer";
    }
  }

  _updateSaveStatus(root, snapshot = this._saveController.snapshot()) {
    if (!root?.querySelector) return;
    const bar = root.querySelector("[data-master-save-state]");
    if (bar) {
      bar.dataset.masterSaveState = snapshot.status;
      bar.dataset.pendingCount = String(snapshot.pendingCount);
    }
    const label = root.querySelector("[data-master-save-label]");
    if (label) label.textContent = snapshot.label;
    const count = root.querySelector("[data-master-save-pending-count]");
    if (count) count.textContent = snapshot.pendingCount ? `${snapshot.pendingCount} pendente${snapshot.pendingCount === 1 ? "" : "s"}` : "buffer limpo";
    const saveNow = root.querySelector("[data-master-save-now]");
    if (saveNow) {
      const canCaptureRelationship = Boolean(this.profileId && this.subjectId && canUser(globalThis.game?.user, MODULE_CAPABILITY.RELATIONSHIPS));
      saveNow.disabled = snapshot.status === "saving" || (!snapshot.hasPending && !canCaptureRelationship);
      saveNow.dataset.saveReady = String(Boolean(snapshot.hasPending || canCaptureRelationship));
    }
    const discard = root.querySelector("[data-master-discard-pending]");
    if (discard) discard.disabled = !snapshot.hasPending || snapshot.status === "saving";
  }

  _queueRelationshipDraft(root) {
    if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.RELATIONSHIPS)) return;
    const scoreInput = root.querySelector("[data-master-score-input]");
    const bondInput = root.querySelector("[data-master-bond]");
    const communionInput = root.querySelector("[data-master-communion]");
    const { profileId, subjectId } = this._contextIds(root);
    if (!scoreInput || !bondInput || !communionInput || !profileId || !subjectId) return;
    const patch = {
      score: Number(scoreInput.value),
      bond: Boolean(bondInput.checked),
      communion: Boolean(communionInput.checked)
    };
    const reason = this._reason(root);
    const key = `relationship:${profileId}:${subjectId}`;
    const draft = { profileId, subjectId, patch, reason };
    this._relationshipDrafts.set(key, draft);
    this._saveController.queue(key, async () => {
      const result = await updateRelationship(profileId, subjectId, patch, { reason });
      if (this._relationshipDrafts.get(key) === draft) this._relationshipDrafts.delete(key);
      return result;
    });
  }

  async _flushPending(successMessage = "Alterações sincronizadas.") {
    try {
      const hadPending = this._saveController.hasPending;
      await this._saveController.flush();
      if (hadPending) notify("info", successMessage);
    } catch (error) {
      console.error("GMS Reputation | Pending save failed", error);
      notify("error", error?.message || "Não foi possível salvar as alterações pendentes.");
    }
  }

  _saveFormDrafts(scope, id, action) {
    this._captureFormDrafts(appElement(this));
    const key = `${scope}:${id}`;
    const fields = this._fieldDrafts.get(key);
    const portrait = scope === "focal" ? this._focalPortraitDrafts.get(id) : null;
    return async () => {
      const result = await action();
      if (this._fieldDrafts.get(key) === fields) this._fieldDrafts.delete(key);
      if (scope === "focal" && this._focalPortraitDrafts.get(id) === portrait) this._focalPortraitDrafts.delete(id);
      return result;
    };
  }

  async _runMutation(action, successMessage) {
    try {
      const beforeRevision = loadWorldState().revision;
      const result = await this._saveController.runImmediate(action, { flushPending: true });
      const changed = result && Number(result.revision) !== Number(beforeRevision);
      notify("info", changed ? successMessage : "Nenhuma alteração necessária.");
      await this.render({ force: true });
      return result;
    } catch (error) {
      console.error("GMS Reputation | Master mutation failed", error);
      notify("error", error?.message || "Não foi possível aplicar a alteração.");
    }
  }

  _wireQuickEdit(root) {
    this._controlControllers.push(wireMasterRelationshipControls(root, {
      getMotionController: () => this._motionController,
      queueDraft: () => this._queueRelationshipDraft(root),
      flushPending: (message) => this._flushPending(message)
    }));
  }

  _wirePortrait(root, context) {
    this._portraitController?.destroy?.();
    this._portraitController = wireMasterPortraitControls(root, context, {
      contextIds: () => this._contextIds(root),
      getReason: () => this._reason(root),
      queueDraft: (...args) => this._queuePortraitDraft(...args),
      flushPending: (message) => this._flushPending(message)
    });
  }

  _queuePortraitDraft(subjectId, snapshot, profileId, reason) {
    this._portraitDrafts.set(subjectId, snapshot);
    this._saveController.queue(`portrait:${subjectId}`, async () => {
      const result = await setSubjectPortrait(subjectId, snapshot, { profileId, reason });
      if (this._portraitDrafts.get(subjectId) === snapshot) this._portraitDrafts.delete(subjectId);
      return result;
    });
  }

  _wireFocal(root, context) {
    this._focalPortraitController?.destroy?.();
    this._focalPortraitController = wireMasterFocalControls(root, context, {
      hasProfile: () => Boolean(this.profileId),
      contextIds: () => this._contextIds(root),
      onPortraitChange: (id, portrait) => this._focalPortraitDrafts.set(id, portrait),
      runMutation: (action, message) => this._runMutation(action, message),
      saveFormDrafts: (scope, id, action) => this._saveFormDrafts(scope, id, action)
    });
  }

  _wireRegistry(root) {
    this._controlControllers.push(wireMasterRegistryControls(root, {
      getSelection: () => ({ profileId: this.profileId, subjectId: this.subjectId, newProfileGroupId: this.newProfileGroupId }),
      contextIds: () => this._contextIds(root),
      navigate: (target) => this._navigate(target),
      runMutation: (action, message) => this._runMutation(action, message),
      saveFormDrafts: (scope, id, action) => this._saveFormDrafts(scope, id, action),
      onProfileChange: (id) => { this.profileId = id; },
      onNewProfileGroupChange: (id) => { this.newProfileGroupId = id; },
      isRendered: () => this.rendered,
      render: (options) => this.render(options)
    }));
  }

  _wirePlayerBindings(root, context) {
    this._settingsTabController = wireMasterPlayerBindings(root, {
      isFullGM: context.permissions.isFullGM,
      selectedTab: this._settingsTab,
      drafts: this._bindingDrafts,
      onTabChange: (tab) => { this._settingsTab = tab; },
      onSaved: async () => {
        this._captureFormDrafts(root);
        if (this.rendered) await this.render({ force: true });
      }
    });
  }

  _wireCleanup(root, context) {
    this._controlControllers.push(wireMasterCleanupControls(root, {
      isFullGM: context?.permissions?.isFullGM,
      runMutation: (action, message) => this._runMutation(action, message)
    }));
  }

  _wireBulk(root) {
    this._controlControllers.push(wireMasterBulkControls(root, {
      selectedIds: () => this._selectedBulkIds(root),
      contextIds: () => this._contextIds(root),
      getReason: () => this._reason(root, "bulk"),
      runMutation: (action, message) => this._runMutation(action, message)
    }));
  }

  async _runUndoRedo(direction, target) {
    if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.HISTORY)) { notify("warn", "Você não possui permissão para desfazer/refazer alterações."); return; }
    if (this._saveController.hasPending) {
      notify("warn", "Salve ou descarte as alterações pendentes antes de desfazer/refazer.");
      return;
    }
    if (!target?.transactionId) return;
    const confirmed = await confirmMasterAction({
      title: direction === "undo" ? "Desfazer alteração" : "Refazer alteração",
      message: `${direction === "undo" ? "Desfazer" : "Refazer"} “${target.label}”? A operação será registrada no histórico e poderá ser ${direction === "undo" ? "refeita" : "desfeita"} novamente.`,
      confirmLabel: direction === "undo" ? "Desfazer" : "Refazer"
    });
    if (!confirmed) return;
    await this._runMutation(
      () => direction === "undo" ? undoLastTransaction() : redoLastTransaction(),
      direction === "undo" ? "Última alteração desfeita." : "Alteração refeita."
    );
  }

  _wireSaveControls(root, context) {
    this._updateSaveStatus(root);
    listen(this._listeners, root.querySelector("[data-master-save-now]"), "click", async (event) => {
      event?.preventDefault?.();
      // Explicit save must be authoritative: re-read the current relationship
      // controls before flushing instead of relying only on prior input events.
      this._queueRelationshipDraft(root);
      await this._flushPending();
      this._updateSaveStatus(root);
    });
    listen(this._listeners, root.querySelector("[data-master-discard-pending]"), "click", async () => {
      if (!this._saveController.hasPending) return;
      const confirmed = await confirmMasterAction({
        title: "Descartar alterações pendentes",
        message: "Descartar as alterações locais que ainda não foram gravadas?",
        confirmLabel: "Descartar"
      });
      if (!confirmed) return;
      this._saveController.discard();
      this._relationshipDrafts.clear(); this._portraitDrafts.clear();
      await this.render({ force: true });
    });

    const modeSelect = root.querySelector("[data-master-save-mode]");
    const delayInput = root.querySelector("[data-master-autosave-delay]");
    listen(this._listeners, modeSelect, "change", async () => {
      const mode = await setMasterSaveMode(modeSelect.value);
      this._saveController.configure({ mode });
      if (delayInput) delayInput.disabled = mode !== MASTER_SAVE_MODE.IDLE;
      this._updateSaveStatus(root);
    });
    listen(this._listeners, delayInput, "change", async () => {
      const delay = await setMasterAutoSaveDelay(delayInput.value);
      delayInput.value = String(delay);
      this._saveController.configure({ idleDelay: delay });
    });

    listen(this._listeners, root.querySelector("[data-master-undo]"), "click", () => this._runUndoRedo("undo", context.undoRedo.undoTarget));
    listen(this._listeners, root.querySelector("[data-master-redo]"), "click", () => this._runUndoRedo("redo", context.undoRedo.redoTarget));
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this._portraitVisibilityController?.destroy?.();
    this._portraitVisibilityController = null;
    for (const controller of this._controlControllers.splice(0)) controller?.destroy();
    destroyListeners(this._listeners);
    this._portraitController?.destroy?.();
    this._portraitController = null;
    this._focalPortraitController?.destroy?.();
    this._focalPortraitController = null;
    this._accessibilityController?.destroy?.();
    this._accessibilityController = null;
    this._motionController?.destroy?.();
    this._motionController = null;
    this._profileSelectorController?.destroy?.();
    this._profileSelectorController = null;
    this._subjectSelectorController?.destroy?.();
    this._subjectSelectorController = null;
    this._profileGroupSelectorController?.destroy?.();
    this._profileGroupSelectorController = null;
    this._newProfileGroupSelectorController?.destroy?.();
    this._newProfileGroupSelectorController = null;
    this._navigationController?.destroy?.();
    this._settingsTabController?.destroy?.();
    const root = appElement(this);
    if (!root) return;
    this._motionController = wireMotionSystem(root, { kind: "master", boot: !this._motionBooted });
    this._motionBooted = true;
    if (this._pendingMotion === "sync") this._motionController.sync?.(root);
    else if (this._pendingMotion) this._motionController.transition?.(this._pendingMotion, root);
    this._pendingMotion = "";
    const profileSelector = root.querySelector('[data-smart-selector="master-profile"]');
    const subjectSelector = root.querySelector('[data-smart-selector="master-subject"]');
    this._profileSelectorController = wireSmartSelector(profileSelector, {
      onSelect: (value) => this._navigate({ profileId: String(value || "") })
    });
    this._subjectSelectorController = wireSmartSelector(subjectSelector, {
      onSelect: (value) => this._navigate({ subjectId: String(value || "") })
    });
    for (const button of root.querySelectorAll("[data-master-subject-choice]")) {
      listen(this._listeners, button, "click", async () => {
        await this._navigate({ subjectId: String(button.dataset.masterSubjectChoice || "") });
      });
    }
    for (const button of root.querySelectorAll("[data-master-section-choice]")) listen(this._listeners, button, "click", () => this._navigate({ activeSection: button.dataset.masterSectionChoice }));

    this._wireSaveControls(root, context);
    this._wireRegistry(root);
    this._wireQuickEdit(root);
    this._wirePortrait(root, context);
    this._wireFocal(root, context);
    this._wireBulk(root);
    this._wireCleanup(root, context);
    this._wirePlayerBindings(root, context);
    this._wirePermissionSettings(root);
    this._wireBackupControls(root);
    this._wireNavigation(root, context);
    this._restoreFormDrafts(root);
    this._applyPermissionState(root, context);
    this._accessibilityController = wireApplicationAccessibility(root, { onEscape: () => this.close(), tablistRoot: root.querySelector("[role=tablist]") ?? root });
    this._setSection(root, this.activeSection, { animate: false });
    this._portraitVisibilityController = wirePortraitVisibility(root);
    registerReputationFeedbackSurface(this, { kind: "master", profileId: () => this.profileId, onInspect: (target) => this._navigate({ ...target, activeSection: "relationship" }) });
  }

  async close(options = {}) {
    if (this._closingRequested) return this;
    this._closingRequested = true;
    try {
      await this._navigationTail.catch(() => undefined);
      if (this._saveController.isSaving) await this._saveController.whenIdle();
      this._captureFormDrafts(appElement(this));
      if (canOpenMasterPanel() && (this._saveController.hasPending || this._fieldDrafts.size || this._focalPortraitDrafts.size || this._bindingDrafts.size)) {
        const confirmed = await confirmMasterAction({ title: "Fechar com alterações pendentes", message: "Há edições não salvas neste painel. Fechar e descartar esses rascunhos?", confirmLabel: "Fechar e descartar" });
        if (!confirmed) return this;
      }
      return await super.close(options);
    } finally { this._closingRequested = false; }
  }

  async _onClose(options) {
    this._portraitVisibilityController?.destroy?.(); this._portraitVisibilityController = null;
    this._settingsTabController?.destroy?.(); this._settingsTabController = null;
    this._navigationController?.destroy?.(); this._navigationController = null;
    unregisterReputationFeedbackSurface(this);
    for (const controller of this._controlControllers.splice(0)) controller?.destroy();
    destroyListeners(this._listeners);
    this._portraitController?.destroy?.();
    this._portraitController = null;
    this._focalPortraitController?.destroy?.();
    this._focalPortraitController = null;
    this._accessibilityController?.destroy?.();
    this._accessibilityController = null;
    this._motionController?.destroy?.();
    this._motionController = null;
    this._profileSelectorController?.destroy?.();
    this._profileSelectorController = null;
    this._subjectSelectorController?.destroy?.();
    this._subjectSelectorController = null;
    this._profileGroupSelectorController?.destroy?.();
    this._profileGroupSelectorController = null;
    this._newProfileGroupSelectorController?.destroy?.();
    this._newProfileGroupSelectorController = null;
    this._permissionUnsubscribe?.();
    this._permissionUnsubscribe = null;
    this._syncUnsubscribe?.();
    this._syncUnsubscribe = null;
    if (this._saveController.hasPending) {
      this._saveController.discard();
      notify("warn", "Alterações pendentes não salvas foram descartadas ao fechar o painel.");
    }
    this._bindingDrafts.clear();
    this._saveController.destroy();
    return super._onClose?.(options);
  }
}

let masterPanelApp = null;

export function openMasterPanel(options = {}) {
  if (!canOpenMasterPanel()) {
    notify("warn", "Sua função atual não possui acesso ao painel de controle da Matriz de Reputação.");
    return null;
  }
  try {
    if (masterPanelApp?.rendered) {
      const target = Object.fromEntries(["profileId", "subjectId", "activeSection"].filter((key) => options[key]).map((key) => [key, String(options[key])]));
      if (Object.keys(target).length) {
        masterPanelApp._navigate(target).catch((error) => notify("error", error?.message || "Não foi possível navegar no painel."));
        return masterPanelApp;
      }
      masterPanelApp._captureFormDrafts(appElement(masterPanelApp));
      return renderApplicationSafely(masterPanelApp, { label: "Controle de Reputação" });
    }
    masterPanelApp = new ReputationMasterPanelApplication(options);
    const rendered = renderApplicationSafely(masterPanelApp, { label: "Controle de Reputação" });
    if (!rendered) masterPanelApp = null;
    return rendered;
  } catch (error) {
    console.error("GMS Reputation | Falha ao criar o Painel do Mestre.", error);
    notify("error", `Controle de Reputação não pôde ser aberto. ${String(error?.message || error || "Erro de inicialização")}`);
    masterPanelApp = null;
    return null;
  }
}

export function getOpenMasterPanel() {
  return masterPanelApp?.rendered ? masterPanelApp : null;
}
