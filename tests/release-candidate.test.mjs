import { test } from "node:test";
import assert from "node:assert/strict";
import { onInit } from "../scripts/bootstrap/init.js";
import { onReady } from "../scripts/bootstrap/ready.js";
import { createPublicApi } from "../scripts/compatibility/public-api.js";
import { WorldStateRepository } from "../scripts/state/repository.js";
import { createEmptyWorldState, createProfile, createSubject, createRelationship } from "../scripts/state/schema.js";
import { PermissionService, MODULE_CAPABILITY } from "../scripts/services/permission-service.js";
import { ReputationService } from "../scripts/services/reputation-service.js";
import { HistoryService } from "../scripts/services/history-service.js";
import { BackupService } from "../scripts/state/backup.js";
import { buildPlayerDashboardReadModel } from "../scripts/read-models/player-dashboard.js";
import { MasterShellApplication } from "../scripts/applications/master/master-shell.js";
import { ReputationPlayerDashboardApplication } from "../scripts/applications/player/player-dashboard.js";

// Mock Foundry environment globals
function setupMockFoundry() {
  const settingsStore = new Map();
  const mockUsers = new Map();

  const gmUser = { id: "user-gm-1", name: "Gamemaster", isGM: true, role: 4, active: true };
  const assistantUser = { id: "user-ast-1", name: "Assistant GM", isGM: false, role: 3, active: true };
  const playerUser = { id: "user-ply-1", name: "Player One", isGM: false, role: 1, active: true };

  mockUsers.set(gmUser.id, gmUser);
  mockUsers.set(assistantUser.id, assistantUser);
  mockUsers.set(playerUser.id, playerUser);

  globalThis.game = {
    user: gmUser,
    users: mockUsers,
    modules: new Map([
      ["gms-reputation", { id: "gms-reputation", active: true }]
    ]),
    settings: {
      register: (moduleId, key, def) => {
        settingsStore.set(`${moduleId}.${key}`, def.default);
      },
      get: (moduleId, key) => settingsStore.get(`${moduleId}.${key}`),
      set: async (moduleId, key, val) => {
        settingsStore.set(`${moduleId}.${key}`, val);
        return val;
      }
    },
    socket: {
      on: () => {},
      off: () => {},
      emit: () => {}
    }
  };

  globalThis.Hooks = {
    once: () => {},
    on: () => {},
    callAll: () => {}
  };

  globalThis.ui = {
    notifications: {
      info: () => {},
      warn: () => {},
      error: () => {}
    },
    controls: {
      render: () => {}
    }
  };
}

