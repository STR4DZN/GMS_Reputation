import assert from "node:assert/strict";

class Element {
  constructor(dataset = {}) { this.dataset = dataset; this.handlers = new Map(); this.nodes = new Map(); this.lists = new Map(); this.checked = false; this.value = ""; }
  addEventListener(type, handler) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(handler); }
  removeEventListener(type, handler) { this.handlers.get(type)?.delete(handler); }
  querySelector(selector) { return this.nodes.get(selector) ?? null; }
  querySelectorAll(selector) { return this.lists.get(selector) ?? []; }
  async emit(type) { for (const handler of [...(this.handlers.get(type) ?? [])]) await handler({}); }
  count() { return [...this.handlers.values()].reduce((total, set) => total + set.size, 0); }
}

const storage = new Map();
let writes = 0, confirmResult = false, confirmation = null;
globalThis.CONST = { USER_ROLES: { PLAYER: 1, ASSISTANT: 3, GAMEMASTER: 4 } };
globalThis.foundry = { utils: { deepClone: structuredClone }, applications: { api: { DialogV2: {
  async confirm(options) { confirmation = options; return typeof confirmResult === "function" ? confirmResult() : confirmResult; }
} } } };
globalThis.game = { user: { id: "gm", role: 4, isGM: true }, users: [], settings: {
  register(_namespace, key, config) { if (!storage.has(key)) storage.set(key, structuredClone(config.default)); },
  get(_namespace, key) { return structuredClone(storage.get(key)); },
  async set(_namespace, key, value) { writes++; storage.set(key, structuredClone(value)); return structuredClone(value); }
} };
const { registerPersistenceSettings } = await import("../scripts/persistence/settings.js");
registerPersistenceSettings();
const { createEmptyWorldState, createProfile, createSubject } = await import("../scripts/data/schema.js");
const Store = await import("../scripts/persistence/world-store.js");
const { wireMasterCleanupControls } = await import("../scripts/apps/master/cleanup-controls.js");
const { wireMasterRegistryControls } = await import("../scripts/apps/master/registry-controls.js");
const { wireMasterBulkControls } = await import("../scripts/apps/master/bulk-controls.js");
const { confirmMasterAction } = await import("../scripts/apps/master/confirmation.js");
const world = createEmptyWorldState();
world.subjects.s1 = createSubject({ id: "s1", alias: "Órbita <A & B>" });
world.subjects.s2 = createSubject({ id: "s2", alias: "Sentinela" });
world.profiles.p1 = createProfile({ id: "p1", name: "Matriz", subjectIds: ["s1", "s2"], relationships: { s1: { score: 1 }, s2: { score: 2 } } });
storage.set("worldState", structuredClone(world));

function surface() {
  const root = new Element(), cleanup = new Element();
  const unlock = new Element(), search = new Element();
  const button = new Element({ masterCleanupDelete: "subject", cleanupId: "s1", cleanupName: "Órbita <A & B>", cleanupImpactA: "1", cleanupImpactB: "1" });
  const rows = [new Element({ cleanupSearchText: "Órbita" }), new Element({ cleanupSearchText: "Sentinela" })];
  const section = new Element(); section.lists.set("[data-master-cleanup-row]", rows);
  root.nodes.set("[data-master-cleanup-root]", cleanup);
  cleanup.nodes.set("[data-master-cleanup-unlock]", unlock); cleanup.nodes.set("[data-master-cleanup-search]", search);
  cleanup.lists.set("[data-master-cleanup-delete]", [button]); cleanup.lists.set("[data-master-cleanup-row]", rows);
  cleanup.lists.set("[data-master-cleanup-section]", [section]);
  return { root, cleanup, unlock, search, button, rows, section };
}
const view = surface(); const failures = [];
const controller = wireMasterCleanupControls(view.root, { isFullGM: true,
  async runMutation(action) { try { return await action(); } catch (error) { failures.push(error.message); } }
});
assert.equal(view.button.disabled, true);
await view.button.emit("click"); assert.equal(confirmation, null); assert.equal(writes, 0);
view.search.value = "ORBITA"; await view.search.emit("input");
assert.equal(view.rows[0].hidden, false); assert.equal(view.rows[1].hidden, true);
view.search.value = "ausente"; await view.search.emit("input");
assert.equal(view.section.dataset.hasVisibleRows, "false"); assert.equal(writes, 0);
view.unlock.checked = true; await view.unlock.emit("change"); assert.equal(view.button.disabled, false);
await view.button.emit("click"); assert.equal(writes, 0, "Cancel never writes or replaces the backup");
assert.ok(confirmation.content.includes("&lt;A &amp; B&gt;"));
assert.ok(!confirmation.content.includes("<A & B>")); assert.equal(confirmation.rejectClose, false);
assert.equal(confirmation.yes.label, "Apagar permanentemente");

// Permission may be revoked while the asynchronous confirmation is open.
let resolveConfirmation;
confirmResult = () => new Promise(resolve => { resolveConfirmation = resolve; });
const pending = view.button.emit("click");
game.user = { id: "player", role: 1, isGM: false };
resolveConfirmation(true); await pending;
assert.match(failures.at(-1), /Gamemaster completo/);
assert.equal(writes, 0); assert.deepEqual(Store.loadWorldState(), world);
game.user = { id: "gm", role: 4, isGM: true }; confirmResult = true;
await view.button.emit("click");
const result = Store.loadWorldState();
assert.equal(result.subjects.s1, undefined); assert.ok(result.subjects.s2);
assert.equal(result.profiles.p1.relationships.s1, undefined); assert.equal(result.profiles.p1.subjectIds.includes("s1"), false);
assert.ok(Store.loadWorldStateBackup().subjects.s1);
assert.equal(result.revision, world.revision + 1);
controller.destroy(); controller.destroy();
assert.equal(view.unlock.count() + view.search.count() + view.button.count(), 0);
const previous = writes; await view.button.emit("click"); assert.equal(writes, previous);
const readonly = surface();
assert.equal(wireMasterCleanupControls(readonly.root, { isFullGM: false, runMutation: () => assert.fail() }), null);
assert.equal(readonly.unlock.count() + readonly.button.count(), 0);
assert.equal(wireMasterCleanupControls(new Element(), { isFullGM: true }), null);
game.user = { id: "player", role: 1, isGM: false };
assert.equal(wireMasterRegistryControls(readonly.root, {}), null);
assert.equal(wireMasterBulkControls(readonly.root, {}), null);

// Browser fallback retains cancel semantics when DialogV2 is unavailable.
delete foundry.applications.api.DialogV2;
let prompt = ""; globalThis.confirm = message => { prompt = message; return false; };
assert.equal(await confirmMasterAction({ title: "Teste", message: "Confirmar?" }), false);
assert.equal(prompt, "Confirmar?");
console.log("master-controls: OK | locked/canceled cleanup, escaped confirmation, permission revoked during dialog, backup/references, idempotent disposal and read-only gates");
