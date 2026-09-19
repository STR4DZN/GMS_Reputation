import test from "node:test";
import assert from "node:assert/strict";

import { CharactersController } from "../scripts/applications/master/controllers/characters-controller.js";

test("CharactersController: _buildContext with populated state and search", () => {
  const controller = new CharactersController();
  const state = {
    subjects: {
      "s1": {
        id: "s1",
        alias: "Corvo",
        realName: "Daniel Shirako",
        sortOrder: 1,
        active: true,
        metadata: { tags: ["Guerreiro", "Assassino"] },
        portrait: { src: "corvo.png", zoom: 100 }
      },
      "s2": {
        id: "s2",
        alias: "Fio Rubro",
        realName: "Agnes",
        sortOrder: 2,
        active: true,
        metadata: { tags: ["Nobre"] }
      }
    },
    profiles: {
      "p1": { id: "p1", name: "Matriz A", subjectIds: ["s1", "s2"] },
      "p2": { id: "p2", name: "Matriz B", subjectIds: ["s1"] }
    }
  };

  controller.selectedSubjectId = "s1";
  const ctx = controller._buildContext(state);

  assert.equal(ctx.totalSubjects, 2);
  assert.equal(ctx.subjects.length, 2);
  assert.equal(ctx.subjects[0].alias, "Corvo");
  assert.equal(ctx.subjects[0].profileCount, 2); // Included in p1 and p2
  assert.equal(ctx.subjects[1].profileCount, 1); // Included only in p1
  assert.equal(ctx.hasSelectedSubject, true);
  assert.equal(ctx.selectedSubject.alias, "Corvo");
  assert.equal(ctx.tagsString, "Guerreiro, Assassino");
  assert.equal(ctx.membershipStats.count, 2);
  assert.equal(ctx.membershipStats.total, 2);

  // Test search filtering
  controller.searchQuery = "Agnes";
  const filteredCtx = controller._buildContext(state);
  assert.equal(filteredCtx.subjects.length, 1);
  assert.equal(filteredCtx.subjects[0].alias, "Fio Rubro");
});
