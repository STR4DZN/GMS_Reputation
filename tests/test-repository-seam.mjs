import assert from "node:assert/strict";

const storage = new Map();
const registrations = new Map();
globalThis.game = {
  user: { id: "gm-repo", isGM: true },
  users: new Map(),
  settings: {
    register(namespace, key, config) {
      const id = `${namespace}.${key}`;
      registrations.set(id, config);
      if (!storage.has(id)) storage.set(id, structuredClone(config.default));
    },
    get(namespace, key) { return structuredClone(storage.get(`${namespace}.${key}`)); },
    async set(namespace, key, value) {
      const id = `${namespace}.${key}`;
      storage.set(id, structuredClone(value));
      registrations.get(id)?.onChange?.(structuredClone(value), { source: "repository-seam-test" });
      return structuredClone(value);
    }
  }
};
globalThis.foundry = { utils: { deepClone: structuredClone, randomID: () => "repo-random" } };
globalThis.Hooks = { callAll() {} };

const { MODULE_ID, SETTINGS } = await import("../scripts/constants.js");
const { registerPersistenceSettings } = await import("../scripts/persistence/settings.js");
const { worldStateRepository } = await import("../scripts/infrastructure/world-state-repository.js");
registerPersistenceSettings();

let state = await worldStateRepository.initialize({ createdBy: "gm-repo" });
assert.equal(state.schemaVersion, 5);
assert.equal(state.revision, 0);

state = await worldStateRepository.transaction((draft) => {
  draft.metadata.testMarker = "architecture-60";
});
assert.equal(state.revision, 1);
assert.equal(worldStateRepository.read().metadata.testMarker, "architecture-60");
assert.equal(worldStateRepository.readBackup().revision, 0, "repository deve preservar backup do WorldStore atual");
assert.ok(storage.has(`${MODULE_ID}.${SETTINGS.WORLD_STATE}`));
assert.ok(storage.has(`${MODULE_ID}.${SETTINGS.WORLD_STATE_BACKUP}`));
assert.equal(worldStateRepository.requiredCapabilities(worldStateRepository.readBackup(), worldStateRepository.read()).length, 0,
  "mudança apenas de metadata não deve inventar capability nova");
console.log("repository-seam: OK | storage contract unchanged");
