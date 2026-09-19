import { MASTER_SAVE_MODE, MODULE_ID, SETTINGS } from "../constants.js";

const VALID_SAVE_MODES = new Set(Object.values(MASTER_SAVE_MODE));

export function normalizeMasterSaveMode(value) {
  const mode = String(value || "").trim();
  return VALID_SAVE_MODES.has(mode) ? mode : MASTER_SAVE_MODE.AUTOMATIC;
}

export function normalizeMasterAutoSaveDelay(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 2;
  return Math.max(0.75, Math.min(10, Math.round(numeric * 4) / 4));
}

export function getMasterSaveMode() {
  if (!globalThis.game?.settings?.get) return MASTER_SAVE_MODE.AUTOMATIC;
  try {
    return normalizeMasterSaveMode(globalThis.game.settings.get(MODULE_ID, SETTINGS.MASTER_SAVE_MODE));
  } catch {
    return MASTER_SAVE_MODE.AUTOMATIC;
  }
}

export async function setMasterSaveMode(mode) {
  const normalized = normalizeMasterSaveMode(mode);
  if (globalThis.game?.settings?.set) {
    try {
      await globalThis.game.settings.set(MODULE_ID, SETTINGS.MASTER_SAVE_MODE, normalized);
    } catch {}
  }
  return normalized;
}

export function getMasterAutoSaveDelay() {
  if (!globalThis.game?.settings?.get) return 2;
  try {
    return normalizeMasterAutoSaveDelay(globalThis.game.settings.get(MODULE_ID, SETTINGS.MASTER_AUTOSAVE_DELAY));
  } catch {
    return 2;
  }
}

export async function setMasterAutoSaveDelay(seconds) {
  const normalized = normalizeMasterAutoSaveDelay(seconds);
  if (globalThis.game?.settings?.set) {
    try {
      await globalThis.game.settings.set(MODULE_ID, SETTINGS.MASTER_AUTOSAVE_DELAY, normalized);
    } catch {}
  }
  return normalized;
}
