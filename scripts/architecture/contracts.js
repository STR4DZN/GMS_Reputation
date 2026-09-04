import { DATA_SCHEMA_VERSION, MODULE_ID, SETTINGS } from "../constants.js";

/**
 * Architecture 60 compatibility boundary.
 *
 * These values are intentionally boring: they are the external contracts that
 * must not drift while the internal module is reorganized. Any intentional
 * change here requires a migration plan and a dedicated compatibility test.
 */
export const ARCHITECTURE_GENERATION = "60";
export const FROZEN_DATA_SCHEMA_VERSION = 5;

export const FROZEN_SETTINGS = Object.freeze({
  WORLD_STATE: "worldState",
  WORLD_STATE_BACKUP: "worldStateBackup",
  MASTER_SAVE_MODE: "masterSaveMode",
  MASTER_AUTOSAVE_DELAY: "masterAutoSaveDelay",
  PERMISSIONS: "permissions"
});

export const FROZEN_HOOKS = Object.freeze({
  WORLD_STATE_CHANGED: "gmsReputationWorldStateChanged",
  PERMISSIONS_CHANGED: "gmsReputationPermissionsChanged"
});

export const FROZEN_SOCKET_CHANNEL = `module.${MODULE_ID}`;

export const LEGACY_PUBLIC_API_NAMESPACES = Object.freeze([
  "schema",
  "score",
  "reputationEngine",
  "semanticBands",
  "bond",
  "communion",
  "dualSync",
  "specialPresentation",
  "heartTrack",
  "portrait",
  "portraitFrame",
  "portraitEditor",
  "identity",
  "quickRead",
  "playerCard",
  "focalProfile",
  "subjectDetail",
  "playerDashboard",
  "masterPanel",
  "portraits",
  "profiles",
  "filePicker",
  "store",
  "migration",
  "subjects",
  "groups",
  "reputation",
  "history",
  "bulkOperations",
  "undoRedo",
  "masterPreferences",
  "masterSaveController",
  "permissions",
  "authorityBroker",
  "worldSync",
  "systemAudit",
  "visualContract",
  "sceneControls"
]);

export function assertArchitectureContracts() {
  if (MODULE_ID !== "gms-reputation") throw new Error(`MODULE_ID drifted: ${MODULE_ID}`);
  if (DATA_SCHEMA_VERSION !== FROZEN_DATA_SCHEMA_VERSION) {
    throw new Error(`Schema drifted during Architecture 60 compatibility phase: ${DATA_SCHEMA_VERSION}`);
  }
  for (const [key, expected] of Object.entries(FROZEN_SETTINGS)) {
    if (SETTINGS[key] !== expected) throw new Error(`Setting contract drifted: ${key}=${SETTINGS[key]}`);
  }
  return true;
}
