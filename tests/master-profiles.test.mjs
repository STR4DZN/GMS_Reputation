import test from "node:test";
import assert from "node:assert/strict";

import { ProfilesController } from "../scripts/applications/master/controllers/profiles-controller.js";

test("ProfilesController: _buildContext with populated state", () => {
  const controller = new ProfilesController();
  const state = {
    profiles: {
      "p1": {
        id: "p1",
        name: "Ordem Astral",
        groupId: "g1",
        sortOrder: 1,
        active: true,
        subjectIds: ["s1"],
        focal: { name: "Primeiro Astrólogo", description: "Líder", portrait: { src: "astral.png", zoom: 120 } }
      },
      "p2": {
        id: "p2",
        name: "Círculo de Ferro",
        groupId: null,
        sortOrder: 2,
        active: true,
        subjectIds: []
      }
    },
    groups: {
      "g1": { id: "g1", name: "Ordens Maiores" }
    },
    subjects: {
      "s1": { id: "s1", alias: "Vane", active: true },
      "s2": { id: "s2", alias: "Lyra", active: true }
    }
  };

  controller.selectedProfileId = "p1";
  const ctx = controller._buildContext(state);

  assert.equal(ctx.totalProfiles, 2);
  assert.equal(ctx.profiles.length, 2);
  assert.equal(ctx.hasSelectedProfile, true);
  assert.equal(ctx.selectedProfile.name, "Ordem Astral");
  assert.equal(ctx.groups.length, 1);
  assert.equal(ctx.rosterStats.included, 1);
  assert.equal(ctx.rosterStats.total, 2);
  assert.equal(ctx.focalPortraitContext.hasImage, true);
  assert.equal(ctx.focalPortraitContext.portrait.zoom, 120);
});

test("ProfilesController: group filtering", () => {
  const controller = new ProfilesController();
  const state = {
    profiles: {
      "p1": { id: "p1", name: "Alpha", groupId: "g1", active: true },
      "p2": { id: "p2", name: "Beta", groupId: "g2", active: true }
    },
    groups: {
      "g1": { id: "g1", name: "Group 1" },
      "g2": { id: "g2", name: "Group 2" }
    },
    subjects: {}
  };

  controller.groupFilter = "g1";
  const ctx = controller._buildContext(state);

  assert.equal(ctx.profiles.length, 1);
  assert.equal(ctx.profiles[0].name, "Alpha");
});
