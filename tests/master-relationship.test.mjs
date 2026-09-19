import test from "node:test";
import assert from "node:assert/strict";

import { RelationshipController } from "../scripts/applications/master/controllers/relationship-controller.js";
import { ReputationService } from "../scripts/services/reputation-service.js";
import { WorldStateRepository } from "../scripts/state/repository.js";

test("RelationshipController: _buildContext with active relationship and protocols", () => {
  const controller = new RelationshipController();
  const state = {
    profiles: {
      "p1": {
        id: "p1",
        name: "Matriz Primária",
        subjectIds: ["s1", "s2"],
        relationships: {
          "s1": { subjectId: "s1", score: 10.5, bond: true, communion: true, note: "Sincronia absoluta." },
          "s2": { subjectId: "s2", score: -4.0, bond: false, communion: false }
        }
      }
    },
    subjects: {
      "s1": { id: "s1", alias: "Vane", portrait: { src: "vane.png" }, active: true },
      "s2": { id: "s2", alias: "Lyra", active: true }
    }
  };

  controller.selectedProfileId = "p1";
  controller.selectedSubjectId = "s1";
  const ctx = controller._buildContext(state);

  assert.equal(ctx.hasSelectedRelation, true);
  assert.equal(ctx.currentSubject.alias, "Vane");
  assert.equal(ctx.currentRelationship.score, 10.5);
  assert.equal(ctx.relationView.scoreLimit, 12); // Bond raises limit to 12
  assert.equal(ctx.isDualSync, true); // Bond + Communion + Score >= 10
  assert.equal(ctx.rosterList.length, 2);
  assert.equal(ctx.showBulkBar, false);

  // Test bulk selection trigger
  controller.bulkSelected.add("s1");
  controller.bulkSelected.add("s2");
  const bulkCtx = controller._buildContext(state);
  assert.equal(bulkCtx.showBulkBar, true);
  assert.equal(bulkCtx.bulkCount, 2);
});

test("ReputationService: bulkUpdate applies to multiple subjects in one transaction", async () => {
  WorldStateRepository.resetInMemory({
    profiles: {
      "p1": {
        id: "p1",
        name: "Matriz Teste",
        relationships: {
          "s1": { subjectId: "s1", score: 2.0, bond: false },
          "s2": { subjectId: "s2", score: 3.0, bond: false }
        }
      }
    },
    subjects: {
      "s1": { id: "s1", alias: "A", active: true },
      "s2": { id: "s2", alias: "B", active: true }
    },
    history: []
  });

  await ReputationService.bulkUpdate({
    profileId: "p1",
    subjectIds: ["s1", "s2"],
    scoreDelta: 2.5,
    bond: true
  });

  const updated = WorldStateRepository.load();
  const r1 = updated.profiles.p1.relationships.s1;
  const r2 = updated.profiles.p1.relationships.s2;

  assert.equal(r1.score, 4.5);
  assert.equal(r1.bond, true);
  assert.equal(r2.score, 5.5);
  assert.equal(r2.bond, true);
});
