import assert from "node:assert/strict";
import { adjustPortraitFrame, getPortraitFitMode, normalizePortrait, portraitEquals, resetPortraitFrame } from "../scripts/core/portrait.js";
import { buildPortraitFrameModel, renderPortraitFrameHTML } from "../scripts/components/portrait-frame.js";
import { buildPortraitEditorContext } from "../scripts/components/portrait-editor.js";

for (const src of ["portraits/tall.png", "portraits/wide.gif", "https://example.test/npc.gif"]) {
  const portrait = { src, zoom: 100, x: 50, y: 50 };
  assert.equal(getPortraitFitMode(portrait), "contain", "default framing preserves the entire source and its proportions");
  for (const kind of ["subject", "focal"]) {
    const model = buildPortraitFrameModel(portrait, { kind });
    assert.equal(model.fit, "contain");
    assert.equal(buildPortraitEditorContext(portrait, { kind }).fit, model.fit);
    assert.ok(renderPortraitFrameHTML(model).includes(`src="${src}"`), "keep the original animated source");
  }
  const zoomed = { ...portrait, zoom: 160, x: 20, y: 30 };
  assert.equal(getPortraitFitMode(zoomed), "contain", "uniform zoom must not silently change the fitting mode");
  assert.equal(getPortraitFitMode(resetPortraitFrame(zoomed)), "contain", "reset restores the complete image");
  assert.equal(resetPortraitFrame(zoomed).src, src);
}

for (const zoom of [50, 99, 100, 101, 160, 300]) {
  assert.equal(getPortraitFitMode({ fit: "cover", zoom }), "cover");
  assert.equal(getPortraitFitMode({ fit: "contain", zoom }), "contain");
}
assert.equal(normalizePortrait({ fit: "fill" }).fit, "contain", "legacy stretching mode is replaced by a proportional mode");
assert.equal(normalizePortrait({ fit: "invalid" }).fit, "contain");
const filled = { src: "npc.gif", fit: "cover", zoom: 140, x: 25, y: 75 };
assert.equal(adjustPortraitFrame(filled, { x: 30 }).fit, "cover", "position changes preserve the selected fitting mode");
assert.equal(portraitEquals(filled, { ...filled, fit: "contain" }), false, "a fitting-only edit must be persisted");
assert.equal(resetPortraitFrame(filled).fit, "contain");

// Exercise storage, world normalization, dashboard mapping and reversible
// history rather than only testing the local preview selector.
const storage = new Map();
globalThis.game = { user: { id: "gm-fit", isGM: true }, settings: {
  register(ns, key, config) { if (!storage.has(key)) storage.set(key, structuredClone(config.default)); },
  get(ns, key) { return structuredClone(storage.get(key)); },
  async set(ns, key, value) { storage.set(key, structuredClone(value)); return value; }
} };
const { registerPersistenceSettings } = await import("../scripts/persistence/settings.js");
registerPersistenceSettings();
const Schema = await import("../scripts/data/schema.js");
const Store = await import("../scripts/persistence/world-store.js");
const Portraits = await import("../scripts/data/portrait-registry.js");
const Undo = await import("../scripts/data/undo-redo.js");
const { buildPlayerDashboardContext } = await import("../scripts/apps/player-dashboard.js");
const { describeHistoryEvent } = await import("../scripts/data/history-registry.js");
const state = Schema.createEmptyWorldState();
state.subjects.s1 = Schema.createSubject({ id: "s1", alias: "NPC", portrait: { src: "npc.gif" } });
state.profiles.p1 = Schema.createProfile({ id: "p1", name: "Perfil", subjectIds: ["s1"], relationships: { s1: { score: 4 } } });
storage.set("worldState", state);
let world = await Portraits.setSubjectPortrait("s1", { ...state.subjects.s1.portrait, fit: "cover" }, { profileId: "p1" });
assert.equal(Store.loadWorldState().subjects.s1.portrait.fit, "cover");
assert.equal(buildPlayerDashboardContext({ state: world, profileId: "p1" }).cards[0].portrait.fit, "cover");
assert.equal(world.history.at(-1).before.fit, "contain");
assert.equal(world.history.at(-1).after.fit, "cover");
assert(describeHistoryEvent(world.history.at(-1), { state: world }).changes.some(change => change.key === "portrait-fit"));
world = await Undo.undoLastTransaction();
assert.equal(world.subjects.s1.portrait.fit, "contain");
world = await Undo.redoLastTransaction();
assert.equal(world.subjects.s1.portrait.fit, "cover");
await Portraits.setFocalPortrait("p1", filled);
assert.equal(buildPlayerDashboardContext({ profileId: "p1" }).focal.portrait.fit, "cover");
console.log("portrait-fit: OK | proportional fitting, independent zoom, storage, Player mapping and undo/redo");
