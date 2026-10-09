import { DATA_SCHEMA_VERSION, MASTER_SAVE_MODE, MODULE_VERSION } from "../../../constants.js";
import { loadWorldStateBackup } from "../../../persistence/world-store.js";
import { getMasterAutoSaveDelay, getMasterSaveMode } from "../../../persistence/master-preferences.js";
import { permissionContext } from "../../../persistence/permissions.js";
import { buildPlayerBindingsContext, getPersonalReputationStatus } from "../../../persistence/personal-reputation.js";

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

/** Reads live permissions/preferences/backup for each snapshot; never writes settings. */
export function buildMasterSystemContext(state, readModel, entries, { sectionId, settingsTab = "general" }) {
  const { profiles, subjects, groups } = readModel;
  const { profileRoster } = entries;
  const saveMode = getMasterSaveMode();
  const idleDelay = getMasterAutoSaveDelay();
  const permissions = permissionContext();
  const backup = backupStatus();
  return Object.freeze({
    authorized: permissions.canOpenMaster,
    permissions,
    permissionRoles: Object.freeze([
      Object.freeze({ id: "assistant", label: "Assistant GM", policy: permissions.config.assistant }),
      Object.freeze({ id: "trusted", label: "Trusted Player", policy: permissions.config.trusted })
    ]),
    personalReputation: getPersonalReputationStatus(state),
    playerBindings: sectionId === "settings" ? buildPlayerBindingsContext(state) : [],
    settingsTabs: [{ id: "general", label: "Geral", active: settingsTab !== "players" }, { id: "players", label: "Jogadores e perfis", active: settingsTab === "players" }],
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
