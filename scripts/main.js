import { MODULE_ID, MODULE_TITLE, MODULE_VERSION, DATA_SCHEMA_VERSION } from "./constants.js";
import { assertArchitectureContracts } from "./architecture/contracts.js";
import { createLegacyPublicApi } from "./compatibility/public-api.js";
import * as Permissions from "./persistence/permissions.js";
import * as AuthorityBroker from "./persistence/authority-broker.js";
import * as WorldSync from "./events/world-sync.js";
import * as SceneControls from "./ui/scene-controls.js";
import * as Store from "./persistence/world-store.js";
import { registerPersistenceSettings } from "./persistence/settings.js";
import * as Migration from "./migration/legacy-migration.js";

Hooks.once("init", () => {
  assertArchitectureContracts();
  registerPersistenceSettings();
  SceneControls.registerSceneControlLauncher();
  console.info(`${MODULE_TITLE} | Inicializando ${MODULE_VERSION} | schema ${DATA_SCHEMA_VERSION}`);
});

Hooks.once("ready", async () => {
  const module = game.modules.get(MODULE_ID);
  if (!module) return;

  // Public API stays byte-for-byte compatible in shape while Architecture 60
  // reorganizes internals behind this facade.
  module.api = createLegacyPublicApi();

  AuthorityBroker.initializeAuthorityBroker({ handler: Store.handleDelegatedSaveRequest });
  WorldSync.primeWorldStateSync(Store.loadWorldState());

  // Inicialização/migração do world setting exige Gamemaster completo. Com múltiplos GMs,
  // apenas a autoridade designada executa bootstrap/migração para evitar gravações concorrentes.
  if (!Permissions.isFullGamemaster()) return;
  const designatedAuthority = Permissions.designatedAuthorityUser();
  if (designatedAuthority && String(designatedAuthority.id) !== String(game.user?.id ?? "")) return;

  try {
    await Store.initializeWorldStateIfNeeded();
    const migrationResult = await Migration.migrateLegacyIfNeeded({ auto: true });
    if (migrationResult.status === "imported") {
      console.info(`${MODULE_TITLE} | Migração automática concluída.`, migrationResult.report);
      if (migrationResult.report?.portraitConflicts?.length) {
        console.warn(`${MODULE_TITLE} | Migração detectou conflitos de retrato; a precedência determinística foi aplicada.`, migrationResult.report.portraitConflicts);
      }
    } else if (!["already-imported", "journal-not-found", "no-html-pages"].includes(migrationResult.status)) {
      console.info(`${MODULE_TITLE} | Migração não executada: ${migrationResult.status}.`);
    }
  } catch (error) {
    console.error(`${MODULE_TITLE} | Falha durante inicialização/migração da persistência.`, error);
  }
});
