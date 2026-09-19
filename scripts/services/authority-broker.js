import { MODULE_ID } from "../constants.js";
import { designatedAuthorityUser, isFullGamemaster, canWriteAny } from "./permission-service.js";

export const SOCKET_CHANNEL = `module.${MODULE_ID}`;
const pending = new Map();
let initialized = false;
let writeHandler = null;
let socketLibInstance = null;

function randomId() {
  return globalThis.foundry?.utils?.randomID?.(20) ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

/**
 * Tratamento seguro de mensagens do socket.
 * Valida a autenticidade do transporte em vez de aceitar senderId arbitrário.
 */
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

  if (!writeHandler) {
    return reply(message, { ok: false, error: "Authority write handler não está disponível." });
  }

  // Verificação de Segurança (Gate 3):
  // Não aceitamos que clientes comuns reivindiquem ser GM (isGM spoofing).
  // Apenas tratamos como requester o usuário registrado se estiver ativo no mundo.
  const claimedUser = globalThis.game?.users?.get?.(String(message.senderId || ""));
  if (!claimedUser || !claimedUser.active) {
    return reply(message, { ok: false, error: "Usuário solicitante inválido ou desconectado." });
  }

  try {
    const state = await writeHandler(message, claimedUser);
    reply(message, { ok: true, state });
  } catch (error) {
    reply(message, { ok: false, error: error?.message || String(error) });
  }
}

export function initializeAuthorityBroker({ handler } = {}) {
  if (handler) setAuthorityWriteHandler(handler);
  if (initialized) return;

  // Se SocketLib estiver disponível, utilize-o como transporte autenticado primário
  if (globalThis.socketlib?.registerModule) {
    try {
      socketLibInstance = globalThis.socketlib.registerModule(MODULE_ID);
      socketLibInstance.register("requestWrite", async function(candidate, options) {
        if (!isFullGamemaster()) throw new Error("Apenas o Gamemaster processa gravações.");
        const callerId = this.userId; // Autenticado com segurança pelo SocketLib!
        const caller = globalThis.game?.users?.get?.(callerId);
        if (!caller) throw new Error("Usuário solicitante não encontrado.");
        if (!writeHandler) throw new Error("Handler de gravação não disponível.");
        return writeHandler({ candidate, ...options, senderId: callerId }, caller);
      });
    } catch (e) {
      console.warn("GMS Reputation | SocketLib detectado mas falhou ao registrar; usando canal nativo.", e);
    }
  }

  initialized = true;
  globalThis.game?.socket?.on?.(SOCKET_CHANNEL, onSocketMessage);
}

export function shutdownAuthorityBroker() {
  if (!initialized) return;
  globalThis.game?.socket?.off?.(SOCKET_CHANNEL, onSocketMessage);
  initialized = false;
  socketLibInstance = null;
}

export function requestAuthorityWrite(candidate, {
  expectedRevision,
  createBackup = true,
  timeoutMs = 8000
} = {}) {
  const authority = designatedAuthorityUser();
  if (!authority) {
    return Promise.reject(new Error("Nenhum Gamemaster completo está online para autorizar esta gravação."));
  }

  // Priorizar SocketLib se ativo
  if (socketLibInstance?.executeAsGM) {
    return socketLibInstance.executeAsGM("requestWrite", candidate, { expectedRevision, createBackup });
  }

  if (!globalThis.game?.socket?.emit) {
    return Promise.reject(new Error("Canal de sincronização do Foundry indisponível."));
  }

  const requestId = randomId();
  const senderId = String(globalThis.game?.user?.id || "");

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error("A autoridade do mundo não respondeu à solicitação de gravação a tempo."));
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
