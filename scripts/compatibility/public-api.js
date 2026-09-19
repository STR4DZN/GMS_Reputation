import { MODULE_ID, MODULE_VERSION, DATA_SCHEMA_VERSION } from "../constants.js";
import * as Schema from "../state/schema.js";
import * as ScoreDomain from "../domain/score.js";
import * as SemanticBandsDomain from "../domain/semantic-bands.js";
import * as SpecialsDomain from "../domain/specials.js";
import * as PortraitsDomain from "../domain/portraits.js";
import { WorldStateRepository } from "../state/repository.js";
import { ReputationService } from "../services/reputation-service.js";
import { ProfileService } from "../services/profile-service.js";
import { SubjectService } from "../services/subject-service.js";
import { GroupService } from "../services/group-service.js";
import { HistoryService } from "../services/history-service.js";
import { PermissionService } from "../services/permission-service.js";
import { CleanupService } from "../services/cleanup-service.js";
import { BackupService } from "../state/backup.js";
import { motionEngine } from "../motion/motion-engine.js";
import { ReputationPlayerDashboardApplication } from "../applications/player/player-dashboard.js";
import { ReputationRelationshipDetailApplication } from "../applications/player/relationship-detail.js";
import { MasterShellApplication } from "../applications/master/master-shell.js";

/**
 * Instâncias ativas singleton de janelas
 */
let _activePlayerDashboard = null;
let _activeMasterShell = null;
const _activeDetails = new Map();

/**
 * Fachada canônica da Public API para compatibilidade total com macros e módulos externos.
 */
export function createPublicApi() {
  return Object.freeze({
    // Metadados
    moduleId: MODULE_ID,
    version: MODULE_VERSION,
    schemaVersion: DATA_SCHEMA_VERSION,

    // UI Launchers (Macros)
    openPlayerDashboard({ profileId = null } = {}) {
      if (_activePlayerDashboard && !_activePlayerDashboard.closing) {
        if (profileId) _activePlayerDashboard.profileId = profileId;
        _activePlayerDashboard.render({ force: true });
        _activePlayerDashboard.bringToTop?.();
        return _activePlayerDashboard;
      }
      _activePlayerDashboard = new ReputationPlayerDashboardApplication({ profileId });
      _activePlayerDashboard.render(true);
      return _activePlayerDashboard;
    },

    openMasterShell({ workspace = "relationship", profileId = null, subjectId = null } = {}) {
      if (!PermissionService.canOpenMaster()) {
        const uiWarn = globalThis.ui?.notifications?.warn ?? console.warn;
        uiWarn("Você não tem permissão para abrir o Painel do Mestre.");
        return null;
      }
      if (_activeMasterShell && !_activeMasterShell.closing) {
        if (workspace) _activeMasterShell.switchWorkspace(workspace);
        if (profileId) _activeMasterShell.activeProfileId = profileId;
        if (subjectId) _activeMasterShell.activeSubjectId = subjectId;
        _activeMasterShell.render({ force: true });
        _activeMasterShell.bringToTop?.();
        return _activeMasterShell;
      }
      _activeMasterShell = new MasterShellApplication({
        initialWorkspace: workspace,
        profileId,
        subjectId
      });
      _activeMasterShell.render(true);
      return _activeMasterShell;
    },

    openRelationshipDetail({ profileId, subjectId } = {}) {
      const key = `${profileId}:${subjectId}`;
      const existing = _activeDetails.get(key);
      if (existing && !existing.closing) {
        existing.render({ force: true });
        existing.bringToTop?.();
        return existing;
      }
      const app = new ReputationRelationshipDetailApplication({ profileId, subjectId });
      _activeDetails.set(key, app);
      app.render(true);
      return app;
    },

    // Acesso e mutações diretas para macros
    getReputation(profileId, subjectId) {
      return ReputationService.getRelationship(profileId, subjectId);
    },

    async setScore(profileId, subjectId, score, reason = "") {
      return ReputationService.setScore({ profileId, subjectId, score, reason });
    },

    async adjustScore(profileId, subjectId, delta, reason = "") {
      return ReputationService.adjustScore({ profileId, subjectId, delta, reason });
    },

    async toggleBond(profileId, subjectId, reason = "") {
      return ReputationService.toggleBond({ profileId, subjectId, reason });
    },

    async toggleCommunion(profileId, subjectId, reason = "") {
      return ReputationService.toggleCommunion({ profileId, subjectId, reason });
    },

    async bulkUpdate(options = {}) {
      return ReputationService.bulkUpdate(options);
    },

    async undo() {
      return HistoryService.undo();
    },

    async redo() {
      return HistoryService.redo();
    },

    getWorldState() {
      return WorldStateRepository.load();
    },

    exportBackup() {
      return JSON.stringify(WorldStateRepository.load(), null, 2);
    },

    async restoreBackup(data) {
      return BackupService.restoreBackup(data);
    },

    // Domínios puros
    schema: Object.freeze({ ...Schema }),
    score: Object.freeze({ ...ScoreDomain }),
    semanticBands: Object.freeze({ ...SemanticBandsDomain }),
    specials: Object.freeze({ ...SpecialsDomain }),
    portraits: Object.freeze({ ...PortraitsDomain }),

    // Serviços de domínio
    reputation: ReputationService,
    profiles: ProfileService,
    subjects: SubjectService,
    groups: GroupService,
    history: HistoryService,
    permissions: PermissionService,
    cleanup: CleanupService,
    store: WorldStateRepository,
    repository: WorldStateRepository,
    motion: motionEngine,

    // Construtores de Applications
    applications: Object.freeze({
      PlayerDashboard: ReputationPlayerDashboardApplication,
      MasterShell: MasterShellApplication,
      RelationshipDetail: ReputationRelationshipDetailApplication
    }),

    // Migração legada sob demanda
    migration: Object.freeze({
      async buildLegacyMigrationSnapshot(journal = null) {
        const { buildLegacyMigrationSnapshot } = await import("./legacy-migration.js");
        return buildLegacyMigrationSnapshot(journal);
      },
      async migrateLegacyIfNeeded(options = {}) {
        const { migrateLegacyIfNeeded } = await import("./legacy-migration.js");
        return migrateLegacyIfNeeded(options);
      }
    })
  });
}
