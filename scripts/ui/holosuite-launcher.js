import { MODULE_ID } from "../constants.js";
import { MODULE_CAPABILITY, canOpenMasterPanel, canUser } from "../persistence/permissions.js";
import { openMasterPanel } from "../apps/master-panel.js";
import { openPlayerDashboard } from "../apps/player-dashboard.js";
import { notify } from "../apps/application-compat.js";

let registered = false;

function reportFailure(error) {
  console.error("GMS Reputation | Falha ao abrir o app de Reputação.", error);
  notify("error", `Reputação não pôde ser aberta. ${String(error?.message || error || "erro desconhecido")}`);
}

function openApp(open) {
  try {
    const app = open();
    if (typeof app?.then === "function") app.catch(reportFailure);
    return app;
  } catch (error) {
    reportFailure(error);
    return null;
  }
}

export function openReputationApp() {
  if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.READ)) return null;
  return openApp(openPlayerDashboard);
}

export function openMasterReputationApp() {
  const user = globalThis.game?.user;
  if (user?.isGM !== true || !canOpenMasterPanel(user)) return null;
  return openApp(openMasterPanel);
}

/** Public HoloSuite Core registerApp contract; repeated IDs replace the tiles. */
export function registerReputationApp(api = null) {
  const core = globalThis.game?.modules?.get?.("holosuite-core");
  if (core?.active === false) return false;
  const host = api ?? core?.api ?? globalThis.game?.holosuite;
  if (typeof host?.registerApp !== "function") return false;
  try {
    const apps = [{
      id: MODULE_ID,
      title: "Reputação",
      icon: "fa-solid fa-heart",
      premium: false,
      playerVisible: true,
      description: "Relações, vínculos e reputação dos personagens.",
      featureId: MODULE_ID,
      open: openReputationApp
    }, {
      id: `${MODULE_ID}-gm`,
      title: "Gerenciar Reputação",
      icon: "fa-solid fa-shield-halved",
      premium: false,
      playerVisible: false,
      description: "Edição da Matriz de Reputação para o GM.",
      featureId: MODULE_ID,
      open: openMasterReputationApp
    }];
    let success = true;
    for (const app of apps) {
      const result = host.registerApp(app);
      if (result === null || result === false) success = false;
    }
    return success;
  } catch (error) {
    console.error("GMS Reputation | Falha ao registrar o app no HoloSuite.", error);
    return false;
  }
}

export function registerHoloSuiteLauncher() {
  if (registered || typeof globalThis.Hooks?.on !== "function") return false;
  registered = true;
  Hooks.on("holosuite-core.apiReady", (api) => registerReputationApp(api));
  Hooks.on("gmsReputationPermissionsChanged", () => registerReputationApp());
  Hooks.on("hotReload", (data = {}) => {
    const id = data.packageId ?? data.package?.id;
    if (!id || id === MODULE_ID || id === "holosuite-core") registerReputationApp();
  });
  registerReputationApp();
  return true;
}

export function resetHoloSuiteLauncherForTests() {
  registered = false;
}
