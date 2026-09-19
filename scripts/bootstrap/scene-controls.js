import { canUser, canOpenMaster, MODULE_CAPABILITY } from "../services/permission-service.js";
import { createPublicApi } from "../compatibility/public-api.js";

let registered = false;

function nextOrder(record = {}) {
  const orders = Object.values(record ?? {}).map((entry) => Number(entry?.order)).filter(Number.isFinite);
  return orders.length ? Math.max(...orders) + 1 : Object.keys(record ?? {}).length;
}

function resolveHostControl(controls = {}) {
  if (Array.isArray(controls)) {
    return controls.find((c) => c?.name === "token" || c?.name === "tokens") ?? controls[0] ?? null;
  }
  if (controls?.tokens?.tools) return controls.tokens;
  if (controls?.token?.tools) return controls.token;
  return Object.values(controls ?? {}).find((control) => control?.tools && control.visible !== false) ?? null;
}

function installTool(tools, key, tool) {
  if (!tools) return false;
  if (Array.isArray(tools)) {
    const existingIndex = tools.findIndex((t) => t?.name === tool.name);
    if (existingIndex >= 0) {
      tools[existingIndex] = tool;
    } else {
      tools.push(tool);
    }
    return true;
  }
  if (typeof tools === "object") {
    tools[key] = tool;
    return true;
  }
  return false;
}

function removeTool(tools, name) {
  if (!tools) return;
  if (Array.isArray(tools)) {
    const idx = tools.findIndex((t) => t?.name === name);
    if (idx >= 0) tools.splice(idx, 1);
  } else if (typeof tools === "object") {
    delete tools[name];
  }
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
      onClick: () => {
        try {
          api.openPlayerDashboard();
        } catch (error) {
          console.error("GMS Reputation | Falha ao abrir Dashboard do Jogador.", error);
        }
      },
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
        onClick: () => {
          try {
            api.openMasterShell();
          } catch (error) {
            console.error("GMS Reputation | Falha ao abrir Painel do Mestre.", error);
          }
        },
        onChange: () => {
          try {
            api.openMasterShell();
          } catch (error) {
            console.error("GMS Reputation | Falha ao abrir Painel do Mestre.", error);
          }
        }
      });
    } else {
      removeTool(host.tools, "gmsReputationMaster");
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
