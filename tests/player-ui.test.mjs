import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlayerCardReadModel,
  buildPlayerDashboardReadModel,
  buildSubjectDetailReadModel
} from "../scripts/read-models/player-dashboard.js";

test("Player Read Models: buildPlayerCardReadModel", () => {
  const subject = {
    id: "subj-1",
    alias: "Kaelen",
    realName: "Kaelen Thorne",
    portrait: { src: "icons/kaelen.png", zoom: 100, x: 50, y: 50 },
    active: true
  };
  const relationship = {
    subjectId: "subj-1",
    score: 6.5,
    bond: true,
    communion: false,
    note: "Aliança leal."
  };

  const card = buildPlayerCardReadModel({ subject, relationship, profileId: "prof-1" });

  assert.equal(card.subjectId, "subj-1");
  assert.equal(card.profileId, "prof-1");
  assert.equal(card.identity.alias, "Kaelen");
  assert.equal(card.identity.realName, "Kaelen Thorne");
  assert.equal(card.score.text, "6,5");
  assert.equal(card.score.limit, 12); // Bond raises limit to 12
  assert.equal(card.special.active, true);
  assert.equal(card.special.state, "bond");
  assert.equal(card.hasNotes, true);
});

test("Player Read Models: buildPlayerDashboardReadModel", () => {
  const state = {
    revision: 14,
    profiles: {
      "prof-1": {
        id: "prof-1",
        name: "A Ordem de Vidro",
        groupId: "grp-1",
        active: true,
        subjectIds: ["subj-1", "subj-2"],
        focal: {
          name: "Grande Matriarca",
          description: "Líder suprema da ordem.",
          portrait: { src: "icons/matriarch.png" }
        },
        relationships: {
          "subj-1": { subjectId: "subj-1", score: 4.0 },
          "subj-2": { subjectId: "subj-2", score: -5.0 }
        }
      },
      "prof-2": {
        id: "prof-2",
        name: "Sindicato Oculto",
        active: true,
        subjectIds: ["subj-1"],
        relationships: {
          "subj-1": { subjectId: "subj-1", score: 1.0 }
        }
      }
    },
    groups: {
      "grp-1": { id: "grp-1", name: "Fações Nobres", active: true }
    },
    subjects: {
      "subj-1": { id: "subj-1", alias: "Vane", active: true, sortOrder: 1 },
      "subj-2": { id: "subj-2", alias: "Corvo", active: true, sortOrder: 2 },
      "subj-3": { id: "subj-3", alias: "Inativo", active: false }
    }
  };

  const dashboard = buildPlayerDashboardReadModel({ profileId: "prof-1", state });

  assert.equal(dashboard.hasProfile, true);
  assert.equal(dashboard.profileId, "prof-1");
  assert.equal(dashboard.profileName, "A Ordem de Vidro");
  assert.equal(dashboard.groupName, "Fações Nobres");
  assert.equal(dashboard.focal.name, "Grande Matriarca");
  assert.equal(dashboard.cards.length, 2);
  assert.equal(dashboard.showProfileLibrary, true);
  assert.equal(dashboard.profileGroups.length >= 1, true);
});

test("Player Read Models: buildSubjectDetailReadModel", () => {
  const state = {
    profiles: {
      "prof-1": {
        id: "prof-1",
        name: "A Ordem de Vidro",
        relationships: {
          "subj-1": { subjectId: "subj-1", score: 8.0, bond: true }
        }
      }
    },
    subjects: {
      "subj-1": {
        id: "subj-1",
        alias: "Vane",
        realName: "Lord Vane",
        description: "Comandante da guarda.",
        metadata: { tags: ["Nobre", "Guerreiro"] }
      }
    },
    history: [
      {
        id: "evt-1",
        type: "relationship",
        timestamp: Date.now(),
        profileId: "prof-1",
        subjectId: "subj-1",
        before: { score: 5.0, bond: false },
        after: { score: 8.0, bond: true },
        reason: "Missão bem sucedida"
      }
    ]
  };

  const detail = buildSubjectDetailReadModel({ profileId: "prof-1", subjectId: "subj-1", state });

  assert.equal(detail.found, true);
  assert.equal(detail.identity.alias, "Vane");
  assert.equal(detail.score.text, "8");
  assert.equal(detail.hasDescription, true);
  assert.equal(detail.description, "Comandante da guarda.");
  assert.equal(detail.hasTags, true);
  assert.deepEqual(detail.tags, ["Nobre", "Guerreiro"]);
  assert.equal(detail.hasHistory, true);
  assert.equal(detail.history[0].changes.length, 2);
});
