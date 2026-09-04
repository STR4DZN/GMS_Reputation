import { MASTER_SAVE_MODE, MODULE_ID, SETTINGS } from "../constants.js";
import { DEFAULT_PERMISSION_CONFIG, emitPermissionChange } from "./permissions.js";
import { ingestWorldStateSetting } from "../events/world-sync.js";

/** Registra apenas preferências e estado realmente utilizados pelo runtime 59.10. */
export function registerPersistenceSettings() {
  game.settings.register(MODULE_ID, SETTINGS.WORLD_STATE, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: (value, options) => ingestWorldStateSetting(value, options)
  });

  game.settings.register(MODULE_ID, SETTINGS.WORLD_STATE_BACKUP, {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });



  game.settings.register(MODULE_ID, SETTINGS.MASTER_SAVE_MODE, {
    scope: "user",
    config: false,
    type: String,
    default: MASTER_SAVE_MODE.MANUAL
  });

  game.settings.register(MODULE_ID, SETTINGS.PERMISSIONS, {
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_PERMISSION_CONFIG,
    onChange: (value) => emitPermissionChange(value)
  });

  game.settings.register(MODULE_ID, SETTINGS.MASTER_AUTOSAVE_DELAY, {
    scope: "user",
    config: false,
    type: Number,
    default: 2
  });
}
