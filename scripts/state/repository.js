import { MODULE_ID, SETTINGS } from "../constants.js";
import { normalizeWorldState, createEmptyWorldState } from "./schema.js";
import { clonePlain } from "./world-state.js";

let inMemoryState = null;

function hasFoundrySettings() {
  return Boolean(globalThis.game?.settings?.get && globalThis.game?.settings?.set);
}

export class WorldStateRepository {
  static getRaw() {
    if (hasFoundrySettings()) {
      return globalThis.game.settings.get(MODULE_ID, SETTINGS.WORLD_STATE) ?? {};
    }
    return inMemoryState ?? {};
  }

  static load() {
    const raw = this.getRaw();
    if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) {
      return createEmptyWorldState();
    }
    return normalizeWorldState(raw);
  }

  static async commit(nextState) {
    const normalized = normalizeWorldState(clonePlain(nextState));
    if (hasFoundrySettings()) {
      await globalThis.game.settings.set(MODULE_ID, SETTINGS.WORLD_STATE, normalized);
    } else {
      inMemoryState = normalized;
    }
    return normalized;
  }

  static async save(nextState, { reason = "" } = {}) {
    return this.commit(nextState);
  }

  static isEmpty(state) {
    if (!state || typeof state !== "object") return true;
    const hasProfiles = state.profiles && Object.keys(state.profiles).length > 0;
    const hasSubjects = state.subjects && Object.keys(state.subjects).length > 0;
    return !hasProfiles && !hasSubjects;
  }

  static resetInMemory(state = null) {
    inMemoryState = state ? normalizeWorldState(clonePlain(state)) : null;
  }
}
