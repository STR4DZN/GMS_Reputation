import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const storage = new Map();
const registrations = new Map();
globalThis.game = {
  user: { id: "gm-33", isGM: true, name: "GM 33" },
  users: new Map([["gm-33", { id: "gm-33", name: "GM 33" }]]),
  settings: {
    register(namespace, key, config) {
      const id = `${namespace}.${key}`;
      registrations.set(id, config);
      if (!storage.has(id)) storage.set(id, structuredClone(config.default));
    },
    get(namespace, key) { return structuredClone(storage.get(`${namespace}.${key}`)); },
    async set(namespace, key, value) { storage.set(`${namespace}.${key}`, structuredClone(value)); return structuredClone(value); }
  }
};
let randomCounter = 0;
globalThis.foundry = { utils: {
  deepClone: structuredClone,
  randomID(length = 16) { randomCounter += 1; return (`u${randomCounter}`.padEnd(length, "x")).slice(0, length); }
}};

const { MASTER_SAVE_MODE, MODULE_ID, SETTINGS } = await import("../scripts/constants.js");
const Schema = await import("../scripts/data/schema.js");
const { registerPersistenceSettings } = await import("../scripts/persistence/settings.js");
const Store = await import("../scripts/persistence/world-store.js");
const Reputation = await import("../scripts/data/reputation-registry.js");
const Bulk = await import("../scripts/data/bulk-operations.js");
const UndoRedo = await import("../scripts/data/undo-redo.js");
const MasterPrefs = await import("../scripts/persistence/master-preferences.js");
const { MasterSaveController, SAVE_STATUS } = await import("../scripts/apps/master/save-controller.js");
const Master = await import("../scripts/apps/master-panel.js");
registerPersistenceSettings();

assert.equal(registrations.get(`${MODULE_ID}.${SETTINGS.MASTER_SAVE_MODE}`).scope, "user");
assert.equal(registrations.get(`${MODULE_ID}.${SETTINGS.MASTER_AUTOSAVE_DELAY}`).scope, "user");
assert.equal(MasterPrefs.getMasterSaveMode(), MASTER_SAVE_MODE.MANUAL);
assert.equal(await MasterPrefs.setMasterSaveMode(MASTER_SAVE_MODE.MANUAL), MASTER_SAVE_MODE.MANUAL);
assert.equal(await MasterPrefs.setMasterAutoSaveDelay(1.37), 1.25);

const state = Schema.createEmptyWorldState({ createdBy: "gm-33" });
state.subjects.s1 = Schema.createSubject({ id: "s1", realName: "Um", alias: "A", sortOrder: 10 });
state.subjects.s2 = Schema.createSubject({ id: "s2", realName: "Dois", alias: "B", sortOrder: 20 });
state.profiles.p1 = Schema.createProfile({ id: "p1", name: "Perfil", relationships: { s1: { score: 2 }, s2: { score: -1 } } });
storage.set(`${MODULE_ID}.${SETTINGS.WORLD_STATE}`, structuredClone(state));
storage.set(`${MODULE_ID}.${SETTINGS.WORLD_STATE_BACKUP}`, {});

// BLOCO 31 — one bulk transaction must undo/redo as one logical action.
let world = await Bulk.applyBulkRelationshipChanges("p1", ["s1", "s2"], { scoreMode: "delta", scoreValue: 1, bond: "on", communion: "keep" }, { reason: "bulk" });
const changedScores = [world.profiles.p1.relationships.s1.score, world.profiles.p1.relationships.s2.score];
const originalTx = world.history.at(-1).transactionId;
assert.equal(world.history.filter((event) => event.transactionId === originalTx).length, 2);
let stack = UndoRedo.buildUndoRedoState(world);
assert.equal(stack.canUndo, true);
assert.equal(stack.undoTarget.transactionId, originalTx);
assert.equal(stack.undoTarget.eventCount, 2);

