import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const storage = new Map();
const registrations = new Map();
const setCounts = new Map();
globalThis.game = {
  user: { id: "gm-30", isGM: true, name: "Mestre Teste" },
  users: new Map([["gm-30", { id: "gm-30", name: "Mestre Teste" }]]),
  settings: {
    register(namespace, key, config) {
      registrations.set(`${namespace}.${key}`, config);
      const id = `${namespace}.${key}`;
      if (!storage.has(id)) storage.set(id, structuredClone(config.default));
    },
    get(namespace, key) { return structuredClone(storage.get(`${namespace}.${key}`)); },
    async set(namespace, key, value) {
      const id = `${namespace}.${key}`;
      setCounts.set(id, (setCounts.get(id) || 0) + 1);
      storage.set(id, structuredClone(value));
      return structuredClone(value);
    }
  }
};
let randomCounter = 0;
globalThis.foundry = { utils: {
  deepClone: structuredClone,
  randomID(length = 16) { randomCounter += 1; return (`rnd${randomCounter}`.padEnd(length, "x")).slice(0, length); }
}};

const { MODULE_ID, SETTINGS } = await import("../scripts/constants.js");
const Schema = await import("../scripts/data/schema.js");
const { registerPersistenceSettings } = await import("../scripts/persistence/settings.js");
const Store = await import("../scripts/persistence/world-store.js");
const Reputation = await import("../scripts/data/reputation-registry.js");
const Portraits = await import("../scripts/data/portrait-registry.js");
const Bulk = await import("../scripts/data/bulk-operations.js");
const History = await import("../scripts/data/history-registry.js");
const Master = await import("../scripts/apps/master-panel.js");
registerPersistenceSettings();

const state = Schema.createEmptyWorldState({ createdBy: "gm-30" });
state.subjects.s1 = Schema.createSubject({ id: "s1", realName: "Daniel", alias: "Corvo", sortOrder: 10, portrait: { src: "a.webp" } });
state.subjects.s2 = Schema.createSubject({ id: "s2", realName: "Agnes", alias: "Fio", sortOrder: 20 });
state.subjects.s3 = Schema.createSubject({ id: "s3", realName: "Simon", alias: "Cifra", sortOrder: 30 });
state.profiles.p1 = Schema.createProfile({ id: "p1", name: "Perfil", relationships: {
  s1: { score: 2 }, s2: { score: -1 }, s3: { score: 0 }
}});
storage.set(`${MODULE_ID}.${SETTINGS.WORLD_STATE}`, structuredClone(state));
storage.set(`${MODULE_ID}.${SETTINGS.WORLD_STATE_BACKUP}`, {});

// BLOCO 28 + 30 — quick edit creates history atomically.
let before = Store.loadWorldState();
let world = await Reputation.adjustReputationScore("p1", "s1", 1, { reason: "Ajudou o grupo" });
assert.equal(world.revision, before.revision + 1);
assert.equal(world.profiles.p1.relationships.s1.score, 3);
assert.equal(world.history.length, 1);
assert.equal(world.history[0].before.score, 2);
assert.equal(world.history[0].after.score, 3);
assert.equal(world.history[0].reason, "Ajudou o grupo");
assert.equal(world.history[0].userId, "gm-30");

// No-op must not create fake history or revision.
before = Store.loadWorldState();
world = await Reputation.setReputationScore("p1", "s1", 3, { reason: "não deve aparecer" });
assert.equal(world.revision, before.revision);
assert.equal(world.history.length, before.history.length);

// Special state change records before/after; Duplo remains derived, never stored.
world = await Reputation.updateRelationship("p1", "s1", { bond: true, communion: true }, { reason: "Protocolos ativados" });
const specialEvent = world.history.at(-1);
assert.equal(specialEvent.before.bond, false);
assert.equal(specialEvent.after.bond, true);
assert.equal(specialEvent.after.communion, true);
assert.equal(Object.hasOwn(world.profiles.p1.relationships.s1, "dualSync"), false);

// Portrait quick edit records a global subject event in the same save.
before = Store.loadWorldState();
world = await Portraits.setSubjectPortrait("s1", { src: "b.gif", zoom: 125, x: 40, y: 60 }, { profileId: "p1", reason: "Novo retrato" });
assert.equal(world.revision, before.revision + 1);
assert.equal(world.history.at(-1).type, "portrait");
assert.equal(world.history.at(-1).after.src, "b.gif");

