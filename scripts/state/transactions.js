import { WorldStateRepository } from "./repository.js";
import { clonePlain, RevisionConflictError } from "./world-state.js";
import { createHistoryEvent, normalizeWorldState } from "./schema.js";
import { saveWorldStateBackup } from "./backup.js";
import { ingestWorldStateSetting } from "./sync.js";
import { canUser, isFullGamemaster } from "../services/permission-service.js";

export const NO_STATE_CHANGE = Symbol("gms-reputation.no-state-change");

function randomId() {
  return globalThis.foundry?.utils?.randomID?.(16) ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function stable(value) {
  try { return JSON.stringify(value ?? null); } catch (_) { return String(value); }
}

/**
 * Coordenador canônico de transações de estado.
 * Todas as mutações do módulo passam por aqui.
 */
export async function executeTransaction({
  type = "mutation",
  actor = globalThis.game?.user,
  capability = null,
  mutate = null,
  history = null,
  reason = "",
  expectedRevision = null,
  createBackup = true
} = {}) {
  if (typeof mutate !== "function") {
    throw new TypeError("executeTransaction requer uma função mutadora.");
  }

  // 1. Validar permissão
  if (capability && !canUser(capability, actor)) {
    throw new Error(`Permissão negada para a operação: ${capability}`);
  }

  // 2. Carregar estado atual
  const current = WorldStateRepository.load();

  // 3. Verificar revision
  if (expectedRevision != null && Number(expectedRevision) !== Number(current.revision)) {
    throw new RevisionConflictError(Number(expectedRevision), Number(current.revision));
  }

  // 4. Clonar draft isolado
  const draft = clonePlain(current);

  // 5. Executar alteração
  const result = await mutate(draft, current);
  if (result === NO_STATE_CHANGE) {
    return { ok: true, state: current, noOp: true };
  }
  const candidate = result && typeof result === "object" ? result : draft;

  // 6. Detectar no-op real
  if (stable(candidate) === stable(current)) {
    return { ok: true, state: current, noOp: true };
  }

  // 7. Gerar histórico
  const transactionId = randomId();
  const userId = actor?.id ? String(actor.id) : null;
  const historyEvents = [];
  const resolvedHistory = typeof history === "function" ? history(candidate, current) : history;

  if (Array.isArray(resolvedHistory)) {
    for (const h of resolvedHistory) {
      if (h && typeof h === "object") {
        historyEvents.push(createHistoryEvent({
          id: randomId(),
          transactionId,
          userId,
          reason,
          ...h
        }));
      }
    }
  } else if (history && typeof history === "object") {
    historyEvents.push(createHistoryEvent({
      id: randomId(),
      transactionId,
      userId,
      reason,
      ...history
    }));
  }

  candidate.history = [...(candidate.history || []), ...historyEvents];

  // 8. Incrementar revision
  candidate.revision = (Number(current.revision) || 0) + 1;

  // Atualizar metadata
  const now = Date.now();
  candidate.metadata = {
    ...(candidate.metadata || {}),
    updatedAt: now,
    updatedBy: userId
  };

  const finalState = normalizeWorldState(candidate);

  // 9. Criar backup se solicitado
  if (createBackup && isFullGamemaster(actor)) {
    try {
      await saveWorldStateBackup(current);
    } catch (e) {
      console.warn("GMS Reputation | Falha ao gerar backup de segurança.", e);
    }
  }

  // 10. Persistir
  const committed = await WorldStateRepository.commit(finalState);

  // 11 & 12. Publicar atualização reativa (Diff e Render Queue)
  ingestWorldStateSetting(committed, { transactionId, actorId: userId });

  return { ok: true, state: committed, noOp: false, transactionId };
}
