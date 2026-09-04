import { MASTER_SAVE_MODE, MODULE_ID, SETTINGS } from "../constants.js";

const VALID_SAVE_MODES = new Set(Object.values(MASTER_SAVE_MODE));

export function normalizeMasterSaveMode(value) {
  const mode = String(value || "").trim();
  return VALID_SAVE_MODES.has(mode) ? mode : MASTER_SAVE_MODE.MANUAL;
}

export function normalizeMasterAutoSaveDelay(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 2;
  return Math.max(0.75, Math.min(10, Math.round(numeric * 4) / 4));
}

export function getMasterSaveMode() {
  return normalizeMasterSaveMode(game.settings.get(MODULE_ID, SETTINGS.MASTER_SAVE_MODE));
}

export async function setMasterSaveMode(mode) {
  const normalized = normalizeMasterSaveMode(mode);
  await game.settings.set(MODULE_ID, SETTINGS.MASTER_SAVE_MODE, normalized);
  return normalized;
}

export function getMasterAutoSaveDelay() {
  return normalizeMasterAutoSaveDelay(game.settings.get(MODULE_ID, SETTINGS.MASTER_AUTOSAVE_DELAY));
}

export async function setMasterAutoSaveDelay(seconds) {
  const normalized = normalizeMasterAutoSaveDelay(seconds);
  await game.settings.set(MODULE_ID, SETTINGS.MASTER_AUTOSAVE_DELAY, normalized);
  return normalized;
}
