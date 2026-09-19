import { MODULE_ID, MODULE_TITLE } from "../constants.js";
import { createPublicApi } from "../compatibility/public-api.js";
import { initializeAuthorityBroker } from "../services/authority-broker.js";
import { isFullGamemaster, designatedAuthorityUser, canWriteAny } from "../services/permission-service.js";
import { WorldStateRepository } from "../state/repository.js";
import { RevisionConflictError } from "../state/world-state.js";

/**
 * Tratador de solicitações de gravação delegadas por usuários com permissão
 */
async function handleDelegatedSaveRequest(message, requestingUser) {
  if (!canWriteAny(requestingUser)) {
    throw new Error(`Usuário ${requestingUser.name} não possui permissão para modificar a reputação.`);
  }

  const current = WorldStateRepository.load();
  if (message.expectedRevision != null && Number(message.expectedRevision) !== Number(current.revision)) {
    throw new RevisionConflictError(Number(message.expectedRevision), Number(current.revision));
  }

  return WorldStateRepository.commit(message.candidate);
}

export async function onReady() {
  const module = globalThis.game?.modules?.get(MODULE_ID);
  if (!module) return;

  // 1. Expor a API Pública canônica
  module.api = createPublicApi();

  // 2. Inicializar o Authority Broker para comunicação multiplayer via Socket
  initializeAuthorityBroker({ handler: handleDelegatedSaveRequest });

  // 3. Garantir estado em memória
  const state = WorldStateRepository.load();

  // 4. Se for Gamemaster completo, verificar bootstrap e migração legada
  if (!isFullGamemaster()) return;
  const designated = designatedAuthorityUser();
  if (designated && String(designated.id) !== String(globalThis.game?.user?.id ?? "")) return;

  try {
    if (WorldStateRepository.isEmpty(state)) {
      console.info(`${MODULE_TITLE} | WorldState vazio; inicializando repositório limpo.`);
      await WorldStateRepository.save(state, { reason: "Inicialização do WorldState" });
    }

    // Tentar migração automática sob demanda apenas se disponível e vazio
    if (module.api.migration?.migrateLegacyIfNeeded) {
      const migrationResult = await module.api.migration.migrateLegacyIfNeeded({ auto: true });
      if (migrationResult?.status === "imported") {
        console.info(`${MODULE_TITLE} | Migração legada concluída com sucesso.`, migrationResult.report);
      }
    }
  } catch (error) {
    console.error(`${MODULE_TITLE} | Falha durante inicialização da persistência.`, error);
  }
}