const revisionBeforeUndo = world.revision;
world = await UndoRedo.undoLastTransaction({ reason: "corrigir" });
assert.equal(world.revision, revisionBeforeUndo + 1, "undo is one world transaction");
assert.equal(world.profiles.p1.relationships.s1.score, 2);
assert.equal(world.profiles.p1.relationships.s2.score, -1);
assert.equal(world.profiles.p1.relationships.s1.bond, false);
assert.equal(world.history.at(-1).type, "undo");
assert.equal(world.history.at(-1).after.targetTransactionId, originalTx);
stack = UndoRedo.buildUndoRedoState(world);
assert.equal(stack.canRedo, true);
assert.equal(stack.redoTarget.transactionId, originalTx);

const revisionBeforeRedo = world.revision;
world = await UndoRedo.redoLastTransaction();
assert.equal(world.revision, revisionBeforeRedo + 1);
assert.deepEqual([world.profiles.p1.relationships.s1.score, world.profiles.p1.relationships.s2.score], changedScores);
assert.equal(world.profiles.p1.relationships.s1.bond, true);
assert.equal(world.history.at(-1).type, "redo");

// A new edit after Undo invalidates Redo, matching normal editor semantics.
world = await UndoRedo.undoLastTransaction();
assert.equal(UndoRedo.buildUndoRedoState(world).canRedo, true);
world = await Reputation.setReputationScore("p1", "s1", 7, { reason: "nova linha temporal" });
stack = UndoRedo.buildUndoRedoState(world);
assert.equal(stack.canRedo, false, "new edit after undo must clear redo stack");
assert.equal(stack.canUndo, true);

// Undo works for subject-global bulk events too.
world = await Bulk.bulkArchiveSubjects(["s1", "s2"], true, { reason: "archive" });
assert.equal(world.subjects.s1.archived, true);
world = await UndoRedo.undoLastTransaction();
assert.equal(world.subjects.s1.archived, false);
assert.equal(world.subjects.s2.archived, false);

// BLOCKS 32–33 — manual buffer coalesces repeated edits by key.
const statuses = [];
let writes = 0;
const manual = new MasterSaveController({ mode: MASTER_SAVE_MODE.MANUAL, onStatus: (status) => statuses.push(status.status) });
manual.queue("portrait", async () => { writes += 100; });
manual.queue("portrait", async () => { writes += 1; });
assert.equal(manual.pendingCount, 1);
assert.equal(manual.status, SAVE_STATUS.DIRTY);
assert.equal(writes, 0);
await manual.flush();
assert.equal(writes, 1, "only latest coalesced action should run");
assert.equal(manual.status, SAVE_STATUS.SYNCED);
assert.ok(statuses.includes(SAVE_STATUS.SAVING));

// Automatic mode debounces rapid repeated edits instead of saving every input event.
writes = 0;
const automatic = new MasterSaveController({ mode: MASTER_SAVE_MODE.AUTOMATIC, automaticDelay: 100 });
for (let index = 0; index < 20; index += 1) automatic.queue("slider", async () => { writes += 1; });
await new Promise((resolve) => setTimeout(resolve, 150));
assert.equal(writes, 1, "rapid slider/input updates must collapse to one automatic save");
assert.equal(automatic.status, SAVE_STATUS.SYNCED);

// Error keeps pending work recoverable.
const failing = new MasterSaveController({ mode: MASTER_SAVE_MODE.MANUAL });
failing.queue("x", async () => { throw new Error("save failed"); });
await assert.rejects(() => failing.flush(), /save failed/);
assert.equal(failing.status, SAVE_STATUS.ERROR);
assert.equal(failing.hasPending, true);
failing.discard();
assert.equal(failing.status, SAVE_STATUS.SYNCED);

