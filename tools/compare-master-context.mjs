/** Development-only equivalence check against a separate baseline checkout. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

if (process.argv.length !== 3) {
  console.error("Usage: node tools/compare-master-context.mjs /path/to/baseline-checkout");
  process.exit(1);
}
const project = fileURLToPath(new URL("../", import.meta.url));
const base = path.resolve(process.argv[2]);
const moduleURL = (root, file) => pathToFileURL(path.join(root, file)).href;
const storage = new Map();
globalThis.CONST = { USER_ROLES: { PLAYER: 1, TRUSTED: 2, ASSISTANT: 3, GAMEMASTER: 4 } };
globalThis.foundry = { utils: { deepClone: structuredClone } };
const users = [{ id: "gm", role: 4, isGM: true, name: "Mestre" }, { id: "mari", role: 1, name: "Mari" }];
globalThis.game = { user: users[0], users, settings: {
  register(namespace, key, config) { if (!storage.has(key)) storage.set(key, structuredClone(config.default)); },
  get(namespace, key) { return structuredClone(storage.get(key)); },
  set() { throw new Error("Context must not persist data"); }
} };
const { registerPersistenceSettings } = await import(moduleURL(project, "scripts/persistence/settings.js"));
registerPersistenceSettings();
const { normalizeWorldState } = await import(moduleURL(project, "scripts/data/schema.js"));
const before = await import(moduleURL(base, "scripts/apps/master-panel.js"));
const after = await import(moduleURL(project, "scripts/apps/master-panel.js"));
assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
const { buildMasterPanelContext } = await import(moduleURL(project, "scripts/apps/master/context.js"));
assert.equal(after.buildMasterPanelContext, buildMasterPanelContext);
const roles = [
  { id: "gm", role: 4, isGM: true },
  { id: "assistant", role: 3, isGM: false },
  { id: "player", role: 1, isGM: false }
];
let cases = 0;
function compareShape(actual, expected, label) {
  if (!actual || typeof actual !== "object") return;
  assert.deepEqual(Object.keys(actual), Object.keys(expected), `${label}: property order`);
  assert.equal(Object.isFrozen(actual), Object.isFrozen(expected), `${label}: freeze contract`);
  for (const key of Object.keys(actual)) compareShape(actual[key], expected[key], `${label}/${key}`);
}
function compareContext(args, label) {
  const actual = after.buildMasterPanelContext(args), expected = before.buildMasterPanelContext(args);
  assert.deepEqual(actual, expected, label);
  compareShape(actual, expected, label);
  cases++;
}
for (const name of ["empty-v5", "small-campaign-v5", "protocols-v5", "history-heavy-v5", "legacy-v3-compat"]) {
  const state = normalizeWorldState(JSON.parse(await readFile(path.join(project, `tests/fixtures/worldstate/${name}.json`), "utf8")));
  const snapshot = structuredClone(state);
  storage.set("worldState", state);
  storage.set("worldStateBackup", state);
  const profiles = [...new Set(["", "missing", ...Object.keys(state.profiles).slice(0, 2)])];
  const subjects = [...new Set(["", "missing", ...Object.keys(state.subjects).slice(0, 3)])];
  for (const user of roles) {
    game.user = user;
    for (const profileId of profiles) for (const subjectId of subjects) {
      for (const activeSection of ["profiles", "characters", "relationship", "history", "cleanup", "settings", "subjects", "profile", "focal", "portrait", "invalid"]) {
        for (const settingsTab of ["general", "players"]) {
          const args = { state, profileId, subjectId, activeSection, settingsTab, newProfileGroupId: "missing" };
          compareContext(args, `${name}/${user.id}/${profileId}/${subjectId}/${activeSection}/${settingsTab}`);
        }
      }
    }
  }
  assert.deepEqual(state, snapshot, "Context must not modify its input state");
}
// Raw states exercise compatibility cases that schema normalization would erase.
const metadata = { createdAt: 1000, updatedAt: 2000 };
const edgeStates = [
  ["orphan-groups", {
    metadata, groups: { live: { id: "live", name: "Ativo", sortOrder: 10 }, archived: { id: "archive", name: "Arquivo", archived: true, sortOrder: 0 } },
    profiles: {
      a: { id: "p1", name: "Alfa", groupId: "missing", sortOrder: 10, subjectIds: ["s1", "s1", "missing"], relationships: { s2: { score: 12, bond: true } } },
      b: { id: "p2", name: "Beta", groupId: "missing", sortOrder: 20, archived: true, relationships: { s1: { score: -2 } } },
      c: { id: "p3", name: "Gama", groupId: "archive", active: false, relationships: {} }
    }, subjects: { a: { id: "s1", realName: "Alfa", sortOrder: 10 }, b: { id: "s2", realName: "Beta", sortOrder: 20, archived: true } }, history: []
  }],
  ["raw-key-types", {
    metadata, groups: { a: { id: 0, name: "Zero", sortOrder: 10 }, b: { id: "0", name: "String zero", sortOrder: 20 } },
    profiles: {
      a: { id: 1, name: "Alfa", groupId: NaN, sortOrder: 10, relationships: {} },
      b: { id: "1", name: "Beta", groupId: 0, sortOrder: 20, relationships: {} },
      c: { id: "p1", name: "Gama", groupId: "0", sortOrder: 30, relationships: {} }
    }, subjects: { a: { id: 1, realName: "Alfa", sortOrder: 10 }, b: { id: "1", realName: "Beta", sortOrder: 20 }, c: { id: "s1", realName: "Gama", sortOrder: 30 } }, history: []
  }],
  ["duplicate-ids", {
    metadata, groups: { a: { id: "g", name: "Alfa", sortOrder: 10 }, b: { id: "g", name: "Beta", sortOrder: 20 } },
    profiles: { a: { id: "p1", name: "Alfa", groupId: "g", sortOrder: 10, relationships: {} }, b: { id: "p1", name: "Beta", groupId: "g", sortOrder: 20, relationships: {} } },
    subjects: { a: { id: "s1", realName: "Alfa", sortOrder: 10 }, b: { id: "s1", realName: "Beta", sortOrder: 20 } }, history: []
  }]
];
for (const [name, state] of edgeStates) {
  const snapshot = structuredClone(state);
  storage.set("worldState", state); storage.set("worldStateBackup", state);
  for (const user of roles) {
    game.user = user;
    for (const [profileId, subjectId] of [["", ""], ["p1", "s1"], ["p2", "s2"], [1, 1], ["1", "1"], ["missing", "missing"]]) {
      for (const activeSection of ["profiles", "characters", "relationship", "history", "settings"]) {
        for (const newProfileGroupId of ["", "__ungrouped__", "live", "0", "g", "missing"]) {
          compareContext({ state, profileId, subjectId, activeSection, newProfileGroupId }, `${name}/${user.id}/${profileId}/${subjectId}/${activeSection}/${newProfileGroupId}`);
        }
      }
    }
  }
  assert.deepEqual(state, snapshot, "Raw context must not modify its input state");
}
console.log(`master-context comparison: OK | ${cases} before/after contexts | identical property order/freeze contracts/public exports | no writes or state mutations`);
