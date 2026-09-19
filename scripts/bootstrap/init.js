import { MODULE_TITLE, MODULE_VERSION, DATA_SCHEMA_VERSION } from "../constants.js";
import { assertArchitectureContracts } from "../architecture/contracts.js";
import { registerSettings } from "./settings.js";
import { registerSceneControls } from "./scene-controls.js";

export function onInit() {
  assertArchitectureContracts();
  registerSettings();
  registerSceneControls();

  // Registrar helpers globais Handlebars úteis caso o core não os possua
  if (globalThis.Handlebars) {
    if (!globalThis.Handlebars.helpers.eq) {
      globalThis.Handlebars.registerHelper("eq", (a, b) => a === b);
    }
    if (!globalThis.Handlebars.helpers.ne) {
      globalThis.Handlebars.registerHelper("ne", (a, b) => a !== b);
    }
  }

  console.info(`${MODULE_TITLE} | Inicializando ${MODULE_VERSION} | Schema v${DATA_SCHEMA_VERSION}`);
}
