export const MODULE_ID = "gms-reputation";
export const MODULE_TITLE = "GMS // Matriz de Reputação";
export const MODULE_VERSION = "1.2.0-dev.60.1";
export const DATA_SCHEMA_VERSION = 5;

export const SETTINGS = Object.freeze({
  WORLD_STATE: "worldState",
  WORLD_STATE_BACKUP: "worldStateBackup",
  MASTER_SAVE_MODE: "masterSaveMode",
  MASTER_AUTOSAVE_DELAY: "masterAutoSaveDelay",
  PERMISSIONS: "permissions"
});

export const MASTER_SAVE_MODE = Object.freeze({
  MANUAL: "manual",
  AUTOMATIC: "automatic",
  IDLE: "idle"
});



export const SCORE = Object.freeze({
  MIN: -10,
  BASE_MAX: 10,
  EXPANDED_MAX: 12,
  STEP: 0.5
});

export const SPECIAL_STATE = Object.freeze({
  STANDARD: "standard",
  COMMUNION: "communion",
  BOND: "bond",
  DUAL_SYNC: "dual-sync"
});

export const LEGACY = Object.freeze({
  UI_VERSION: "3.21.43-PLAYER21AR-SEM-LINHA-LATERAL-COLORIDA",
  JOURNAL_UUID: "JournalEntry.i6BOrDTU39ytZHV9",
  SHARED_PORTRAIT_FLAG_SCOPE: "world",
  SHARED_PORTRAIT_FLAG_KEY: "gmsReputationSharedPortraits",
  SHARED_PORTRAIT_SCHEMA: 1,
  CARD_CLASS: "farm-reputation-card",
  PAGE_CLASS: "gms-reputation-page"
});
