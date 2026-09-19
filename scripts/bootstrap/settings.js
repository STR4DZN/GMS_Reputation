import { MASTER_SAVE_MODE, MODULE_ID, SETTINGS } from "../constants.js";
import { DEFAULT_PERMISSION_CONFIG } from "../services/permission-service.js";
import { ingestWorldStateSetting } from "../state/sync.js";

/**
 * Registra configurações mundiais e de usuário no Foundry VTT.
 */
export function registerSettings() {
  if (!globalThis.game?.settings?.register) return;

  // WorldState principal
  game.settings.register(MODULE_ID, SETTINGS.WORLD_STATE, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: (value, options) => ingestWorldStateSetting(value, options)
  });

  // Backup automático do WorldState
  game.settings.register(MODULE_ID, SETTINGS.WORLD_STATE_BACKUP, {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // Modo de salvamento do Mestre (Manual, Automático, Idle)
  game.settings.register(MODULE_ID, SETTINGS.MASTER_SAVE_MODE, {
    scope: "user",
    config: false,
    type: String,
    default: MASTER_SAVE_MODE.MANUAL
  });

  // Matriz de permissões
  game.settings.register(MODULE_ID, SETTINGS.PERMISSIONS, {
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_PERMISSION_CONFIG,
    onChange: () => {
      try {
        globalThis.Hooks?.callAll?.("gmsReputationPermissionsChanged");
        globalThis.ui?.controls?.render?.({ force: true, reset: true });
      } catch (_) {}
    }
  });

  // Delay de autosave
  game.settings.register(MODULE_ID, SETTINGS.MASTER_AUTOSAVE_DELAY, {
    scope: "user",
    config: false,
    type: Number,
    default: 2
  });
}
