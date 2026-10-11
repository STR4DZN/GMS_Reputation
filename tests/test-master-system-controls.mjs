import assert from "node:assert/strict";

class Element {
  constructor() { this.handlers = new Map(); this.nodes = new Map(); }
  querySelector(selector) { return this.nodes.get(selector); }
  querySelectorAll() { return []; }
  addEventListener(type, handler) { this.handlers.set(type, handler); }
  removeEventListener(type) { this.handlers.delete(type); }
  async click() { await this.handlers.get("click")?.({}); }
}
const storage = new Map(), messages = [];
let writes = 0, confirms = 0, answer = false, renders = 0;
globalThis.CONST = { USER_ROLES: { PLAYER: 1, ASSISTANT: 3, GAMEMASTER: 4 } };
globalThis.ui = { notifications: Object.fromEntries(["warn", "error", "info"].map(level => [level, message => messages.push([level, message])])) };
globalThis.foundry = { utils: { deepClone: structuredClone }, applications: { api: { DialogV2: {
  async confirm() { confirms++; return typeof answer === "function" ? answer() : answer; }
} } } };
const gm = { id: "gm", role: 4, isGM: true };
globalThis.game = { user: gm, users: [], settings: {
  register(_namespace, key, config) { storage.set(key, structuredClone(config.default)); },
  get(_namespace, key) { return structuredClone(storage.get(key)); },
  async set(_namespace, key, value) { writes++; storage.set(key, structuredClone(value)); return structuredClone(value); }
} };
const { registerPersistenceSettings } = await import("../scripts/persistence/settings.js");
registerPersistenceSettings();
const Schema = await import("../scripts/data/schema.js");
const Store = await import("../scripts/persistence/world-store.js");
const Undo = await import("../scripts/data/undo-redo.js");
const Reputation = await import("../scripts/data/reputation-registry.js");
const { wireMasterSystemControls } = await import("../scripts/apps/master/system-controls.js");
const { runMasterUndoRedo } = await import("../scripts/apps/master/history-controls.js");
const { wireMasterSaveControls } = await import("../scripts/apps/master/save-controls.js");
const { ReputationMasterPanelApplication } = await import("../scripts/apps/master-panel.js");
const state = Schema.createEmptyWorldState();
state.subjects.s1 = Schema.createSubject({ id: "s1", alias: "Teste" });
state.profiles.p1 = Schema.createProfile({ id: "p1", relationships: { s1: { score: 1 } } });
storage.set("worldState", state); storage.set("worldStateBackup", { ...structuredClone(state), revision: 2 });
const app = new ReputationMasterPanelApplication();
assert.equal(app._hasPendingChanges(), false);
for (const name of ["_fieldDrafts", "_focalPortraitDrafts", "_bindingDrafts"]) {
  app[name].set("draft", {}); assert.equal(app._hasPendingChanges(), true, name); app[name].clear();
}
app._saveController.queue("draft", async () => {});
assert.equal(app._hasPendingChanges(), true); app._saveController.discard();
const root = new Element(), button = new Element(); root.nodes.set("[data-master-restore-backup]", button);
let pending = false;
let control = wireMasterSystemControls(root, { hasPendingChanges: () => pending, render: async () => { renders++; } });
pending = true; await button.click(); assert.equal(confirms, 0); assert.equal(writes, 0);
pending = false; await button.click(); assert.equal(confirms, 1); assert.equal(writes, 0);
let resolve;
answer = () => new Promise(done => { resolve = done; });
let operation = button.click(); pending = true; resolve(true); await operation;
assert.equal(writes, 0, "A draft created during confirmation blocks rollback");
pending = false; operation = button.click(); control.destroy(); resolve(true); await operation;
assert.equal(writes, 0, "Disposing the surface revokes an open confirmation");
control = wireMasterSystemControls(root, { hasPendingChanges: () => pending, render: async () => { renders++; } });
operation = button.click(); game.user = { id: "player", role: 1, isGM: false }; resolve(true); await operation;
assert.equal(writes, 0); assert.match(messages.at(-1)[1], /Gamemaster completo/);
game.user = gm; answer = true; await button.click(); assert.equal(writes, 2); assert.equal(renders, 1);
assert.deepEqual(Store.loadWorldStateBackup(), state, "Rollback preserves the previous world as its backup");
control.destroy(); control.destroy(); assert.equal(button.handlers.size, 0);
await button.click(); assert.equal(writes, 2);

await Reputation.setReputationScore("p1", "s1", 2);
const target = Undo.buildUndoRedoState().undoTarget;
answer = () => new Promise(done => { resolve = done; });
let mutations = 0;
const runMutation = async action => { mutations++; return action(); };
operation = runMasterUndoRedo("undo", target, { hasPending: () => pending, runMutation });
pending = true; resolve(true); await operation; assert.equal(mutations, 0);
pending = false;
operation = runMasterUndoRedo("undo", target, { hasPending: () => false, runMutation });
await Reputation.setReputationScore("p1", "s1", 3);
const worldBefore = Store.loadWorldState(), backupBefore = Store.loadWorldStateBackup(), writesBefore = writes;
resolve(true); await assert.rejects(operation, /histórico mudou/);
assert.equal(writes, writesBefore); assert.deepEqual(Store.loadWorldState(), worldBefore); assert.deepEqual(Store.loadWorldStateBackup(), backupBefore);
await assert.rejects(Undo.redoLastTransaction({ expectedTransactionId: target.transactionId }), /histórico mudou/);
answer = true;
await Undo.undoLastTransaction({ expectedTransactionId: Undo.buildUndoRedoState().undoTarget.transactionId });
assert.equal(Store.loadWorldState().profiles.p1.relationships.s1.score, 2);
const discardButton = new Element(), discardRoot = new Element();
discardRoot.nodes.set("[data-master-discard-pending]", discardButton);
let discards = 0;
answer = () => new Promise(done => { resolve = done; });
const discardControl = wireMasterSaveControls(discardRoot, {
  saveController: { hasPending: true, discard() { discards++; } },
  updateStatus() {}, onDiscard() { discards++; }, render() { assert.fail("Disposed confirmation must not reopen the panel"); }
});
operation = discardButton.click(); discardControl.destroy(); resolve(true); await operation;
assert.equal(discards, 0);
await app._onClose({});
console.log("master-system-controls: OK | all draft types, cancel, disposal, revoked permissions, rollback backup and stale undo/redo confirmation");
