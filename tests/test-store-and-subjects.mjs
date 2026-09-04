import assert from 'node:assert/strict';

const storage = new Map();
const registrations = new Map();
globalThis.game = {
  user: { id: 'gm-test', isGM: true },
  settings: {
    register(namespace, key, data) {
      registrations.set(`${namespace}.${key}`, data);
      if (!storage.has(`${namespace}.${key}`)) storage.set(`${namespace}.${key}`, structuredClone(data.default));
    },
    get(namespace, key) { return structuredClone(storage.get(`${namespace}.${key}`)); },
    async set(namespace, key, value) { storage.set(`${namespace}.${key}`, structuredClone(value)); return structuredClone(value); }
  }
};
let counter = 0;
globalThis.foundry = { utils: {
  deepClone: structuredClone,
  randomID(length=16) { counter += 1; return (`id${counter}`.padEnd(length, 'x')).slice(0, length); }
}};

const { registerPersistenceSettings } = await import('../scripts/persistence/settings.js');
const Store = await import('../scripts/persistence/world-store.js');
const Subjects = await import('../scripts/data/subject-registry.js');
registerPersistenceSettings();

assert.equal(registrations.get('gms-reputation.worldState').scope, 'world');
assert.equal(registrations.get('gms-reputation.worldState').config, false);

let state = await Store.initializeWorldStateIfNeeded();
assert.equal(state.revision, 0);
assert.equal(Object.keys(state.subjects).length, 0);

state = await Subjects.createNewSubject({ realName: 'Teste Real', alias: 'Teste' });
assert.equal(state.revision, 1);
assert.equal(Object.keys(state.subjects).length, 1);
const id = Object.keys(state.subjects)[0];
assert.equal(state.subjects[id].alias, 'Teste');

state = await Subjects.updateSubject(id, { realName: 'Nome Renomeado' });
assert.equal(state.revision, 2);
assert.equal(state.subjects[id].realName, 'Nome Renomeado');
assert.equal(Object.keys(state.subjects)[0], id, 'rename must not change stable id');

state = await Subjects.setSubjectActive(id, false);
assert.equal(state.subjects[id].active, false);
state = await Subjects.archiveSubject(id, true);
assert.equal(state.subjects[id].archived, true);
assert.equal(Subjects.listSubjects().length, 0);
assert.equal(Subjects.searchSubjects('renomeado', {includeArchived:true}).length, 1);

state = await Subjects.duplicateSubject(id, { copyRelationships: false });
assert.equal(Object.keys(state.subjects).length, 2);
const ids = Object.keys(state.subjects);
assert.notEqual(ids[0], ids[1]);

const beforeConflict = Store.loadWorldState();
await Subjects.updateSubject(id, { alias: 'Nova Alias' });
let conflict = null;
try {
  await Store.saveWorldState(beforeConflict, { expectedRevision: beforeConflict.revision });
} catch (error) { conflict = error; }
assert.equal(conflict?.name, 'RevisionConflictError');

const current = Store.loadWorldState();
const backup = Store.loadWorldStateBackup();
assert.ok(backup);
assert.equal(backup.revision, current.revision - 1);

console.log('store-and-subjects: OK');
