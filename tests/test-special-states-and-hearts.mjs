import assert from "node:assert/strict";

const storage = new Map();
globalThis.game = {
  user: { id: "gm-special", isGM: true },
  settings: {
    register(namespace, key, data) {
      const fullKey = `${namespace}.${key}`;
      if (!storage.has(fullKey)) storage.set(fullKey, structuredClone(data.default));
    },
    get(namespace, key) { return structuredClone(storage.get(`${namespace}.${key}`)); },
    async set(namespace, key, value) {
      storage.set(`${namespace}.${key}`, structuredClone(value));
      return structuredClone(value);
    }
  }
};
globalThis.foundry = { utils: { deepClone: structuredClone } };

const { registerPersistenceSettings } = await import("../scripts/persistence/settings.js");
const { createEmptyWorldState, createProfile, createRelationship, createSubject } = await import("../scripts/data/schema.js");
const Reputation = await import("../scripts/data/reputation-registry.js");
const Engine = await import("../scripts/core/reputation-engine.js");
const Communion = await import("../scripts/core/communion.js");
const DualSync = await import("../scripts/core/dual-sync.js");
const Special = await import("../scripts/core/special-presentation.js");
const Hearts = await import("../scripts/components/heart-track.js");

registerPersistenceSettings();
const state = createEmptyWorldState({ createdBy: game.user.id });
state.subjects.s1 = createSubject({ id: "s1", realName: "Teste Especial", alias: "Especial" });
state.profiles.p1 = createProfile({
  id: "p1",
  name: "Perfil",
  relationships: { s1: createRelationship("s1", { score: 6 }) }
});
await game.settings.set("gms-reputation", "worldState", state);

// Block 10 — Communion is a single persisted boolean and grants no hidden score.
let world = await Reputation.setCommunion("p1", "s1", true);
let stored = world.profiles.p1.relationships.s1;
assert.equal(stored.communion, true);
assert.equal(stored.bond, false);
assert.equal(stored.score, 6, "Comunhão must not grant score automatically");
assert.equal(Object.hasOwn(stored, "communionState"), false);

let view = Reputation.getReputation("p1", "s1");
assert.equal(view.scoreLimit, 12);
assert.equal(view.special.state, "communion");
assert.equal(view.special.communion.active, true);
assert.equal(view.special.communion.label, "COMUNHÃO");
assert.equal(view.special.presentation.state, "communion");
assert.equal(view.special.communion.sigilAsset, "modules/gms-reputation/assets/icons/communion-sigil.svg");
assert.equal(view.hearts.slots.length, 12);
assert.equal(view.hearts.slots[10].accent, Communion.COMMUNION_PRESENTATION.heartAccent);
assert.equal(view.hearts.slots[10].secondaryAccent, Communion.COMMUNION_PRESENTATION.heartSecondary);

// Scores above 10 are legal while Communion is active, then clamp when it is the last expander removed.
world = await Reputation.setReputationScore("p1", "s1", 11.5);
assert.equal(world.profiles.p1.relationships.s1.score, 11.5);
world = await Reputation.setCommunion("p1", "s1", false);
assert.equal(world.profiles.p1.relationships.s1.score, 10);
assert.equal(world.profiles.p1.relationships.s1.communion, false);

// Block 11 — DUAL//SYNC is derived from Communion + Bond and never stored independently.
world = await Reputation.updateRelationship("p1", "s1", { score: 7.5, communion: true, bond: true });
stored = world.profiles.p1.relationships.s1;
assert.equal(stored.communion, true);
assert.equal(stored.bond, true);
assert.equal(Object.hasOwn(stored, "dualSync"), false);
assert.equal(Object.hasOwn(stored, "specialState"), false);

view = Engine.getReputationView(stored);
assert.equal(view.special.state, "dual-sync");
assert.equal(view.special.dualSync.active, true);
assert.equal(view.special.dualSync.label, "DUPLO//SINC");
assert.equal(view.special.presentation.state, "dual-sync");
assert.equal(view.special.presentation.sigilAsset, "modules/gms-reputation/assets/icons/dual-sync-sigil.svg");
assert.equal(DualSync.getDualSyncState({ communion: true, bond: false }).active, false);
assert.equal(DualSync.getDualSyncState({ communion: false, bond: true }).active, false);
assert.equal(DualSync.getDualSyncState({ communion: true, bond: true }).active, true);
assert.equal(Special.getSpecialPresentation({ communion: true, bond: true }).label, "DUPLO//SINC");

// Attempt to forge a third state is ignored by the canonical mutator.
world = await Reputation.updateRelationship("p1", "s1", { dualSync: false, specialState: "standard" });
stored = world.profiles.p1.relationships.s1;
assert.equal(stored.communion, true);
assert.equal(stored.bond, true);
assert.equal(Object.hasOwn(stored, "dualSync"), false);
assert.equal(Object.hasOwn(stored, "specialState"), false);
assert.equal(Engine.getReputationView(stored).special.state, "dual-sync");

// Dual special slots use cyan/magenta with white secondary accent.
view = Engine.getReputationView(stored);
assert.equal(view.hearts.slots[10].specialKind, "dual-sync");
assert.equal(view.hearts.slots[10].accent, "#27F3FF");
assert.equal(view.hearts.slots[10].secondaryAccent, "#F0EAE0");
assert.equal(view.hearts.slots[11].accent, "#FF2BD6");
assert.equal(view.hearts.slots[11].secondaryAccent, "#F0EAE0");

// Block 12 — one canonical heart component covers 10/12, full/half/empty and responsive structural HTML.
let model = Hearts.buildHeartTrackModel({ score: 4.5 });
assert.equal(model.limit, 10);
assert.equal(model.slots.length, 10);
assert.equal(model.slots.filter((slot) => slot.state === "full").length, 4);
assert.equal(model.slots.filter((slot) => slot.state === "half").length, 1);
assert.equal(model.slots.filter((slot) => slot.state === "empty").length, 5);
assert.ok(model.slots.every((slot) => slot.specialSlot === false));

let html = Hearts.renderHeartTrackHTML(model);
assert.match(html, /gms-reputation-heart-track--10/);
assert.match(html, /data-heart-limit="10"/);
assert.equal((html.match(/class="gms-reputation-heart/g) ?? []).length, 11); // root + 10 slots
assert.doesNotMatch(html, /style=/i, "heart component HTML must not repeat inline CSS");
assert.doesNotMatch(html, />XI<|>XII</i, "special positions must not render XI/XII labels");
assert.doesNotMatch(html, /progress|meter|bar/i, "heart component must not add redundant progress bars");

model = Hearts.buildHeartTrackModel({ score: 10.5, communion: true });
assert.equal(model.limit, 12);
assert.equal(model.slots[10].state, "half");
assert.equal(model.slots[11].state, "empty");
assert.equal(model.slots[10].specialSlot, true);
assert.equal(model.slots[11].specialSlot, true);
html = Hearts.renderHeartTrackHTML(model, { className: "player-card-hearts" });
assert.match(html, /gms-reputation-heart-track--12/);
assert.match(html, /player-card-hearts/);
assert.equal((html.match(/data-heart-state=/g) ?? []).length, 12);

// Engine compatibility alias must be the exact same canonical model behavior.
assert.deepEqual(Engine.buildHeartTrack({ score: 5.5, bond: true }), Hearts.buildHeartTrackModel({ score: 5.5, bond: true }));

console.log("special-states-and-hearts: OK");
