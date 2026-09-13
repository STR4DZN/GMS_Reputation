import assert from "node:assert/strict";

const gm = { id: "gm-a", role: 4, isGM: true, active: true };
const trusted = { id: "trusted-a", role: 2, isGM: false, active: true };
const users = new Map([[gm.id, gm], [trusted.id, trusted]]);
Object.defineProperty(users, "contents", { get: () => [...users.values()] });

const storage = new Map();
const registrations = new Map();
globalThis.CONST = { USER_ROLES: { PLAYER: 1, TRUSTED: 2, ASSISTANT: 3, GAMEMASTER: 4 } };
globalThis.foundry = { utils: { deepClone: structuredClone, randomID: () => "rid-test" } };
globalThis.game = {
  user: gm,
  users,
  settings: {
    register(moduleId, key, config) {
      const id = `${moduleId}.${key}`;
      registrations.set(id, config);
      if (!storage.has(id)) storage.set(id, structuredClone(config.default));
    },
    get(moduleId, key) { return structuredClone(storage.get(`${moduleId}.${key}`)); },
    async set(moduleId, key, value) { storage.set(`${moduleId}.${key}`, structuredClone(value)); return value; }
  }
};

const handlers = new Map();
let socket = null;
globalThis.socketlib = {
  registerModule(moduleId) {
    assert.equal(moduleId, "gms-reputation");
    socket = {
      register(name, fn) { handlers.set(name, fn); },
      async executeAsUser(name, userId, payload) {
        const handler = handlers.get(name);
        assert.ok(handler, `handler ausente: ${name}`);
        const callerId = String(game.user.id);
        const previous = game.user;
        game.user = users.get(String(userId));
        try { return await handler.call(callerId, structuredClone(payload)); }
        finally { game.user = previous; }
      }
    };
    return socket;
  }
};

const { registerPersistenceSettings } = await import("../scripts/persistence/settings.js");
const Store = await import("../scripts/persistence/world-store.js");
const Broker = await import("../scripts/persistence/authority-broker.js");
const { createSubject } = await import("../scripts/data/schema.js");
registerPersistenceSettings();
await Store.initializeWorldStateIfNeeded();
assert.equal(Broker.initializeAuthorityBroker({ handler: Store.handleDelegatedSaveRequest }), true);
assert.equal(Broker.isAuthorityBrokerReady(), true);

// Trusted has read-only defaults. Even if the payload lies with senderId=GM,
// the authenticated SocketLib caller remains trusted-a and the write is denied.
const current = Store.loadWorldState();
const candidate = structuredClone(current);
candidate.subjects.s1 = createSubject({ id: "s1", alias: "Teste" });

game.user = trusted;
await assert.rejects(
  () => socket.executeAsUser("writeWorldState", gm.id, {
    senderId: gm.id,
    expectedRevision: current.revision,
    createBackup: true,
    candidate
  }),
  /permissão|somente de leitura|subjects/i
);
assert.equal(Object.keys(Store.loadWorldState().subjects).length, 0, "senderId forjado não pode alterar WorldState");

// Full GM non-forged direct behavior remains intact.
game.user = gm;
const saved = await Store.saveWorldState(candidate, { expectedRevision: current.revision });
assert.equal(saved.revision, current.revision + 1);
assert.ok(saved.subjects.s1);

Broker.shutdownAuthorityBroker();
assert.equal(Broker.isAuthorityBrokerReady(), false);
console.log("authority-broker-socketlib: OK | authenticated caller identity + spoof regression");
