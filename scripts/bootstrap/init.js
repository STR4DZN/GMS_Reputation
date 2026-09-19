import { MODULE_ID, MODULE_TITLE, MODULE_VERSION, DATA_SCHEMA_VERSION } from "../constants.js";
import { assertArchitectureContracts } from "../architecture/contracts.js";
import { registerSettings } from "./settings.js";
import { registerSceneControls } from "./scene-controls.js";
import { createPublicApi } from "../compatibility/public-api.js";

export async function preloadHandlebarsTemplates() {
  const load = globalThis.foundry?.applications?.handlebars?.loadTemplates
    ?? globalThis.loadTemplates;
  if (typeof load !== "function") return;

  const templates = [
    "modules/gms-reputation/templates/components/background-art.hbs",
    "modules/gms-reputation/templates/components/identity.hbs",
    "modules/gms-reputation/templates/components/portrait-frame.hbs",
    "modules/gms-reputation/templates/components/reputation-track.hbs",
    "modules/gms-reputation/templates/components/smart-selector.hbs",
    "modules/gms-reputation/templates/components/special-protocol.hbs",
    "modules/gms-reputation/templates/components/portrait-editor.hbs",
    "modules/gms-reputation/templates/player/card.hbs",
    "modules/gms-reputation/templates/player/focal.hbs",
    "modules/gms-reputation/templates/player/dashboard.hbs",
    "modules/gms-reputation/templates/player/detail.hbs",
    "modules/gms-reputation/templates/master/shell.hbs",
    "modules/gms-reputation/templates/master/profiles.hbs",
    "modules/gms-reputation/templates/master/characters.hbs",
    "modules/gms-reputation/templates/master/relationship.hbs",
    "modules/gms-reputation/templates/master/history.hbs",
    "modules/gms-reputation/templates/master/cleanup.hbs",
    "modules/gms-reputation/templates/master/system.hbs"
  ];

  try {
    await load(templates);
  } catch (err) {
    console.warn(`${MODULE_TITLE} | Aviso ao pré-carregar templates Handlebars:`, err);
  }
}

export function onInit() {
  assertArchitectureContracts();
  registerSettings();
  registerSceneControls();

  // Expor a API Pública canônica imediatamente
  const api = createPublicApi();
  const module = globalThis.game?.modules?.get(MODULE_ID);
  if (module) module.api = api;
  globalThis.GMS_REPUTATION = api;

  // Pré-carregar templates Handlebars
  preloadHandlebarsTemplates();

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

