import { DATA_SCHEMA_VERSION, MASTER_SAVE_MODE, MODULE_ID, MODULE_VERSION } from "../constants.js";
import { loadWorldState, loadWorldStateBackup, restoreWorldStateBackup } from "../persistence/world-store.js";
import { buildIdentityModel } from "../components/identity.js";
import { buildPortraitFrameModel } from "../components/portrait-frame.js";
import { buildPortraitEditorContext, wirePortraitEditor } from "../components/portrait-editor.js";
import { buildHeartTrackModel } from "../components/heart-track.js";
import { buildFocalProfileContext } from "../components/focal-profile.js";
import { getReputationView } from "../core/reputation-engine.js";
import { getSemanticBand } from "../core/semantic-bands.js";
import { updateRelationship } from "../data/reputation-registry.js";
import { setSubjectPortrait } from "../data/portrait-registry.js";
import { createNewSubject, updateSubject, moveSubjectOneStep } from "../data/subject-registry.js";
import { createNewProfile, setProfileSubjectIncluded, updateFocalProfile, updateProfile, moveProfileOneStep } from "../data/profile-registry.js";
import { createNewGroup, renameGroup, moveGroup } from "../data/group-registry.js";
import { buildCleanupImpact, deleteGroupPermanently, deleteProfilePermanently, deleteSubjectPermanently } from "../data/destructive-operations.js";
import { applyBulkRelationshipChanges, bulkArchiveSubjects, bulkSetSubjectsActive, moveSubjects } from "../data/bulk-operations.js";
import { listHistory } from "../data/history-registry.js";
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
import { buildSmartSelectorContext, wireSmartSelector } from "../components/smart-selector.js";

const SECTIONS = Object.freeze([
  ["profiles", "Perfis", "fa-layer-group", "MATRIZES"],
  ["characters", "Personagens", "fa-user-pen", "CADASTRO"],
  ["relationship", "Reputação", "fa-heart-pulse", "RELAÇÕES"],
  ["history", "Histórico", "fa-clock-rotate-left", "AUDITORIA"],
  ["cleanup", "Limpeza", "fa-trash-can", "DADOS"],
  ["settings", "Sistema", "fa-sliders", "CONTROLE"]
]);

const WORKSPACE_PANELS = Object.freeze({
  profiles: Object.freeze(["subjects", "profile", "focal"]),
  characters: Object.freeze(["characters", "portrait"]),
  relationship: Object.freeze(["relationship"]),
  history: Object.freeze(["history"]),
  cleanup: Object.freeze(["cleanup"]),
  settings: Object.freeze(["settings"])
});

const LEGACY_SECTION_WORKSPACE = Object.freeze({
  subjects: "profiles",
  profile: "profiles",
  focal: "profiles",
  portrait: "characters"
});

function normalizeWorkspace(value = "profiles") {
  const requested = String(value || "profiles");
  const mapped = LEGACY_SECTION_WORKSPACE[requested] ?? requested;
  return Object.hasOwn(WORKSPACE_PANELS, mapped) ? mapped : "profiles";
}

const PARTIALS = [
  `modules/${MODULE_ID}/templates/partials/background-art.hbs`,
  `modules/${MODULE_ID}/templates/partials/portrait-frame.hbs`,
  `modules/${MODULE_ID}/templates/partials/portrait-editor.hbs`,
  `modules/${MODULE_ID}/templates/partials/identity.hbs`,
  `modules/${MODULE_ID}/templates/partials/heart-track.hbs`,
  `modules/${MODULE_ID}/templates/partials/focal-profile.hbs`,
  `modules/${MODULE_ID}/templates/partials/smart-selector.hbs`
];

function listProfiles(state) {
  return Object.values(state.profiles ?? {}).sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name), "pt-BR"));
}

function listSubjects(state) {
  return Object.values(state.subjects ?? {}).sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.realName).localeCompare(String(b.realName), "pt-BR"));
}

function listGroups(state) {
  return Object.values(state.groups ?? {})
    .filter((group) => !group.archived)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name), "pt-BR"));
}

function normalizeUiSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function quickPresets(limit = 10) {
  const values = [-10, -5, 0, 3, 6, 9, Number(limit) || 10];
  const labels = ["Hostil", "Cautela", "Neutro", "Contato", "Confiança", "Aliado", "Máximo"];
  return Object.freeze(values.map((value, index) => {
    const band = getSemanticBand(value, { bond: Number(limit) > 10 });
    return Object.freeze({ value, label: labels[index], tone: band.id, accent: band.accent });
  }));
}

function saveModeOptions(current) {
  return Object.freeze([
    { value: MASTER_SAVE_MODE.MANUAL, label: "Manual", selected: current === MASTER_SAVE_MODE.MANUAL },
    { value: MASTER_SAVE_MODE.AUTOMATIC, label: "Automático", selected: current === MASTER_SAVE_MODE.AUTOMATIC },
    { value: MASTER_SAVE_MODE.IDLE, label: "Após pausa", selected: current === MASTER_SAVE_MODE.IDLE }
  ].map(Object.freeze));
}