// BLOCO 29 — bulk relationship edit is ONE world revision, with one transaction id shared by events.
before = Store.loadWorldState();
const worldSetBefore = setCounts.get(`${MODULE_ID}.${SETTINGS.WORLD_STATE}`) || 0;
world = await Bulk.applyBulkRelationshipChanges("p1", ["s1", "s2"], {
  scoreMode: "delta", scoreValue: 0.5, bond: "keep", communion: "on"
}, { reason: "Resultado coletivo" });
assert.equal(world.revision, before.revision + 1);
assert.equal((setCounts.get(`${MODULE_ID}.${SETTINGS.WORLD_STATE}`) || 0) - worldSetBefore, 1, "bulk operation must write WorldState once");
const bulkEvents = world.history.slice(before.history.length);
assert.equal(bulkEvents.length, 2);
assert.ok(bulkEvents[0].transactionId);
assert.equal(bulkEvents[0].transactionId, bulkEvents[1].transactionId);
assert.equal(world.profiles.p1.relationships.s2.score, -0.5);
assert.equal(world.profiles.p1.relationships.s2.communion, true);

// Bulk archive is also atomic and reversible later via before/after history.
before = Store.loadWorldState();
world = await Bulk.bulkArchiveSubjects(["s2", "s3"], true, { reason: "Ocultar temporariamente" });
assert.equal(world.revision, before.revision + 1);
assert.equal(world.subjects.s2.archived, true);
assert.equal(world.subjects.s3.archived, true);
const archiveEvents = world.history.slice(before.history.length);
assert.equal(archiveEvents.length, 2);
assert.equal(archiveEvents[0].type, "subject-archive");
assert.equal(archiveEvents[0].before.archived, false);
assert.equal(archiveEvents[0].after.archived, true);

// Bulk reorder preserves relative selected order and writes history.
before = Store.loadWorldState();
world = await Bulk.moveSubjects(["s3", "s2"], "top", { reason: "Prioridade de sessão" });
assert.equal(world.revision, before.revision + 1);
const ordered = Object.values(world.subjects).sort((a,b) => a.sortOrder-b.sortOrder).map((s) => s.id);
assert.deepEqual(ordered.slice(0, 2), ["s2", "s3"], "relative current order must be preserved");
assert.ok(world.history.slice(before.history.length).every((event) => event.type === "subject-reorder"));

// BLOCO 30 — presentation contains who/when/before/after/reason and global events.
const history = History.listHistory({ state: world, profileId: "p1", subjectId: "s2", limit: 100 });
assert.ok(history.length >= 3);
assert.ok(history.some((event) => event.actorLabel === "Mestre Teste"));
assert.ok(history.some((event) => event.changes.some((change) => change.key === "score")));
assert.ok(history.some((event) => event.type === "subject-archive"), "global subject event must be included in profile detail history");
assert.ok(history.some((event) => event.reason === "Resultado coletivo"));

// Master context exposes quick editor, history and bulk-ready subject list.
const master = Master.buildMasterPanelContext({ profileId: "p1", subjectId: "s1", activeSection: "relationship", state: world });
assert.equal(master.selection.quickPresets.length, 7);
assert.equal(master.selection.portraitEditor.kind, "subject");
assert.ok(master.history.length > 0);
assert.equal(master.world.historyCount, world.history.length);

const masterTemplate = await readFile(new URL("../templates/apps/master-panel.hbs", import.meta.url), "utf8");
assert.match(masterTemplate, /data-master-score-delta="-1"/);
assert.match(masterTemplate, /data-master-apply-score/);
assert.match(masterTemplate, /data-master-apply-specials/);
assert.match(masterTemplate, /data-master-save-portrait/);
assert.match(masterTemplate, /data-master-bulk-subject/);
assert.match(masterTemplate, /data-master-bulk-apply-relationship/);
assert.match(masterTemplate, /data-master-bulk-action="archive"/);
assert.match(masterTemplate, /data-master-bulk-action="top"/);
assert.match(masterTemplate, /actorLabel/);
assert.match(masterTemplate, /changes/);

console.log("master-edit-bulk-history: OK");
