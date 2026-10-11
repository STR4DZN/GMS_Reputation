import assert from "node:assert/strict";
import { createEmptyWorldState, createProfile, createSubject } from "../scripts/data/schema.js";
import { wireMasterPlayerBindings } from "../scripts/apps/master/player-bindings.js";

class Element {
  constructor(dataset = {}) { this.dataset = dataset; this.handlers = new Map(); this.attributes = new Map(); this.isConnected = true; this.value = ""; }
  addEventListener(type, handler) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(handler); }
  removeEventListener(type, handler) { this.handlers.get(type)?.delete(handler); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  async emit(type, event = {}) { for (const handler of [...(this.handlers.get(type) ?? [])]) await handler(event); }
  click() { return this.emit("click"); }
  focus() { this.focused = true; }
  listenerCount() { return [...this.handlers.values()].reduce((total, handlers) => total + handlers.size, 0); }
}

const world = createEmptyWorldState();
world.subjects.s1 = createSubject({ id: "s1", alias: "Corvo" });
world.subjects.s2 = createSubject({ id: "s2", alias: "Fio" });
world.profiles.p1 = createProfile({ id: "p1", name: "Corvo" });
world.profiles.p2 = createProfile({ id: "p2", name: "Fio" });
const originalWorld = structuredClone(world);
const messages = [];
let pauseUpdate = null;
let failUpdate = false;
let updates = 0;
function user(id) {
  return { id, flags: { "gms-reputation": { personalReputationBinding: { profileId: "p1", subjectId: "s1" } } },
    async update(changes) {
      updates++;
      if (pauseUpdate) await pauseUpdate;
      if (failUpdate) throw new Error("Offline");
      for (const [key, value] of Object.entries(changes)) this.flags["gms-reputation"][key.split(".")[2]] = structuredClone(value);
    }
  };
}
const users = [user("mari"), user("joao")];
globalThis.CONST = { USER_ROLES: { GAMEMASTER: 4, ASSISTANT: 3 } };
globalThis.game = { user: { id: "gm", isGM: true, role: 4 }, users,
  settings: { get(_namespace, key) { return key === "worldState" ? structuredClone(world) : undefined; },
    set() { throw new Error("Player bindings must not write world settings"); } }
};
globalThis.ui = { notifications: { info: message => messages.push(message), error: message => messages.push(message) } };

function surface() {
  const general = new Element({ masterSettingsTab: "general" });
  const players = new Element({ masterSettingsTab: "players" });
  const tabs = new Element(); tabs.querySelectorAll = () => [general, players];
  const panes = [new Element({ masterSettingsPane: "general" }), new Element({ masterSettingsPane: "players" })];
  const rows = users.map(user => {
    const row = new Element({ playerBindingUser: user.id });
    const profile = new Element(); profile.value = "p1"; profile.selectedOptions = [{ dataset: { profileSubject: "s1" } }];
    const subject = new Element(); subject.value = "s1";
    const button = new Element(); const hint = new Element();
    const fields = { "[data-player-binding-profile]": profile, "[data-player-binding-subject]": subject,
      "[data-player-binding-save]": button, "[data-player-binding-hint]": hint };
    row.querySelector = selector => fields[selector];
    return { row, profile, subject, button, hint };
  });
  const root = { querySelector: () => tabs,
    querySelectorAll: selector => selector === "[data-master-settings-pane]" ? panes : rows.map(entry => entry.row) };
  const elements = [general, players, ...rows.flatMap(entry => [entry.profile, entry.subject, entry.button])];
  return { root, general, players, panes, rows, elements };
}

const view = surface(); const drafts = new Map(); let tab = ""; let saved = 0;
const controller = wireMasterPlayerBindings(view.root, { isFullGM: true, selectedTab: "players", drafts,
  onTabChange: value => { tab = value; }, onSaved: () => { saved++; } });
assert.equal(tab, "players"); assert.equal(view.panes[0].hidden, true);
await view.players.emit("keydown", { key: "Home", preventDefault() {} });
assert.equal(tab, "general"); assert.equal(view.general.focused, true);
await view.players.click(); assert.equal(tab, "players");
const [mari, joao] = view.rows;
mari.subject.value = "s2"; await mari.subject.emit("change");
assert.deepEqual(drafts.get("mari"), { profileId: "p1", subjectId: "s2" });
mari.subject.value = "s1"; await mari.subject.emit("change");
assert.equal(drafts.has("mari"), false);
for (const row of [mari, joao]) {
  row.profile.value = "p2"; row.profile.selectedOptions = [{ dataset: { profileSubject: "s2" } }];
  await row.profile.emit("change"); assert.equal(row.subject.value, "s2");
}

// A saved snapshot cannot discard another user's draft or a newer edit made during the write.
let release; pauseUpdate = new Promise(resolve => { release = resolve; });
const saving = mari.button.click();
assert.equal(mari.button.disabled, true);
mari.subject.value = "s1"; await mari.subject.emit("change");
release(); await saving; pauseUpdate = null;
assert.deepEqual(users[0].flags["gms-reputation"].personalReputationBinding, { profileId: "p2", subjectId: "s2" });
assert.deepEqual(drafts.get("mari"), { profileId: "p2", subjectId: "s1" });
assert.equal(drafts.has("joao"), true); assert.equal(saved, 1); assert.equal(mari.button.disabled, false);
await mari.button.click(); assert.equal(drafts.has("mari"), false); assert.equal(drafts.has("joao"), true);

failUpdate = true;
await joao.button.click();
assert.equal(drafts.has("joao"), true); assert.equal(joao.button.disabled, false); assert.equal(messages.at(-1), "Offline");
failUpdate = false;
const beforeDenied = updates;
game.user = { role: 3, isGM: false };
await joao.button.click(); assert.equal(updates, beforeDenied, "Persistence rechecks permissions after wiring");
assert.equal(drafts.has("joao"), true);
game.user = { role: 4, isGM: true };
mari.profile.value = ""; await mari.profile.emit("change");
await mari.button.click(); assert.equal(users[0].flags["gms-reputation"].personalReputationBinding, null);
assert.equal(drafts.has("mari"), false);

controller.destroy(); controller.destroy();
assert.ok(view.elements.every(element => element.listenerCount() === 0));
const previousTab = tab; await view.general.click(); assert.equal(tab, previousTab);
const previousDrafts = structuredClone(drafts); await joao.subject.emit("change"); assert.deepEqual(drafts, previousDrafts);
const readonly = surface();
const restricted = wireMasterPlayerBindings(readonly.root, { isFullGM: false });
assert.ok(readonly.rows.every(row => row.button.listenerCount() === 0 && row.profile.listenerCount() === 0));
restricted.destroy();
assert.deepEqual(world, originalWorld, "Binding saves leave world revision and data untouched");
console.log("master-player-bindings: OK | keyboard, matching, concurrent drafts, failures, permissions and listener cleanup");