function backupStatus() {
  try {
    const backup = loadWorldStateBackup();
    if (!backup) return Object.freeze({ available: false, revision: null, updatedAtText: "Nenhum backup disponível" });
    const stamp = Number(backup.metadata?.updatedAt) || Number(backup.metadata?.createdAt) || 0;
    const updatedAtText = stamp ? new Date(stamp).toLocaleString("pt-BR") : "Data indisponível";
    return Object.freeze({ available: true, revision: Number(backup.revision) || 0, updatedAtText });
  } catch (_error) {
    return Object.freeze({ available: false, revision: null, updatedAtText: "Backup indisponível" });
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

async function confirmMasterAction({ title, message, confirmLabel = "Confirmar" } = {}) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (typeof DialogV2?.confirm === "function") {
    return DialogV2.confirm({
      window: { title: String(title || "Confirmar operação"), icon: "fa-solid fa-triangle-exclamation" },
      content: `<p>${escapeHTML(message)}</p>`,
      yes: { label: String(confirmLabel || "Confirmar"), icon: "fa-solid fa-check" },
      no: { label: "Cancelar", icon: "fa-solid fa-xmark" },
      rejectClose: false,
      modal: true
    });
  }
  if (typeof globalThis.confirm === "function") return globalThis.confirm(String(message || title || "Confirmar?"));
  return true;
}

export function buildMasterPanelContext({ profileId = "", subjectId = "", activeSection = "profiles", newProfileGroupId = "", state = loadWorldState() } = {}) {
  const profiles = listProfiles(state);
  const subjects = listSubjects(state);
  const groups = listGroups(state);
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const profile = profiles.find((entry) => entry.id === String(profileId)) ?? profiles[0] ?? null;
  const subject = subjects.find((entry) => entry.id === String(subjectId)) ?? subjects[0] ?? null;
  const relationship = profile && subject ? (profile.relationships?.[subject.id] ?? { subjectId: subject.id, score: 0 }) : null;
  const view = relationship ? getReputationView(relationship) : null;
  const sectionId = normalizeWorkspace(activeSection);
  const history = listHistory({ state, profileId: profile?.id, subjectId: subject?.id, limit: 80 });
  const undoRedo = buildUndoRedoState(state);
  const saveMode = getMasterSaveMode();
  const idleDelay = getMasterAutoSaveDelay();
  const permissions = permissionContext();
  const backup = backupStatus();
  const cleanup = buildCleanupImpact(state);

  const profilesByGroup = new Map(groups.map((group) => [group.id, []]));
  const ungroupedProfiles = [];
  for (const entry of profiles) {
    const bucket = entry.groupId ? profilesByGroup.get(entry.groupId) : null;
    if (bucket) bucket.push(entry);
    else ungroupedProfiles.push(entry);
  }
  const profileGroups = groups.map((group, index) => {
    const entries = profilesByGroup.get(group.id) ?? [];
    return Object.freeze({
      id: group.id,
      name: group.name,
      description: group.description || "",
      system: false,
      canMoveUp: index > 0,
      canMoveDown: index < groups.length - 1,
      profiles: Object.freeze(entries.map((entry) => Object.freeze({
        id: entry.id,
        name: String(entry.name || "Perfil"),
        focalName: String(entry.focal?.name || entry.name || "Perfil"),
        image: String(entry.focal?.portrait?.src || ""),
        active: entry.active !== false,
        archived: Boolean(entry.archived),
        selected: entry.id === profile?.id
      })))
    });
  });
  profileGroups.push(Object.freeze({
    id: "__ungrouped__",
    name: "Sem Grupo",
    description: "Perfis ainda não organizados em uma categoria.",
    system: true,
    canMoveUp: false,
    canMoveDown: false,
    profiles: Object.freeze(ungroupedProfiles.map((entry) => Object.freeze({
      id: entry.id,
      name: String(entry.name || "Perfil"),
      focalName: String(entry.focal?.name || entry.name || "Perfil"),
      image: String(entry.focal?.portrait?.src || ""),
      active: entry.active !== false,
      archived: Boolean(entry.archived),
      selected: entry.id === profile?.id
    })))
  }));

  const groupSelectorItems = [
    { value: "__ungrouped__", primary: "Sem Grupo", secondary: "Perfil ainda não classificado", badge: "SISTEMA" },
    ...groups.map((group) => ({
      value: group.id,
      primary: group.name,
      secondary: `${(profilesByGroup.get(group.id) ?? []).length} perfil(is)`,
      badge: "GRUPO"
    }))
  ];
  const initialNewProfileGroup = groupSelectorItems.some((item) => item.value === String(newProfileGroupId))
    ? String(newProfileGroupId)
    : (groups[0]?.id ?? "__ungrouped__");
  const selectedProfileGroup = profile?.groupId && groupMap.has(profile.groupId) ? profile.groupId : "__ungrouped__";
  const profileRoster = new Set(Array.isArray(profile?.subjectIds) ? profile.subjectIds.map(String) : Object.keys(profile?.relationships ?? {}));
  const profileGroupChoices = Object.freeze(groupSelectorItems.map((item) => Object.freeze({
    ...item,
    active: String(item.value) === String(selectedProfileGroup)
  })));
  const sameGroupProfiles = profile
    ? profiles.filter((entry) => (entry.groupId ?? null) === (profile.groupId ?? null))
    : [];
  const profileGroupIndex = profile ? sameGroupProfiles.findIndex((entry) => entry.id === profile.id) : -1;
  const profileEditor = profile ? Object.freeze({
    id: profile.id,
    name: String(profile.name || "Perfil"),
    focalName: String(profile.focal?.name || profile.name || "Perfil focal"),
    groupId: selectedProfileGroup,
    groupName: selectedProfileGroup === "__ungrouped__" ? "Sem Grupo" : String(groupMap.get(selectedProfileGroup)?.name || "Sem Grupo"),
    active: profile.active !== false,
    archived: Boolean(profile.archived),
    sortOrder: Number(profile.sortOrder) || 0,
    canMoveUp: profileGroupIndex > 0,
    canMoveDown: profileGroupIndex >= 0 && profileGroupIndex < sameGroupProfiles.length - 1,
    rosterCount: profileRoster.size,
    relationshipCount: Object.keys(profile.relationships ?? {}).length,
    totalSubjects: subjects.length,
    updatedAtText: profile.metadata?.updatedAt ? new Date(Number(profile.metadata.updatedAt)).toLocaleString("pt-BR") : "Sem registro"
  }) : null;
  const newProfileGroupChoices = Object.freeze(groupSelectorItems.map((item) => Object.freeze({
    ...item,
    active: String(item.value) === String(initialNewProfileGroup)
  })));

  return Object.freeze({
    authorized: permissions.canOpenMaster,
    permissions,
    permissionRoles: Object.freeze([
      Object.freeze({ id: "assistant", label: "Assistant GM", policy: permissions.config.assistant }),
      Object.freeze({ id: "trusted", label: "Trusted Player", policy: permissions.config.trusted })
    ]),
    profileId: profile?.id ?? "",
    subjectId: subject?.id ?? "",
    newProfileGroupId: initialNewProfileGroup,
    profileName: profile?.name ?? "Sem perfil",
    profileEditor,
    profiles: Object.freeze(profiles.map((entry) => Object.freeze({
      id: entry.id,
      name: entry.name,
      groupId: entry.groupId ?? null,
      groupName: entry.groupId && groupMap.has(entry.groupId) ? groupMap.get(entry.groupId).name : "Sem Grupo",
      selected: entry.id === profile?.id,
      archived: entry.archived
    }))),
    profileSelector: buildSmartSelectorContext({
      id: "master-profile",
      label: "Perfil",
      value: profile?.id ?? "",
      searchPlaceholder: "Buscar perfil…",
      emptyText: "Nenhum perfil corresponde à busca.",
      items: profiles.map((entry) => ({
        value: entry.id,
        primary: String(entry.focal?.name || entry.name || "Perfil"),
        secondary: [
          entry.focal?.name && entry.name !== entry.focal.name ? String(entry.name) : "Perfil social",
          entry.groupId && groupMap.has(entry.groupId) ? groupMap.get(entry.groupId).name : "Sem Grupo"
        ].join(" // "),
        badge: entry.archived ? "ARQUIVADO" : entry.id === profile?.id ? "ATIVO" : "",
        image: String(entry.focal?.portrait?.src || "")
      }))
    }),
    groups: Object.freeze(groups.map((group) => Object.freeze({ id: group.id, name: group.name, sortOrder: group.sortOrder }))),
    profileGroups: Object.freeze(profileGroups),
    newProfileGroupSelector: buildSmartSelectorContext({
      id: "master-new-profile-group",
      label: "Grupo do novo perfil",
      value: initialNewProfileGroup,
      searchable: groups.length >= 6,
      items: groupSelectorItems
    }),
    profileGroupSelector: buildSmartSelectorContext({
      id: "master-profile-group",
      label: "Grupo do perfil atual",
      value: selectedProfileGroup,
      searchable: groups.length >= 6,
      items: groupSelectorItems
    }),
    profileGroupChoices,
    newProfileGroupChoices,
    subjects: Object.freeze(subjects.map((entry) => Object.freeze({
      id: entry.id,
      alias: String(entry.alias || entry.realName || "Sem identificação"),
      realName: String(entry.realName || ""),
      active: entry.active !== false,
      archived: Boolean(entry.archived),
      selected: entry.id === subject?.id,
      inProfile: profileRoster.has(String(entry.id))
    }))),
    subjectEditor: subject ? Object.freeze({
      id: subject.id,
      alias: String(subject.alias || subject.realName || "Sem identificação"),
      realName: String(subject.realName || ""),
      description: String(subject.description || ""),
      tagsText: Array.isArray(subject.metadata?.tags) ? subject.metadata.tags.join(", ") : "",
      active: subject.active !== false,
      archived: Boolean(subject.archived),
      canMoveUp: subjects.findIndex((entry) => entry.id === subject.id) > 0,
      canMoveDown: subjects.findIndex((entry) => entry.id === subject.id) >= 0 && subjects.findIndex((entry) => entry.id === subject.id) < subjects.length - 1
    }) : null,
    subjectSelector: buildSmartSelectorContext({
      id: "master-subject",
      label: "Personagem",
      value: subject?.id ?? "",
      searchPlaceholder: "Buscar personagem…",
      emptyText: "Nenhum personagem corresponde à busca.",
      items: subjects.map((entry) => ({
        value: entry.id,
        primary: String(entry.alias || entry.realName || "Sem identificação"),
        secondary: String(entry.realName || "Personagem avaliado"),
        badge: entry.archived ? "ARQUIVADO" : entry.active === false ? "INATIVO" : !profileRoster.has(String(entry.id)) ? "FORA DO PERFIL" : entry.id === subject?.id ? "ATIVO" : "",
        image: String(entry.portrait?.src || "")
      }))
    }),
    sections: Object.freeze(SECTIONS
      .filter(([id]) => id !== "cleanup" || permissions.isFullGM)
      .map(([id, label, icon, kicker]) => Object.freeze({ id, label, icon, kicker, active: id === sectionId }))),
    cleanup,
    activeSection: sectionId,
    hasSelection: Boolean(profile && subject),
    selection: profile && subject ? Object.freeze({
      identity: buildIdentityModel(subject),
      portrait: buildPortraitFrameModel(subject.portrait, { kind: "master-subject", label: `Retrato de ${subject.alias || subject.realName}`, lazy: false }),
      portraitEditor: buildPortraitEditorContext(subject.portrait, { kind: "subject", label: `Retrato de ${subject.alias || subject.realName}` }),
      relationLabel: view.band.label,
      relationBand: view.band.id,
      relationCode: view.band.code,
      relationAccent: view.band.accent,
      polarity: view.polarity,
      score: view.score,
      scoreLimit: view.scoreLimit,
      hearts: buildHeartTrackModel(view.relationship),
      quickPresets: quickPresets(view.scoreLimit),
      special: Object.freeze({
        active: Boolean(view.special.presentation?.active),
        state: view.special.state,
        label: String(view.special.presentation?.compactLabel || view.special.presentation?.label || "Nenhum"),
        sigilAsset: String(view.special.presentation?.sigilAsset || ""),
        bondActive: Boolean(view.special.bondActive),
        communionActive: Boolean(view.special.communionActive),
        dualSyncActive: Boolean(view.special.dualSyncActive)
      }),
      portraitSource: String(subject.portrait?.src || ""),
      portraitZoom: Number(subject.portrait?.zoom) || 100,
      portraitX: Number(subject.portrait?.x) || 50,
      portraitY: Number(subject.portrait?.y) || 50
    }) : null,
    focal: profile ? buildFocalProfileContext(profile) : null,
    focalEditor: profile ? buildPortraitEditorContext(profile.focal?.portrait, { kind: "focal", label: `Retrato focal de ${profile.focal?.name || profile.name || "perfil"}` }) : null,
    focalName: profile ? String(profile.focal?.name || profile.name || "") : "",
    focalDescription: profile ? String(profile.focal?.description || "") : "",
    history,
    undoRedo,
    savePreferences: Object.freeze({
      mode: saveMode,
      idleDelay,
      modeOptions: saveModeOptions(saveMode),
      idleMode: saveMode === MASTER_SAVE_MODE.IDLE
    }),
    world: Object.freeze({
      revision: Number(state.revision) || 0,
      schemaVersion: DATA_SCHEMA_VERSION,
      moduleVersion: MODULE_VERSION,
      groupCount: groups.length,
      subjectCount: subjects.length,
      profileRosterCount: profileRoster.size,
      profileCount: profiles.length,
      historyCount: Array.isArray(state.history) ? state.history.length : 0,
      backup
    })
  });
}

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
    this._permissionUnsubscribe = subscribePermissionChanges(() => this._onPermissionChanged());
    this._syncUnsubscribe = subscribeWorldStateChanges((event) => this._onWorldStateSync(event));
    this._saveController = new MasterSaveController({
      mode: getMasterSaveMode(),
      idleDelay: getMasterAutoSaveDelay(),
      onStatus: (snapshot) => this._updateSaveStatus(appElement(this), snapshot),
      onCommitted: async (_results, keys = []) => {
        this._refreshUndoRedoControls(appElement(this));
        if (keys.includes("relationship") && this.rendered) await this.render({ force: true });
      }
    });
  }

  async _prepareContext(options) {
    const parent = await super._prepareContext?.(options) ?? {};
    const context = buildMasterPanelContext({ profileId: this.profileId, subjectId: this.subjectId, activeSection: this.activeSection, newProfileGroupId: this.newProfileGroupId });
    this.profileId = context.profileId;
    this.subjectId = context.subjectId;
    this.activeSection = context.activeSection;
    this.newProfileGroupId = context.newProfileGroupId;
    this._saveController.configure({ mode: context.savePreferences.mode, idleDelay: context.savePreferences.idleDelay });
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
    if (String(event.state?.metadata?.updatedBy || "") === String(globalThis.game?.user?.id || "")) return;
    if (this._saveController.hasPending) {
      notify("warn", "Outro usuário atualizou a Matriz enquanto existem alterações locais pendentes. Salve ou descarte antes de continuar.");
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
    this.activeSection = workspace;
    root.dataset.masterActiveSection = workspace;
    for (const button of root.querySelectorAll("[data-master-section-choice]")) {
      const active = button.dataset.masterSectionChoice === workspace;
      button.dataset.active = String(active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    }
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
    if (!scoreInput || !bondInput || !communionInput || !this.profileId || !this.subjectId) return;
    const profileId = this.profileId;
    const subjectId = this.subjectId;
    const patch = {
      score: Number(scoreInput.value),
      bond: Boolean(bondInput.checked),
      communion: Boolean(communionInput.checked)
    };
    const reason = this._reason(root);
    this._saveController.queue("relationship", () => updateRelationship(profileId, subjectId, patch, { reason }));
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
    const scoreInput = root.querySelector("[data-master-score-input]");
    const scoreRange = root.querySelector("[data-master-score-range]");
    const bondInput = root.querySelector("[data-master-bond]");
    const communionInput = root.querySelector("[data-master-communion]");

    const updatePreview = (value, { animate = true } = {}) => {
      const expanded = Boolean(bondInput?.checked || communionInput?.checked);
      const limit = expanded ? 12 : 10;
      const numeric = Math.min(limit, Math.max(-10, Math.round((Number(value) || 0) * 2) / 2));
      const scoreText = Number.isInteger(numeric) ? String(numeric) : String(numeric).replace(".", ",");
      const band = getSemanticBand(numeric, { bond: expanded });
      const scorePreview = root.querySelector("[data-master-score-preview]");
      if (scorePreview) { scorePreview.textContent = scoreText; scorePreview.closest?.("[data-master-relation-console]")?.setAttribute?.("data-relation-band", band.id); }
      const relationPreview = root.querySelector("[data-master-relation-preview]");
      if (relationPreview) relationPreview.textContent = band.label;
      const limitPreview = root.querySelector("[data-master-score-limit-preview]");
      if (limitPreview) limitPreview.textContent = String(limit);
      const track = root.querySelector(".gms-master-reputation-console .gms-reputation-heart-track");
      if (track) {
        for (const id of ["hostile","caution","neutral","contact","trusted","ally","extreme"]) track.classList.remove(`is-band-${id}`);
        track.classList.add(`is-band-${band.id}`);
        track.dataset.heartBand = band.id;
        const magnitude = Math.abs(numeric);
        const full = Math.floor(magnitude);
        const half = magnitude - full >= .5;
        for (const heart of track.querySelectorAll("[data-heart-ordinal]")) {
          const index = Number(heart.dataset.heartOrdinal) - 1;
          heart.dataset.heartState = index < full ? "full" : (index === full && half ? "half" : "empty");
        }
      }
      if (animate) this._motionController?.relationship?.(root.querySelector?.("[data-master-relation-console]"));
      return numeric;
    };

    const setScoreDraft = (value) => {
      if (!scoreInput) return;
      const numeric = updatePreview(value);
      const expanded = Boolean(bondInput?.checked || communionInput?.checked);
      const limit = expanded ? 12 : 10;
      scoreInput.max = String(limit);
      scoreInput.value = String(numeric);
      if (scoreRange) { scoreRange.max = String(limit); scoreRange.value = String(numeric); }
      this._queueRelationshipDraft(root);
    };

    for (const button of root.querySelectorAll("[data-master-score-delta]")) {
      listen(this._listeners, button, "click", () => setScoreDraft(Number(scoreInput?.value || 0) + Number(button.dataset.masterScoreDelta)));
    }
    for (const button of root.querySelectorAll("[data-master-score-preset]")) {
      listen(this._listeners, button, "click", () => setScoreDraft(Number(button.dataset.masterScorePreset)));
    }
    listen(this._listeners, scoreInput, "input", () => { if (scoreRange) scoreRange.value = scoreInput.value; updatePreview(scoreInput.value); this._queueRelationshipDraft(root); });
    listen(this._listeners, scoreRange, "input", () => { if (scoreInput) scoreInput.value = scoreRange.value; updatePreview(scoreRange.value); this._queueRelationshipDraft(root); });
    listen(this._listeners, bondInput, "change", () => {
      this._motionController?.protocol?.(root.querySelector?.(".gms-master-reputation-console__protocols"));
      if (scoreInput) scoreInput.max = String(bondInput.checked || communionInput?.checked ? 12 : 10);
      if (scoreRange) scoreRange.max = String(bondInput.checked || communionInput?.checked ? 12 : 10);
      updatePreview(scoreInput?.value, { animate: false });
      this._queueRelationshipDraft(root);
    });
    listen(this._listeners, communionInput, "change", () => {
      this._motionController?.protocol?.(root.querySelector?.(".gms-master-reputation-console__protocols"));
      if (scoreInput) scoreInput.max = String(communionInput.checked || bondInput?.checked ? 12 : 10);
      if (scoreRange) scoreRange.max = String(communionInput.checked || bondInput?.checked ? 12 : 10);
      updatePreview(scoreInput?.value, { animate: false });
      this._queueRelationshipDraft(root);
    });

    updatePreview(scoreInput?.value, { animate: false });

    listen(this._listeners, root.querySelector("[data-master-apply-score]"), "click", async () => {
      this._queueRelationshipDraft(root);
      await this._flushPending("Reputação sincronizada.");
    });
    listen(this._listeners, root.querySelector("[data-master-apply-specials]"), "click", async () => {
      this._queueRelationshipDraft(root);
      await this._flushPending("Protocolos especiais sincronizados.");
    });
  }

  _wirePortrait(root, context) {
    if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.PORTRAITS)) return;
    this._portraitController?.destroy?.();
    this._portraitController = null;
    const editorRoot = root.querySelector("[data-master-portrait-editor] [data-portrait-editor]");
    if (!editorRoot || !context?.selection?.portraitEditor) return;
    let draftPortrait = context.selection.portraitEditor.portrait;
    const profileId = this.profileId;
    const subjectId = this.subjectId;
    this._portraitController = wirePortraitEditor(editorRoot, {
      initialPortrait: draftPortrait,
      onChange: (portrait) => {
        draftPortrait = portrait;
        const reason = this._reason(root);
        const snapshot = { ...portrait };
        this._saveController.queue("portrait", () => setSubjectPortrait(subjectId, snapshot, { profileId, reason }));
      },
      onError: (error) => notify("warn", error?.message || "Fonte de retrato inválida.")
    });
    listen(this._listeners, root.querySelector("[data-master-save-portrait]"), "click", async () => {
      const reason = this._reason(root);
      const snapshot = { ...draftPortrait };
      this._saveController.queue("portrait", () => setSubjectPortrait(subjectId, snapshot, { profileId, reason }));
      await this._flushPending("Retrato sincronizado.");
    });
  }

  _wireFocal(root, context) {
    if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.FOCAL)) return;
    this._focalPortraitController?.destroy?.();
    this._focalPortraitController = null;
    const editorRoot = root.querySelector("[data-master-focal-editor] [data-portrait-editor]");
    if (!editorRoot || !context?.focalEditor || !this.profileId) return;
    let draftPortrait = context.focalEditor.portrait;
    this._focalPortraitController = wirePortraitEditor(editorRoot, {
      initialPortrait: draftPortrait,
      onChange: (portrait) => { draftPortrait = portrait; },
      onError: (error) => notify("warn", error?.message || "Fonte de retrato focal inválida.")
    });
    listen(this._listeners, root.querySelector("[data-master-save-focal]"), "click", async () => {
      const name = String(root.querySelector("[data-master-focal-name]")?.value || "").trim();
      const description = String(root.querySelector("[data-master-focal-description]")?.value || "");
      await this._runMutation(
        () => updateFocalProfile(this.profileId, { name, description, portrait: { ...draftPortrait } }),
        "Perfil focal atualizado."
      );
    });
  }

  _wireRegistry(root) {
    if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.SUBJECTS)) return;

    const profileListSearch = root.querySelector("[data-master-profile-list-search]");
    listen(this._listeners, profileListSearch, "input", () => {
      const query = normalizeUiSearch(profileListSearch?.value);
      for (const group of root.querySelectorAll(".gms-master-profile-group")) {
        const groupLabel = normalizeUiSearch(group.querySelector(".gms-master-profile-group__summary-copy")?.textContent || "");
        let visible = 0;
        for (const entry of group.querySelectorAll("[data-master-profile-choice]")) {
          const match = !query || groupLabel.includes(query) || normalizeUiSearch(entry.textContent).includes(query);
          entry.hidden = !match;
          if (match) visible += 1;
        }
        group.hidden = Boolean(query) && visible === 0;
        if (query && visible > 0) group.open = true;
      }
    });

    const characterListSearch = root.querySelector("[data-master-character-list-search]");
    listen(this._listeners, characterListSearch, "input", () => {
      const query = normalizeUiSearch(characterListSearch?.value);
      for (const row of root.querySelectorAll(".gms-master-subject-registry__list > article")) {
        row.hidden = Boolean(query) && !normalizeUiSearch(row.textContent).includes(query);
      }
    });

    const groupName = root.querySelector("[data-master-new-group-name]");
    const createGroupButton = root.querySelector("[data-master-create-group]");
    const createGroupAction = async () => {
      const name = String(groupName?.value || "").trim();
      if (!name) { notify("warn", "Informe o nome do novo grupo de perfis."); return; }
      const result = await this._runMutation(() => createNewGroup({ name }), `Grupo de perfis “${name}” criado.`);
      const created = Object.values(result?.groups ?? {}).find((entry) => String(entry.name || "").localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0);
      if (created?.id) { this.newProfileGroupId = created.id; if (this.rendered) await this.render({ force: true }); }
    };
    listen(this._listeners, createGroupButton, "click", createGroupAction);
    listen(this._listeners, groupName, "keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); createGroupAction(); } });

    const profileNameInput = root.querySelector("[data-master-new-profile-name]");
    const focalNameInput = root.querySelector("[data-master-new-profile-focal-name]");
    const createProfileButton = root.querySelector("[data-master-create-profile]");
    const createProfileAction = async () => {
      const name = String(profileNameInput?.value || "").trim();
      const focalName = String(focalNameInput?.value || "").trim();
      if (!name) { notify("warn", "Informe o nome do novo perfil de reputação."); return; }
      const groupId = this.newProfileGroupId === "__ungrouped__" ? null : this.newProfileGroupId;
      const result = await this._runMutation(() => createNewProfile({ name, focalName: focalName || name, groupId }), `Perfil “${name}” criado.`);
      const created = Object.values(result?.profiles ?? {}).find((entry) => String(entry.name || "").localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0);
      if (created?.id) { this.profileId = created.id; if (this.rendered) await this.render({ force: true }); }
    };
    listen(this._listeners, createProfileButton, "click", createProfileAction);

    const aliasInput = root.querySelector("[data-master-new-subject-alias]");
    const realNameInput = root.querySelector("[data-master-new-subject-real-name]");
    const createSubjectButton = root.querySelector("[data-master-create-subject]");
    const createSubjectAction = async () => {
      const alias = String(aliasInput?.value || "").trim();
      const realName = String(realNameInput?.value || "").trim();
      if (!alias && !realName) { notify("warn", "Informe ao menos o apelido ou o nome real do personagem."); return; }
      await this._runMutation(() => createNewSubject({ alias, realName }), `Personagem “${alias || realName}” criado.`);
    };
    listen(this._listeners, createSubjectButton, "click", createSubjectAction);

    const profileEditorGroupButtons = [...root.querySelectorAll("[data-master-profile-editor-group-choice]")];
    for (const button of profileEditorGroupButtons) {
      listen(this._listeners, button, "click", () => {
        for (const peer of profileEditorGroupButtons) {
          const active = peer === button;
          peer.dataset.active = String(active);
          peer.setAttribute("aria-pressed", String(active));
        }
      });
    }

    listen(this._listeners, root.querySelector("[data-master-save-profile-editor]"), "click", async () => {
      if (!this.profileId) return;
      const name = String(root.querySelector("[data-master-profile-editor-name]")?.value || "").trim();
      const active = Boolean(root.querySelector("[data-master-profile-editor-active]")?.checked);
      const archived = Boolean(root.querySelector("[data-master-profile-editor-archived]")?.checked);
      const selectedGroup = profileEditorGroupButtons.find((button) => button.getAttribute("aria-pressed") === "true");
      const groupId = String(selectedGroup?.dataset.masterProfileEditorGroupChoice || "__ungrouped__");
      if (!name) { notify("warn", "Informe o nome da matriz."); return; }
      await this._runMutation(
        () => updateProfile(this.profileId, { name, groupId, active, archived }),
        "Perfil atualizado."
      );
    });

    for (const button of root.querySelectorAll("[data-master-profile-move]")) {
      listen(this._listeners, button, "click", async () => {
        if (!this.profileId) return;
        await this._runMutation(
          () => moveProfileOneStep(this.profileId, button.dataset.masterProfileMove),
          "Ordem do perfil atualizada."
        );
      });
    }

    for (const button of root.querySelectorAll("[data-master-new-profile-group-choice]")) {
      listen(this._listeners, button, "click", () => {
        this.newProfileGroupId = String(button.dataset.masterNewProfileGroupChoice || "__ungrouped__");
        for (const peer of root.querySelectorAll("[data-master-new-profile-group-choice]")) {
          const active = String(peer.dataset.masterNewProfileGroupChoice || "") === this.newProfileGroupId;
          peer.dataset.active = String(active);
          peer.setAttribute("aria-pressed", String(active));
        }
      });
    }

    for (const button of root.querySelectorAll("[data-master-profile-roster-toggle]")) {
      listen(this._listeners, button, "click", async (event) => {
        event.stopPropagation?.();
        if (!this.profileId) return;
        const subjectId = String(button.dataset.masterProfileRosterToggle || "");
        const included = String(button.dataset.inProfile) !== "true";
        await this._runMutation(
          () => setProfileSubjectIncluded(this.profileId, subjectId, included),
          included ? "Personagem adicionado ao perfil." : "Personagem removido do perfil."
        );
      });
    }

    for (const button of root.querySelectorAll("[data-master-group-save]")) {
      listen(this._listeners, button, "click", async () => {
        const row = button.closest("[data-master-group]");
        const id = String(row?.dataset.masterGroup || "");
        const input = row?.querySelector?.("[data-master-group-name]");
        await this._runMutation(() => renameGroup(id, input?.value), "Nome do grupo de perfis atualizado.");
      });
    }
    for (const button of root.querySelectorAll("[data-master-group-move]")) {
      listen(this._listeners, button, "click", async () => {
        const row = button.closest("[data-master-group]");
        await this._runMutation(() => moveGroup(row?.dataset.masterGroup, button.dataset.masterGroupMove), "Ordem dos grupos de perfis atualizada.");
      });
    }
    for (const button of root.querySelectorAll("[data-master-profile-choice]")) {
      listen(this._listeners, button, "click", async () => {
        const id = String(button.dataset.masterProfileChoice || "");
        if (!id || id === this.profileId) return;
        this.profileId = id;
        await this.render({ force: true });
      });
    }

    listen(this._listeners, root.querySelector("[data-master-save-subject]"), "click", async () => {
      if (!this.subjectId) return;
      const alias = String(root.querySelector("[data-master-subject-alias]")?.value || "").trim();
      const realName = String(root.querySelector("[data-master-subject-real-name]")?.value || "").trim();
      const description = String(root.querySelector("[data-master-subject-description]")?.value || "");
      const tags = String(root.querySelector("[data-master-subject-tags]")?.value || "")
        .split(/[,;\n]+/).map((value) => value.trim()).filter(Boolean);
      const active = Boolean(root.querySelector("[data-master-subject-active]")?.checked);
      const archived = Boolean(root.querySelector("[data-master-subject-archived]")?.checked);
      if (!alias && !realName) { notify("warn", "Informe ao menos o apelido ou o nome real do personagem."); return; }
      await this._runMutation(
        () => updateSubject(this.subjectId, { alias, realName, description, active, archived, metadata: { tags } }, { reason: "Cadastro editado no Command Deck" }),
        "Cadastro do personagem atualizado."
      );
    });

    for (const button of root.querySelectorAll("[data-master-subject-move]")) {
      listen(this._listeners, button, "click", async () => {
        if (!this.subjectId) return;
        await this._runMutation(
          () => moveSubjectOneStep(this.subjectId, button.dataset.masterSubjectMove),
          "Ordem dos personagens atualizada."
        );
      });
    }
  }

  _wireCleanup(root, context) {
    const cleanupRoot = root.querySelector("[data-master-cleanup-root]");
    if (!cleanupRoot || !context?.permissions?.isFullGM) return;

    const unlock = cleanupRoot.querySelector("[data-master-cleanup-unlock]");
    const refreshDeleteState = () => {
      const enabled = Boolean(unlock?.checked);
      cleanupRoot.dataset.cleanupUnlocked = String(enabled);
      for (const button of cleanupRoot.querySelectorAll("[data-master-cleanup-delete]")) button.disabled = !enabled;
    };
    listen(this._listeners, unlock, "change", refreshDeleteState);
    refreshDeleteState();

    const search = cleanupRoot.querySelector("[data-master-cleanup-search]");
    listen(this._listeners, search, "input", () => {
      const query = normalizeUiSearch(search?.value);
      for (const row of cleanupRoot.querySelectorAll("[data-master-cleanup-row]")) {
        const haystack = normalizeUiSearch(row.dataset.cleanupSearchText || row.textContent || "");
        row.hidden = Boolean(query) && !haystack.includes(query);
      }
      for (const section of cleanupRoot.querySelectorAll("[data-master-cleanup-section]")) {
        const visible = [...section.querySelectorAll("[data-master-cleanup-row]")].some((row) => !row.hidden);
        section.dataset.hasVisibleRows = String(visible);
      }
    });

    for (const button of cleanupRoot.querySelectorAll("[data-master-cleanup-delete]")) {
      listen(this._listeners, button, "click", async () => {
        if (!unlock?.checked) return;
        const kind = String(button.dataset.masterCleanupDelete || "");
        const id = String(button.dataset.cleanupId || "");
        const name = String(button.dataset.cleanupName || "registro");
        const impactA = Number(button.dataset.cleanupImpactA || 0);
        const impactB = Number(button.dataset.cleanupImpactB || 0);
        let title = "Confirmar exclusão permanente";
        let message = "";
        let action = null;

        if (kind === "subject") {
          message = `Apagar permanentemente o personagem “${name}”? Ele será removido de ${impactA} relação(ões) e ${impactB} roster(s) de perfil. O backup automático preservará o estado anterior, mas esta ação não entra no Undo/Redo.`;
          action = () => deleteSubjectPermanently(id, { reason: "Exclusão permanente pelo Gerenciador de Limpeza" });
        } else if (kind === "profile") {
          message = `Apagar permanentemente o perfil “${name}”? Serão removidas ${impactA} relação(ões) armazenadas dentro deste perfil. Os personagens não serão apagados. O backup automático preservará o estado anterior.`;
          action = () => deleteProfilePermanently(id, { reason: "Exclusão permanente pelo Gerenciador de Limpeza" });
        } else if (kind === "group") {
          message = `Apagar o grupo “${name}”? Os ${impactA} perfil(is) vinculados serão preservados e movidos para “Sem Grupo”. O grupo em si será removido permanentemente.`;
          action = () => deleteGroupPermanently(id, { reason: "Exclusão permanente pelo Gerenciador de Limpeza" });
        }
        if (!action) return;
        const confirmed = await confirmMasterAction({ title, message, confirmLabel: "Apagar permanentemente" });
        if (!confirmed) return;

        await this._runMutation(action, `${name} removido com sucesso.`);
      });
    }
  }

  _wireBulk(root) {
    if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.BULK)) return;
    const selectAll = root.querySelector("[data-master-bulk-select-all]");
    listen(this._listeners, selectAll, "change", () => {
      for (const input of root.querySelectorAll("[data-master-bulk-subject]")) input.checked = Boolean(selectAll.checked);
    });

    const applyRelation = root.querySelector("[data-master-bulk-apply-relationship]");
    listen(this._listeners, applyRelation, "click", () => {
      const ids = this._selectedBulkIds(root);
      const scoreMode = String(root.querySelector("[data-master-bulk-score-mode]")?.value || "keep");
      const scoreValue = Number(root.querySelector("[data-master-bulk-score-value]")?.value || 0);
      const bond = String(root.querySelector("[data-master-bulk-bond]")?.value || "keep");
      const communion = String(root.querySelector("[data-master-bulk-communion]")?.value || "keep");
      return this._runMutation(
        () => applyBulkRelationshipChanges(this.profileId, ids, { scoreMode, scoreValue, bond, communion }, { reason: this._reason(root, "bulk") }),
        `${ids.length} registro(s) processado(s) em massa.`
      );
    });

    const actions = {
      archive: () => bulkArchiveSubjects(this._selectedBulkIds(root), true, { reason: this._reason(root, "bulk") }),
      restore: () => bulkArchiveSubjects(this._selectedBulkIds(root), false, { reason: this._reason(root, "bulk") }),
      activate: () => bulkSetSubjectsActive(this._selectedBulkIds(root), true, { reason: this._reason(root, "bulk") }),
      deactivate: () => bulkSetSubjectsActive(this._selectedBulkIds(root), false, { reason: this._reason(root, "bulk") }),
      top: () => moveSubjects(this._selectedBulkIds(root), "top", { reason: this._reason(root, "bulk") }),
      bottom: () => moveSubjects(this._selectedBulkIds(root), "bottom", { reason: this._reason(root, "bulk") })
    };
    const destructiveMessages = {
      archive: "Arquivar os personagens selecionados? Os dados serão preservados, mas eles sairão das consultas normais.",
      deactivate: "Desativar os personagens selecionados? Eles permanecerão cadastrados, porém ficarão fora das consultas ativas."
    };
    for (const [action, callback] of Object.entries(actions)) {
      listen(this._listeners, root.querySelector(`[data-master-bulk-action="${action}"]`), "click", async () => {
        const warning = destructiveMessages[action];
        if (warning) {
          const confirmed = await confirmMasterAction({ title: "Confirmar operação em massa", message: warning, confirmLabel: "Continuar" });
          if (!confirmed) return;
        }
        await this._runMutation(callback, "Operação em massa concluída.");
      });
    }
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
      onSelect: async (value) => { this.profileId = String(value || ""); this._pendingMotion = "profile"; await this.render({ force: true }); }
    });
    this._subjectSelectorController = wireSmartSelector(subjectSelector, {
      onSelect: async (value) => { this.subjectId = String(value || ""); this._pendingMotion = "subject"; await this.render({ force: true }); }
    });
    for (const button of root.querySelectorAll("[data-master-subject-choice]")) {
      listen(this._listeners, button, "click", async () => {
        this.subjectId = String(button.dataset.masterSubjectChoice || "");
        this._pendingMotion = "subject";
        await this.render({ force: true });
      });
    }
    for (const button of root.querySelectorAll("[data-master-section-choice]")) listen(this._listeners, button, "click", () => this._setSection(root, button.dataset.masterSectionChoice));

    this._wireSaveControls(root, context);
    this._wireRegistry(root);
    this._wireQuickEdit(root);
    this._wirePortrait(root, context);
    this._wireFocal(root, context);
    this._wireBulk(root);
    this._wireCleanup(root, context);
    this._wirePermissionSettings(root);
    this._wireBackupControls(root);
    this._applyPermissionState(root, context);
    this._accessibilityController = wireApplicationAccessibility(root, { onEscape: () => this.close(), tablistRoot: root.querySelector("[role=tablist]") ?? root });
    this._setSection(root, this.activeSection, { animate: false });
  }

  async _onClose(options) {
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
      if (options.profileId) masterPanelApp.profileId = String(options.profileId);
      if (options.subjectId) masterPanelApp.subjectId = String(options.subjectId);
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