// A post-save UI callback failure must never requeue already-persisted writes.
writes = 0;
const postSaveFailure = new MasterSaveController({
  mode: MASTER_SAVE_MODE.MANUAL,
  onCommitted: async () => { throw new Error("render failed"); }
});
postSaveFailure.queue("x", async () => { writes += 1; });
const originalConsoleWarn = console.warn;
console.warn = () => {};
try {
  await postSaveFailure.flush();
} finally {
  console.warn = originalConsoleWarn;
}
assert.equal(writes, 1);
assert.equal(postSaveFailure.hasPending, false);
assert.equal(postSaveFailure.status, SAVE_STATUS.SYNCED);

// Context/template expose controls and current history state.
await MasterPrefs.setMasterSaveMode(MASTER_SAVE_MODE.IDLE);
await MasterPrefs.setMasterAutoSaveDelay(2.5);
world = Store.loadWorldState();
const context = Master.buildMasterPanelContext({ profileId: "p1", subjectId: "s1", state: world });
assert.equal(context.savePreferences.mode, MASTER_SAVE_MODE.IDLE);
assert.equal(context.savePreferences.idleDelay, 2.5);
assert.equal(context.savePreferences.modeOptions.length, 3);
assert.equal(typeof context.undoRedo.canUndo, "boolean");

const template = await readFile(new URL("../templates/apps/master-panel.hbs", import.meta.url), "utf8");
assert.match(template, /data-master-undo/);
assert.match(template, /data-master-redo/);
assert.match(template, /data-master-save-state/);
assert.match(template, /data-master-save-now/);
assert.match(template, /data-master-save-mode/);
assert.match(template, /data-master-autosave-delay/);



// 59.7: clicking the visible Save button must capture live relationship controls
// even when no prior input/change event was dispatched.
await MasterPrefs.setMasterSaveMode(MASTER_SAVE_MODE.MANUAL);
class FakeNode {
  constructor({value="",checked=false}={}) { this.value=value; this.checked=checked; this.disabled=false; this.dataset={}; this.listeners=new Map(); this.textContent=""; }
  addEventListener(type,fn){ const list=this.listeners.get(type)??[]; list.push(fn); this.listeners.set(type,list); }
  removeEventListener(type,fn){ const list=this.listeners.get(type)??[]; this.listeners.set(type,list.filter((x)=>x!==fn)); }
  async emit(type){ for(const fn of this.listeners.get(type)??[]) await fn({preventDefault(){},stopPropagation(){},target:this}); }
}
const scoreNode=new FakeNode({value:"-3.5"});
const bondNode=new FakeNode({checked:false});
const communionNode=new FakeNode({checked:false});
const saveNode=new FakeNode();
const discardNode=new FakeNode();
const barNode=new FakeNode();
const labelNode=new FakeNode();
const countNode=new FakeNode();
const fakeMap=new Map([
  ["[data-master-score-input]",scoreNode], ["[data-master-bond]",bondNode], ["[data-master-communion]",communionNode],
  ["[data-master-save-now]",saveNode], ["[data-master-discard-pending]",discardNode], ["[data-master-save-state]",barNode],
  ["[data-master-save-label]",labelNode], ["[data-master-save-pending-count]",countNode]
]);
const fakeRoot={dataset:{},querySelector(selector){return fakeMap.get(selector)??null;},querySelectorAll(){return [];}};
const saveApp=new Master.ReputationMasterPanelApplication({profileId:"p1",subjectId:"s1",activeSection:"relationship"});
saveApp._wireSaveControls(fakeRoot,{undoRedo:{undoTarget:null,redoTarget:null}});
assert.equal(saveNode.disabled,false,"explicit save must be available for an editable relationship");
await saveNode.emit("click");
const savedWorld=Store.loadWorldState();
assert.equal(savedWorld.profiles.p1.relationships.s1.score,-3.5,"save click must capture live controls");
assert.equal(saveApp._saveController.hasPending,false);
saveApp._saveController.destroy();
console.log("explicit-save-click: OK");

console.log("undo-save-autosave: OK");
