import { MODULE_ID } from "../constants.js";
import { designatedAuthorityUser, isFullGamemaster } from "./permissions.js";

export const SOCKET_CHANNEL = `module.${MODULE_ID}`;
const pending = new Map();
let initialized = false;
let writeHandler = null;

function randomId() {
  return globalThis.foundry?.utils?.randomID?.(20) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function setAuthorityWriteHandler(handler) {
  writeHandler = typeof handler === "function" ? handler : null;
}

function reply(request, payload) {
  globalThis.game?.socket?.emit?.(SOCKET_CHANNEL, {
    type: "write-response",
    requestId: request.requestId,
    targetUserId: request.senderId,
    authorityUserId: globalThis.game?.user?.id ?? null,
    ...payload
  });
}

async function onSocketMessage(message = {}) {
  if (!message || typeof message !== "object") return;
  if (message.type === "write-response") {
    if (String(message.targetUserId || "") !== String(globalThis.game?.user?.id || "")) return;
    const request = pending.get(String(message.requestId || ""));
    if (!request) return;
    pending.delete(String(message.requestId));
    clearTimeout(request.timer);
    if (message.ok) request.resolve(message.state);
    else request.reject(new Error(String(message.error || "A autoridade do mundo recusou a gravação.")));
    return;
  }

  if (message.type !== "write-request" || !isFullGamemaster()) return;
  const designated = designatedAuthorityUser();
  if (designated && String(designated.id) !== String(globalThis.game?.user?.id)) return;
  if (!writeHandler) return reply(message, { ok: false, error: "Authority write handler is unavailable." });
  try {
    const state = await writeHandler(message);
    reply(message, { ok: true, state });
  } catch (error) {
    reply(message, { ok: false, error: error?.message || String(error) });
  }
}

export function initializeAuthorityBroker({ handler } = {}) {
  if (handler) setAuthorityWriteHandler(handler);
  if (initialized) return;
  initialized = true;
  globalThis.game?.socket?.on?.(SOCKET_CHANNEL, onSocketMessage);
}

export function shutdownAuthorityBroker() {
  if (!initialized) return;
  globalThis.game?.socket?.off?.(SOCKET_CHANNEL, onSocketMessage);
  initialized = false;
}

export function requestAuthorityWrite(candidate, {
  expectedRevision,
  createBackup = true,
  timeoutMs = 8000
} = {}) {
  const authority = designatedAuthorityUser();
  if (!authority) return Promise.reject(new Error("Nenhum Gamemaster completo está online para autorizar esta gravação."));
  if (!globalThis.game?.socket?.emit) return Promise.reject(new Error("Canal de sincronização do Foundry indisponível."));
  const requestId = randomId();
  const senderId = String(globalThis.game?.user?.id || "");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error("A autoridade do mundo não respondeu à solicitação de gravação."));
    }, Math.max(1000, Number(timeoutMs) || 8000));
    pending.set(requestId, { resolve, reject, timer });
    globalThis.game.socket.emit(SOCKET_CHANNEL, {
      type: "write-request",
      requestId,
      senderId,
      authorityUserId: authority.id,
      expectedRevision,
      createBackup: Boolean(createBackup),
      candidate
    });
  });
}
