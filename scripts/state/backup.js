import { MODULE_ID, SETTINGS } from "../constants.js";
import { normalizeWorldState } from "./schema.js";

function assertSettingsReady() {
  if (!globalThis.game?.settings) throw new Error("Foundry game.settings não está disponível.");
}

export function getRawWorldStateBackup() {
  assertSettingsReady();
  return globalThis.game.settings.get(MODULE_ID, SETTINGS.WORLD_STATE_BACKUP) ?? {};
}

export function loadWorldStateBackup() {
  const raw = getRawWorldStateBackup();
  if (!raw || typeof raw !== "object" || !Object.keys(raw).length) return null;
  return normalizeWorldState(raw);
}

export async function saveWorldStateBackup(state) {
  if (!globalThis.game?.settings?.set) return null;
  const normalized = normalizeWorldState(state);
  await globalThis.game.settings.set(MODULE_ID, SETTINGS.WORLD_STATE_BACKUP, normalized);
  return normalized;
}

export async function restoreWorldStateBackup() {
  const backup = loadWorldStateBackup();
  if (!backup) throw new Error("Nenhum backup válido encontrado nas configurações.");
  const { WorldStateRepository } = await import("./repository.js");
  return WorldStateRepository.commit(backup);
}

export const BackupService = Object.freeze({
  getRawWorldStateBackup,
  loadWorldStateBackup,
  saveWorldStateBackup,
  restoreWorldStateBackup,
  exportBackup: async () => {
    const { WorldStateRepository } = await import("./repository.js");
    const state = WorldStateRepository.load();
    return JSON.stringify(state, null, 2);
  },
  restoreBackup: async (data) => {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    const { WorldStateRepository } = await import("./repository.js");
    return WorldStateRepository.save(parsed, { reason: "Restaurar backup manual" });
  }
});
