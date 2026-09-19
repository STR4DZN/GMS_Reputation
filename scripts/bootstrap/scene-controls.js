import { canUser, canOpenMaster, MODULE_CAPABILITY } from "../services/permission-service.js";
import { createPublicApi } from "../compatibility/public-api.js";

let registered = false;

function nextOrder(record = {}) {
  const orders = Object.values(record ?? {}).map((entry) => Number(entry?.order)).filter(Number.isFinite);
  return orders.length ? Math.max(...orders) + 1 : Object.keys(record ?? {}).length;
}

function resolveHostControl(controls = {}) {
  if (controls.tokens?.tools) return controls.tokens;
  return Object.values(controls).find((control) => control?.tools && control.visible !== false) ?? null;
}

function installTool(tools, key, tool) {
  if (!tools || typeof tools !== "object") return false;
  tools[key] = tool;
  return true;
}

export function registerSceneControls() {
  if (registered) return false;
  if (typeof globalThis.Hooks?.on !== "function") return false;
  registered = true;

  Hooks.on("getSceneControlButtons", (controls = {}) => {
    const user = globalThis.game?.user;
    if (!canUser(MODULE_CAPABILITY.READ, user)) return;

    const host = resolveHostControl(controls);
    if (!host?.tools) return;

    const api = createPublicApi();

    // Botão Jogador (Matriz de Reputação)
    installTool(host.tools, "gmsReputationPlayer", {
      name: "gmsReputationPlayer",
      title: "GMS // Matriz de Reputação",
      icon: "fa-solid fa-people-arrows-left-right",
      order: nextOrder(host.tools),
      button: true,
      visible: true,
      onChange: () => {
        try {
          api.openPlayerDashboard();
        } catch (error) {
          console.error("GMS Reputation | Falha ao abrir Dashboard do Jogador.", error);
        }
      }
    });

    // Botão Mestre (Controle de Reputação)
    if (canOpenMaster(user)) {
      installTool(host.tools, "gmsReputationMaster", {
        name: "gmsReputationMaster",
        title: "GMS // Painel do Mestre",
        icon: "fa-solid fa-shield-halved",
        order: nextOrder(host.tools),
        button: true,
        visible: true,
        onChange: () => {
          try {
            api.openMasterShell();
          } catch (error) {
            console.error("GMS Reputation | Falha ao abrir Painel do Mestre.", error);
          }
        }
      });
    } else {
      delete host.tools.gmsReputationMaster;
    }
  });

  Hooks.on("gmsReputationPermissionsChanged", () => {
    try {
      globalThis.ui?.controls?.render?.({ force: true, reset: true });
    } catch (_) {}
  });

  return true;
}

export function resetSceneControlsForTests() {
  registered = false;
}
