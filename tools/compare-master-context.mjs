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
          assert.deepEqual(after.buildMasterPanelContext(args), before.buildMasterPanelContext(args), `${name}/${user.id}/${profileId}/${subjectId}/${activeSection}/${settingsTab}`);
          cases++;
        }
      }
    }
  }
  assert.deepEqual(state, snapshot, "Context must not modify its input state");
}
console.log(`master-context comparison: OK | ${cases} before/after contexts | identical public exports | no writes or state mutations`);
