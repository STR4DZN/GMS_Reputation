import test from "node:test";
import assert from "node:assert/strict";

import { HistoryController } from "../scripts/applications/master/controllers/history-controller.js";
import { CleanupController } from "../scripts/applications/master/controllers/cleanup-controller.js";
import { SystemController } from "../scripts/applications/master/controllers/system-controller.js";
import { CleanupService } from "../scripts/services/cleanup-service.js";
import { WorldStateRepository } from "../scripts/state/repository.js";

test("HistoryController: _buildContext formats events and flags undo target", () => {
  const controller = new HistoryController();
  const state = {
    history: [
      {
        id: "e1",
        transactionId: "tx-1",
        type: "relationship",
        timestamp: 1000,
        userId: "gm1",
        before: { score: 1 },
        after: { score: 3 }
      }
    ]
  };

  const ctx = controller._buildContext(state);

  assert.equal(ctx.totalEvents, 1);
  assert.equal(ctx.events.length, 1);
  assert.equal(ctx.events[0].isUndoTarget, true);
  assert.equal(ctx.events[0].changes[0].label, "Score");
  assert.equal(ctx.events[0].changes[0].after, "3");
});

test("CleanupService: getImpact and purgeOrphanedRelationships", async () => {
  WorldStateRepository.resetInMemory({
    profiles: {
      "p1": {
        id: "p1",
        name: "Matriz Teste",
        relationships: {
          "s1": { score: 2 },
          "orphan-subject": { score: 5 } // Orphan!
        },
        subjectIds: ["s1", "orphan-subject"]
      }
    },
    subjects: {
      "s1": { id: "s1", alias: "Real Character", active: true }
    },
    groups: {}
  });

  const stateBefore = WorldStateRepository.load();
  const impact = CleanupService.getImpact(stateBefore);

  assert.equal(impact.subjects.length, 1);
  assert.equal(impact.profiles.length, 1);
  assert.equal(impact.profiles[0].relationshipCount, 2);

  await CleanupService.purgeOrphanedRelationships();

  const stateAfter = WorldStateRepository.load();
  const rels = stateAfter.profiles.p1.relationships;

  assert.equal(Object.hasOwn(rels, "s1"), true);
  assert.equal(Object.hasOwn(rels, "orphan-subject"), false);
  assert.deepEqual(stateAfter.profiles.p1.subjectIds, ["s1"]);
});

test("SystemController: _buildContext provides diagnostics and preferences", () => {
  const controller = new SystemController();
  const state = {
    revision: 42,
    profiles: { "p1": { relationships: { "s1": {} } } },
    subjects: { "s1": {} },
    history: [{}, {}]
  };

  const ctx = controller._buildContext(state);

  assert.equal(ctx.diagnostics.schemaVersion, 5);
  assert.equal(ctx.diagnostics.worldRevision, 42);
  assert.equal(ctx.diagnostics.profileCount, 1);
  assert.equal(ctx.diagnostics.subjectCount, 1);
  assert.equal(ctx.diagnostics.relationshipCount, 1);
  assert.equal(ctx.diagnostics.historyCount, 2);
  assert.equal(typeof ctx.saveMode, "string");
  assert.equal(typeof ctx.saveDelay, "number");
  assert.equal(Boolean(ctx.permissions.assistant), true);
});
