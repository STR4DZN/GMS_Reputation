import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Handlebars from "handlebars";
import { expandMasterTemplate } from "../tools/template-sources.mjs";

const storage = new Map();
globalThis.CONST = { USER_ROLES: { PLAYER: 1, TRUSTED: 2, ASSISTANT: 3, GAMEMASTER: 4 } };
globalThis.foundry = { utils: { deepClone: structuredClone } };
globalThis.game = { user: { id: "gm", role: 4, isGM: true }, users: [], settings: {
  register(_namespace, key, config) { storage.set(key, structuredClone(config.default)); },
  get(_namespace, key) { return structuredClone(storage.get(key)); },
  set() { assert.fail("Rendering must never persist data"); }
} };
const { registerPersistenceSettings } = await import("../scripts/persistence/settings.js");
registerPersistenceSettings();
const { normalizeWorldState } = await import("../scripts/data/schema.js");
const { ReputationMasterPanelApplication, buildMasterPanelContext } = await import("../scripts/apps/master-panel.js");
const engine = Handlebars.create();
const registered = ReputationMasterPanelApplication.PARTS.main.templates;
for (const name of registered) {
  const file = new URL(`../${name.replace(/^modules\/gms-reputation\//, "")}`, import.meta.url);
  engine.registerPartial(name, await readFile(file, "utf8"));
}
const main = await readFile(new URL("../templates/apps/master-panel.hbs", import.meta.url), "utf8");
for (const source of [main, ...Object.values(engine.partials)]) {
  for (const include of source.matchAll(/\{\{>\s+"([^"]+)"/g)) {
    assert.ok(registered.includes(include[1]), `Foundry must preload ${include[1]}`);
  }
}
const split = engine.compile(main), expanded = engine.compile(await expandMasterTemplate());
let cases = 0;
for (const fixture of ["empty-v5", "small-campaign-v5", "protocols-v5", "history-heavy-v5", "legacy-v3-compat"]) {
  const state = normalizeWorldState(JSON.parse(await readFile(new URL(`fixtures/worldstate/${fixture}.json`, import.meta.url), "utf8")));
  storage.set("worldState", state); storage.set("worldStateBackup", state);
  for (const role of [1, 3, 4]) {
    game.user = { id: "gm", role, isGM: role === 4 };
    for (const activeSection of ["subjects", "profile", "characters", "relationship", "portrait", "focal", "history", "cleanup", "settings"]) {
      for (const settingsTab of ["general", "players"]) {
        const context = buildMasterPanelContext({ state, profileId: Object.keys(state.profiles)[0], subjectId: Object.keys(state.subjects)[0], activeSection, settingsTab });
        assert.equal(split(context), expanded(context), `${fixture}/${role}/${activeSection}/${settingsTab}: HTML bytes and Handlebars scope`);
        cases++;
      }
    }
  }
}
console.log(`master-templates: OK | ${cases} byte-identical renders | Foundry partial preload closure`);
