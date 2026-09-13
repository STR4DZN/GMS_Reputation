import { MODULE_ID } from "../constants.js";
import { designatedAuthorityUser, isFullGamemaster } from "./permissions.js";

/**
 * Kept as part of the frozen Architecture 60 public contract. Delegated writes
 * now travel through SocketLib instead of trusting identity fields carried by
 * the native Foundry module socket.
 */
export const SOCKET_CHANNEL = `module.${MODULE_ID}`;
export const SOCKETLIB_WRITE_HANDLER = "writeWorldState";

let writeHandler = null;
let socketlibSocket = null;
let registered = false;
let enabled = false;

function socketlibApi() {
  return globalThis.socketlib ?? null;
}

function callerUserId(context) {
  if (typeof context === "string" || typeof context === "number") return String(context);
  if (context && typeof context === "object") {
    const value = context.userId ?? context.id ?? context.user?.id;
    if (value !== undefined && value !== null) return String(value);
  }
  return "";
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("A autoridade do mundo não respondeu à solicitação de gravação."));
    }, ms);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

export function setAuthorityWriteHandler(handler) {
  writeHandler = typeof handler === "function" ? handler : null;
}

/**
 * SocketLib invokes registered handlers with `this` bound to the id of the
 * user that initiated the remote execution. That authenticated caller id is
 * the only requester identity accepted by the broker.
 */
async function socketlibWriteRequest(message = {}) {
  if (!enabled) throw new Error("Authority Broker is disabled.");
  if (!isFullGamemaster()) throw new Error("Este cliente não é uma autoridade completa do World.");

  const designated = designatedAuthorityUser();
  if (designated && String(designated.id) !== String(globalThis.game?.user?.id ?? "")) {
    throw new Error("Este Gamemaster não é a autoridade designada do World.");
  }

  const requesterId = callerUserId(this);
  if (!requesterId) throw new Error("SocketLib não informou a identidade do usuário solicitante.");
  if (!writeHandler) throw new Error("Authority write handler is unavailable.");

  return writeHandler(message, Object.freeze({ requesterId, transport: "socketlib" }));
}

/**
 * Register once on every client after `socketlib.ready`.
 * Safe to call again from Foundry `ready` as a fallback; registration itself
 * remains idempotent.
 */
export function initializeAuthorityBroker({ handler } = {}) {
  if (handler) setAuthorityWriteHandler(handler);
  enabled = true;
  if (registered && socketlibSocket) return true;

  const api = socketlibApi();
  if (!api?.registerModule) {
    enabled = false;
    return false;
  }

  socketlibSocket = api.registerModule(MODULE_ID);
  if (!socketlibSocket?.register || !socketlibSocket?.executeAsUser) {
    socketlibSocket = null;
    enabled = false;
    throw new Error("SocketLib não expôs a API necessária para o GMS Reputation.");
  }

  socketlibSocket.register(SOCKETLIB_WRITE_HANDLER, socketlibWriteRequest);
  registered = true;
  return true;
}

/**
 * SocketLib does not expose an unregister primitive for registered handlers.
 * Shutdown therefore disables the broker without attempting a duplicate
 * registration later in the same page session.
 */
export function shutdownAuthorityBroker() {
  enabled = false;
}

export function isAuthorityBrokerReady() {
  return Boolean(enabled && registered && socketlibSocket);
}

export async function requestAuthorityWrite(candidate, {
  expectedRevision,
  createBackup = true,
  timeoutMs = 8000
} = {}) {
  const authority = designatedAuthorityUser();
  if (!authority) throw new Error("Nenhum Gamemaster completo está online para autorizar esta gravação.");
  if (!isAuthorityBrokerReady()) {
    throw new Error("SocketLib não está pronto. Verifique se o módulo SocketLib está instalado e ativo.");
  }

  const payload = {
    expectedRevision,
    createBackup: Boolean(createBackup),
    candidate
  };

  const execution = socketlibSocket.executeAsUser(SOCKETLIB_WRITE_HANDLER, String(authority.id), payload);
  const ms = Math.max(1000, Number(timeoutMs) || 8000);
  return withTimeout(execution, ms);
}
