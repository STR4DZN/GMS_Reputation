import assert from "node:assert/strict";

const storage = new Map();
const registrations = new Map();
globalThis.game = {
  user: { id: "gm-reputation", isGM: true },
  settings: {
    register(namespace, key, data) {
      registrations.set(`${namespace}.${key}`, data);
      if (!storage.has(`${namespace}.${key}`)) storage.set(`${namespace}.${key}`, structuredClone(data.default));
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
const Store = await import("../scripts/persistence/world-store.js");
const Reputation = await import("../scripts/data/reputation-registry.js");
const Engine = await import("../scripts/core/reputation-engine.js");
const Bands = await import("../scripts/core/semantic-bands.js");
const Bond = await import("../scripts/core/bond.js");

registerPersistenceSettings();

const state = createEmptyWorldState({ createdBy: game.user.id });
state.subjects.s1 = createSubject({ id: "s1", realName: "Teste", alias: "Teste" });
state.profiles.p1 = createProfile({
  id: "p1",
  name: "Perfil",
  relationships: { s1: createRelationship("s1", { score: 0 }) }
});
await game.settings.set("gms-reputation", "worldState", state);

// Block 08: every legal half-step from -10 to +12 maps to exactly one semantic band.
for (let score = -10; score <= 12; score += 0.5) {
  const special = score > 10 ? { bond: true } : {};
  const band = Bands.getSemanticBand(score, special);
  assert.ok(band.id);
  assert.ok(/^#[0-9A-F]{6}$/i.test(band.accent));
}
assert.equal(Bands.getSemanticBand(-10).id, Bands.RELATION_BAND.HOSTILE);
assert.equal(Bands.getSemanticBand(-7).id, Bands.RELATION_BAND.HOSTILE);
assert.equal(Bands.getSemanticBand(-6.5).id, Bands.RELATION_BAND.CAUTION);
assert.equal(Bands.getSemanticBand(-0.5).id, Bands.RELATION_BAND.CAUTION);
assert.equal(Bands.getSemanticBand(0).id, Bands.RELATION_BAND.NEUTRAL);
assert.equal(Bands.getSemanticBand(0.5).id, Bands.RELATION_BAND.CONTACT);
assert.equal(Bands.getSemanticBand(3).id, Bands.RELATION_BAND.CONTACT);
assert.equal(Bands.getSemanticBand(3.5).id, Bands.RELATION_BAND.TRUSTED);
assert.equal(Bands.getSemanticBand(6).id, Bands.RELATION_BAND.TRUSTED);
assert.equal(Bands.getSemanticBand(6.5).id, Bands.RELATION_BAND.ALLY);
assert.equal(Bands.getSemanticBand(9).id, Bands.RELATION_BAND.ALLY);
assert.equal(Bands.getSemanticBand(9.5).id, Bands.RELATION_BAND.EXTREME);
assert.equal(Bands.getSemanticBand(12, { bond: true }).id, Bands.RELATION_BAND.EXTREME);
assert.equal(Bands.getSemanticBand(-1).accent, "#FFB51B", "moderate negative must be amber");
assert.equal(Bands.getSemanticBand(-8).accent, "#FF304F", "high hostility must be red");
assert.equal(Bands.getSemanticBand(0).accent, "#9AA8B3", "neutral must be steel");

// Block 07: hearts and semantic presentation derive from the same source.
let view = Engine.getReputationView({ score: 5.5 });
assert.equal(view.score, 5.5);
assert.equal(view.scoreLimit, 10);
assert.equal(view.band.id, Bands.RELATION_BAND.TRUSTED);
assert.equal(view.hearts.slots.length, 10);
assert.equal(view.hearts.fullCount, 5);
assert.equal(view.hearts.hasHalf, true);
assert.equal(view.hearts.slots[5].state, "half");
assert.ok(view.hearts.slots.slice(0, 10).every((slot) => slot.accent === view.band.accent));

view = Engine.getReputationView({ score: -7.5 });
assert.equal(view.polarity, "negative");
assert.equal(view.hearts.fullCount, 7);
assert.equal(view.hearts.hasHalf, true);
assert.equal(view.band.id, Bands.RELATION_BAND.HOSTILE);

// Invalid/out-of-range storage never escapes normalized.
assert.equal(Engine.getReputationView({ score: 999 }).score, 10);
assert.equal(Engine.getReputationView({ score: -999 }).score, -10);
assert.equal(Engine.getReputationView({ score: 7.24 }).score, 7);
assert.equal(Engine.getReputationView({ score: 7.26 }).score, 7.5);

// Block 09: bond is an explicit boolean; activating it does not grant score.
let world = await Reputation.setReputationScore("p1", "s1", 6);
assert.equal(world.profiles.p1.relationships.s1.score, 6);
world = await Reputation.setBond("p1", "s1", true);
assert.equal(world.profiles.p1.relationships.s1.bond, true);
assert.equal(world.profiles.p1.relationships.s1.score, 6, "enabling bond must not add score");
assert.equal(world.profiles.p1.relationships.s1.revision, 2);

view = Reputation.getReputation("p1", "s1");
const revisionBeforeNoop = Store.loadWorldState().revision;
const relationshipRevisionBeforeNoop = view.relationship.revision;
world = await Reputation.setBond("p1", "s1", true);
assert.equal(world.revision, revisionBeforeNoop, "no-op domain write must not increment world revision");
assert.equal(world.profiles.p1.relationships.s1.revision, relationshipRevisionBeforeNoop, "no-op must not increment relationship revision");
view = Reputation.getReputation("p1", "s1");
assert.equal(view.scoreLimit, 12);
assert.equal(view.special.state, "bond");
assert.equal(view.special.bond.active, true);
assert.equal(view.special.bond.label, "VÍNCULO");
assert.equal(view.special.bond.compactLabel, "VÍNCULO");
assert.equal(view.hearts.slots.length, 12);
assert.equal(view.hearts.slots[10].specialSlot, true);
assert.equal(view.hearts.slots[11].specialSlot, true);
assert.equal(view.hearts.slots[10].accent, Bond.BOND_PRESENTATION.heartAccent);
assert.equal(view.hearts.slots[11].accent, Bond.BOND_PRESENTATION.heartAccent);

// Expanded score works only while an expanding state exists.
world = await Reputation.setReputationScore("p1", "s1", 11.5);
assert.equal(world.profiles.p1.relationships.s1.score, 11.5);
world = await Reputation.setBond("p1", "s1", false);
assert.equal(world.profiles.p1.relationships.s1.score, 10, "removing last expanded state must restore base invariant");
assert.equal(world.profiles.p1.relationships.s1.bond, false);

// Communion can keep the expanded invariant alive.
world = await Reputation.updateRelationship("p1", "s1", { communion: true, bond: true, score: 11.5 });
world = await Reputation.setBond("p1", "s1", false);
assert.equal(world.profiles.p1.relationships.s1.communion, true);
assert.equal(world.profiles.p1.relationships.s1.score, 11.5, "other expanding state must preserve expanded score");

// Derived-looking fields in a patch are ignored and never persisted.
world = await Reputation.updateRelationship("p1", "s1", {
  score: 4,
  specialState: "forged",
  scoreLimit: 999,
  hearts: ["forged"],
  color: "#000000"
});
const stored = world.profiles.p1.relationships.s1;
assert.equal(stored.score, 4);
assert.equal(Object.hasOwn(stored, "specialState"), false);
assert.equal(Object.hasOwn(stored, "scoreLimit"), false);
assert.equal(Object.hasOwn(stored, "hearts"), false);
assert.equal(Object.hasOwn(stored, "color"), false);

await assert.rejects(() => Reputation.setReputationScore("p1", "s1", "not-a-number"), TypeError);
await assert.rejects(() => Reputation.adjustReputationScore("p1", "s1", Number.NaN), TypeError);

console.log("reputation-engine: OK");
