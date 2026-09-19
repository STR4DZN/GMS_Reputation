import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicApi } from "../scripts/compatibility/public-api.js";
import { WorldStateRepository } from "../scripts/state/repository.js";
import { createEmptyWorldState, createProfile, createSubject, createRelationship } from "../scripts/state/schema.js";

function setupMockWorld() {
  const base = createEmptyWorldState();
  const sub1 = createSubject({ id: "subj-api-1", realName: "Alice Smith", alias: "Valkyrie" });
  const sub2 = createSubject({ id: "subj-api-2", realName: "Bob Vance", alias: "Anchor" });
  const prof1 = createProfile({
    id: "prof-api-1",
    name: "Operação Alpha",
    relationships: {
      "subj-api-1": createRelationship("subj-api-1", { score: 3.0, communion: false, bond: false })
    }
  });

  const state = {
    ...base,
    subjects: { "subj-api-1": sub1, "subj-api-2": sub2 },
    profiles: { "prof-api-1": prof1 }
  };

  WorldStateRepository.save(state, { reason: "Init API test" });
}

test("Gate 16: Public API contract and structure", () => {
  const api = createPublicApi();

  assert.equal(api.moduleId, "gms-reputation");
  assert.equal(api.schemaVersion, 5);
  assert.ok(api.version);

  // Domains
  assert.equal(typeof api.score.clampScore, "function");
  assert.equal(typeof api.semanticBands.resolveSemanticBand, "function");
  assert.equal(typeof api.specials.getSpecialPresentation, "function");
  assert.equal(typeof api.specials.getDualSyncState, "function");
  assert.equal(typeof api.portraits.normalizePortrait, "function");
  assert.equal(typeof api.schema.normalizeWorldState, "function");

  // Services
  assert.ok(api.reputation);
  assert.ok(api.profiles);
  assert.ok(api.subjects);
  assert.ok(api.groups);
  assert.ok(api.history);
  assert.ok(api.permissions);
  assert.ok(api.cleanup);
  assert.ok(api.store);
  assert.ok(api.repository);
  assert.ok(api.motion);

  // Applications
  assert.ok(api.applications.PlayerDashboard);
  assert.ok(api.applications.MasterShell);
  assert.ok(api.applications.RelationshipDetail);
});

test("Gate 16: Public API macro mutations and operations", async () => {
  setupMockWorld();
  const api = createPublicApi();

  // 1. getReputation
  const rel1 = api.getReputation("prof-api-1", "subj-api-1");
  assert.equal(rel1.score, 3.0);
  assert.equal(rel1.bond, false);

  // 2. setScore
  await api.setScore("prof-api-1", "subj-api-1", 4.5, "Macro set score");
  const rel2 = api.getReputation("prof-api-1", "subj-api-1");
  assert.equal(rel2.score, 4.5);

  // 3. adjustScore
  await api.adjustScore("prof-api-1", "subj-api-1", 0.5, "Macro bump");
  const rel3 = api.getReputation("prof-api-1", "subj-api-1");
  assert.equal(rel3.score, 5.0);

  // 4. toggleBond
  await api.toggleBond("prof-api-1", "subj-api-1", "Macro bond");
  const rel4 = api.getReputation("prof-api-1", "subj-api-1");
  assert.equal(rel4.bond, true);

  // 5. bulkUpdate
  await api.bulkUpdate({
    profileIds: ["prof-api-1"],
    subjectIds: ["subj-api-1", "subj-api-2"],
    setScore: 11.0,
    reason: "Bulk set"
  });
  const relAlice = api.getReputation("prof-api-1", "subj-api-1");
  const relBob = api.getReputation("prof-api-1", "subj-api-2");
  assert.equal(relAlice.score, 11.0); // Alice has bond: true -> expanded limit up to 12.0
  assert.equal(relBob.score, 10.0);   // Bob has bond: false -> base limit clamped to 10.0!

  // 6. undo & redo
  const undoResult = await api.undo();
  assert.ok(undoResult);
  const relAliceUndo = api.getReputation("prof-api-1", "subj-api-1");
  assert.equal(relAliceUndo.score, 5.0);

  const redoResult = await api.redo();
  assert.ok(redoResult);
  const relAliceRedo = api.getReputation("prof-api-1", "subj-api-1");
  assert.equal(relAliceRedo.score, 11.0);
});

test("Gate 16: Public API on-demand migration loading", async () => {
  const api = createPublicApi();
  assert.ok(api.migration);
  assert.equal(typeof api.migration.buildLegacyMigrationSnapshot, "function");
  assert.equal(typeof api.migration.migrateLegacyIfNeeded, "function");

  // Call snapshot (when no journal present in node environment, returns available: false cleanly)
  const snapshot = await api.migration.buildLegacyMigrationSnapshot();
  assert.equal(snapshot.available, false);
  assert.equal(snapshot.reason, "journal-not-found");
});