test("Gate 18: Full End-to-End Release Candidate Simulation", async () => {
  setupMockFoundry();

  // 1. Init Hook Lifecycle
  assert.doesNotThrow(() => onInit(), "onInit must execute without errors");

  // 2. Ready Hook Lifecycle
  await onReady();
  const moduleObj = globalThis.game.modules.get("gms-reputation");
  assert.ok(moduleObj.api, "module.api must be exposed on ready");
  const api = moduleObj.api;

  // 3. Permission Matrix Checks
  const gm = globalThis.game.users.get("user-gm-1");
  const assistant = globalThis.game.users.get("user-ast-1");
  const player = globalThis.game.users.get("user-ply-1");

  assert.equal(PermissionService.isFullGamemaster(gm), true);
  assert.equal(PermissionService.canOpenMaster(gm), true);
  assert.equal(PermissionService.canUser(MODULE_CAPABILITY.RELATIONSHIPS, gm), true);

  assert.equal(PermissionService.isAssistant(assistant), true);
  assert.equal(PermissionService.canOpenMaster(assistant), true);
  assert.equal(PermissionService.canUser(MODULE_CAPABILITY.CONFIGURE_PERMISSIONS, assistant), false);

  assert.equal(PermissionService.canOpenMaster(player), false);
  assert.equal(PermissionService.canUser(MODULE_CAPABILITY.RELATIONSHIPS, player), false);
  assert.equal(PermissionService.canUser(MODULE_CAPABILITY.READ, player), true);

  // 4. WorldState Seed & Entity Population
  const seedState = createEmptyWorldState({ createdBy: gm.id });
  const sub1 = createSubject({ id: "rc-sub-1", realName: "Cassian Hollowell", alias: "Vazio", sortOrder: 10 });
  const sub2 = createSubject({ id: "rc-sub-2", realName: "Audrion Miguel", alias: "Espectro", sortOrder: 20 });
  const prof1 = createProfile({
    id: "rc-prof-1",
    name: "Dossiê Social 01",
    relationships: {
      "rc-sub-1": createRelationship("rc-sub-1", { score: 2.0, bond: false, communion: false })
    }
  });

  const baseState = {
    ...seedState,
    subjects: { "rc-sub-1": sub1, "rc-sub-2": sub2 },
    profiles: { "rc-prof-1": prof1 }
  };
  await WorldStateRepository.save(baseState, { reason: "RC Seed" });

  // 5. Macro Operations (Mutations & Protocols)
  await api.setScore("rc-prof-1", "rc-sub-1", 5.0, "Progressão social");
  let rel1 = api.getReputation("rc-prof-1", "rc-sub-1");
  assert.equal(rel1.score, 5.0);

  // Ativação de Vínculo
  await api.toggleBond("rc-prof-1", "rc-sub-1", "Laço formalizado");
  rel1 = api.getReputation("rc-prof-1", "rc-sub-1");
  assert.equal(rel1.bond, true);

  // Ativação de Comunhão (resultando em DUPLO//SINC)
  await api.toggleCommunion("rc-prof-1", "rc-sub-1", "Comunhão estabelecida");
  rel1 = api.getReputation("rc-prof-1", "rc-sub-1");
  assert.equal(rel1.communion, true);
  assert.equal(rel1.bond, true);

  const specialState = api.specials.getSpecialPresentation(rel1);
  assert.equal(specialState.active, true);
  assert.equal(specialState.state, "dual-sync");

  // Ajuste de pontuação até o limite expandido (12.0)
  await api.setScore("rc-prof-1", "rc-sub-1", 12.0, "Score máximo expandido");
  rel1 = api.getReputation("rc-prof-1", "rc-sub-1");
  assert.equal(rel1.score, 12.0);

  // 6. Operação em Lote (Bulk)
  await api.bulkUpdate({
    profileIds: ["rc-prof-1"],
    subjectIds: ["rc-sub-1", "rc-sub-2"],
    scoreDelta: -1.0,
    reason: "Crise na facção"
  });
  rel1 = api.getReputation("rc-prof-1", "rc-sub-1");
  let rel2 = api.getReputation("rc-prof-1", "rc-sub-2");
  assert.equal(rel1.score, 11.0);
  assert.equal(rel2.score, -1.0);

  // 7. Reversibilidade e Histórico (Undo / Redo)
  const undoResult = await api.undo();
  assert.ok(undoResult);
  rel1 = api.getReputation("rc-prof-1", "rc-sub-1");
  rel2 = api.getReputation("rc-prof-1", "rc-sub-2");
  assert.equal(rel1.score, 12.0);
  assert.equal(rel2.score, 0);

  const redoResult = await api.redo();
  assert.ok(redoResult);
  rel1 = api.getReputation("rc-prof-1", "rc-sub-1");
  assert.equal(rel1.score, 11.0);

  // 8. Player Dashboard Read Model Projection
  const currentWorld = WorldStateRepository.load();
  const playerModel = buildPlayerDashboardReadModel({ profileId: "rc-prof-1", state: currentWorld });
  assert.equal(playerModel.hasProfile, true);
  assert.equal(playerModel.profileName, "Dossiê Social 01");
  assert.equal(playerModel.cards.length, 2);

  // 9. Master Shell Application Mount
  const masterApp = new MasterShellApplication({ initialWorkspace: "relationship", profileId: "rc-prof-1", subjectId: "rc-sub-1" });
  const masterContext = await masterApp._prepareContext();
  assert.equal(masterContext.activeWorkspace, "relationship");
  assert.ok(masterContext.workspaces.length >= 6);

  // 10. Backup & Restore
  const exported = api.exportBackup();
  assert.ok(typeof exported === "string" && exported.length > 50);

  await api.setScore("rc-prof-1", "rc-sub-1", 0, "Zerar para teste de restore");
  assert.equal(api.getReputation("rc-prof-1", "rc-sub-1").score, 0);

  await api.restoreBackup(exported);
  assert.equal(api.getReputation("rc-prof-1", "rc-sub-1").score, 11.0);
});
