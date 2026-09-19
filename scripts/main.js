import { onInit } from "./bootstrap/init.js";
import { onReady } from "./bootstrap/ready.js";

/**
 * Ponto de entrada canônico do módulo GMS // Matriz de Reputação.
 * Registrado no manifesto module.json.
 */
if (typeof globalThis.Hooks?.once === "function") {
  Hooks.once("init", () => onInit());
  Hooks.once("ready", () => onReady());
}
