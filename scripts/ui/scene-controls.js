import { MODULE_CAPABILITY, canOpenMasterPanel, canUser } from "../persistence/permissions.js";
import { openMasterPanel } from "../apps/master-panel.js";
import { openPlayerDashboard } from "../apps/player-dashboard.js";
import { notify } from "../apps/application-compat.js";

let registered = false;

function nextOrder(record = {}) {
  const orders = Object.values(record ?? {}).map((entry) => Number(entry?.order)).filter(Number.isFinite);
  return orders.length ? Math.max(...orders) + 1 : Object.keys(record ?? {}).length;
}

function resolveHostControl(controls = {}) {
  // Foundry v13 documents adding application buttons to an existing SceneControl.
  // Token controls are always the preferred host because they exist for both Players and GMs.
  if (controls.tokens?.tools) return controls.tokens;
  return Object.values(controls).find((control) => control?.tools && control.visible !== false) ?? null;
}

function reportLauncherFailure(label, error) {
  console.error(`GMS Reputation | Falha ao abrir ${label}.`, error);
  const reason = String(error?.message || error || "erro desconhecido");
  notify("error", `${label} não pôde ser aberto. ${reason}`);
}

function launch(label, opener) {
  try {
    const result = opener();
    if (result && typeof result.then === "function") {
      result.catch((error) => reportLauncherFailure(label, error));
    }
    return result;
  } catch (error) {
    reportLauncherFailure(label, error);
    return null;
  }
}

function installTool(tools, key, tool) {
  if (!tools || typeof tools !== "object") return false;
  tools[key] = tool;
  return true;
}

/**
 * Launcher v13 robusto.
 *
 * Não cria mais um SceneControl próprio com activeTool apontando para um button.
 * Em vez disso segue o padrão documentado pelo Foundry v13 e adiciona botões
 * ao SceneControl de Tokens (ou ao primeiro controle compatível como fallback).
 * Isso remove o rótulo duplicado e evita o estado inválido de activeTool.
 */
export function registerSceneControlLauncher() {
  if (registered) return false;
  if (typeof globalThis.Hooks?.on !== "function") return false;
  registered = true;

  Hooks.on("getSceneControlButtons", (controls = {}) => {
    const user = globalThis.game?.user;
    if (!canUser(user, MODULE_CAPABILITY.READ)) return;

    const host = resolveHostControl(controls);
    if (!host?.tools) {
      console.warn("GMS Reputation | Nenhum SceneControl compatível foi encontrado para instalar os launchers.");
      return;
    }

    installTool(host.tools, "gmsReputationPlayer", {
      name: "gmsReputationPlayer",
      title: "Abrir Matriz de Reputação",
      icon: "fa-solid fa-people-arrows-left-right",
      order: nextOrder(host.tools),
      button: true,
      visible: true,
      onChange: () => launch("Matriz de Reputação", () => openPlayerDashboard())
    });

    if (canOpenMasterPanel(user)) {
      installTool(host.tools, "gmsReputationMaster", {
        name: "gmsReputationMaster",
        title: "Abrir Controle de Reputação",
        icon: "fa-solid fa-shield-halved",
        order: nextOrder(host.tools),
        button: true,
        visible: true,
        onChange: () => launch("Controle de Reputação", () => openMasterPanel())
      });
    } else {
      delete host.tools.gmsReputationMaster;
    }
  });

  // Quando um GM altera permissões, redesenha os controles para que o botão
  // de Mestre apareça/desapareça sem exigir F5.
  Hooks.on("gmsReputationPermissionsChanged", () => {
    try {
      globalThis.ui?.controls?.render?.({ force: true, reset: true });
    } catch (error) {
      console.warn("GMS Reputation | Não foi possível atualizar os Scene Controls após mudança de permissão.", error);
    }
  });

  return true;
}

export function resetSceneControlLauncherForTests() {
  registered = false;
}
