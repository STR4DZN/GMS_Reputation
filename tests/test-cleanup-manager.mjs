import assert from "node:assert/strict";

const storage = new Map();
const registrations = new Map();
let randomCounter = 0;

globalThis.game = {
  user: { id: "gm-cleanup", isGM: true },
  users: { get: () => null, values: () => [] },
  settings: {
    register(namespace, key, data) {
      const storageKey = `${namespace}.${key}`;
      registrations.set(storageKey, data);
      if (!storage.has(storageKey)) storage.set(storageKey, structuredClone(data.default));
    },
    get(namespace, key) { return structuredClone(storage.get(`${namespace}.${key}`)); },
    async set(namespace, key, value) {
      storage.set(`${namespace}.${key}`, structuredClone(value));
      return structuredClone(value);
    }
  }
};

globalThis.foundry = { utils: {
  deepClone: structuredClone,
  randomID(length = 16) {
    randomCounter += 1;
    return (`cleanup${randomCounter}`.padEnd(length, "x")).slice(0, length);
  }
}};

const { registerPersistenceSettings } = await import("../scripts/persistence/settings.js");
const Store = await import("../scripts/persistence/world-store.js");
const Subjects = await import("../scripts/data/subject-registry.js");
const Profiles = await import("../scripts/data/profile-registry.js");
const Groups = await import("../scripts/data/group-registry.js");
const Cleanup = await import("../scripts/data/destructive-operations.js");

registerPersistenceSettings();
await Store.initializeWorldStateIfNeeded();

let state = await Groups.createNewGroup({ name: "Arquivo Antigo", description: "Grupo que será apagado" });
const groupId = Object.keys(state.groups)[0];
state = await Subjects.createNewSubject({ alias: "Antigo A", realName: "Registro A" });
const subjectA = Object.keys(state.subjects)[0];
state = await Subjects.createNewSubject({ alias: "Antigo B", realName: "Registro B" });
const subjectB = Object.keys(state.subjects).find((id) => id !== subjectA);
state = await Profiles.createNewProfile({ name: "Matriz Antiga", focalName: "Focal Antigo", groupId });
const profileId = Object.keys(state.profiles)[0];

let impact = Cleanup.buildCleanupImpact(state);
assert.equal(impact.subjects.length, 2);
assert.equal(impact.profiles.length, 1);
assert.equal(impact.groups.length, 1);
assert.equal(impact.subjects.find((entry) => entry.id === subjectA).relationshipCount, 1);
assert.equal(impact.subjects.find((entry) => entry.id === subjectA).rosterCount, 1);
assert.equal(impact.profiles[0].relationshipCount, 2);
assert.equal(impact.groups[0].profileCount, 1);

const beforeSubjectDeleteRevision = state.revision;
state = await Cleanup.deleteSubjectPermanently(subjectA);
assert.equal(state.revision, beforeSubjectDeleteRevision + 1);
assert.equal(state.subjects[subjectA], undefined, "personagem deve sair do WorldState");
assert.ok(state.subjects[subjectB], "outros personagens devem permanecer");
assert.equal(state.profiles[profileId].relationships[subjectA], undefined, "Relationship do personagem apagado deve sair do Perfil");
assert.equal(state.profiles[profileId].subjectIds.includes(subjectA), false, "roster do Perfil não pode manter ID apagado");
assert.ok(state.profiles[profileId].relationships[subjectB], "relações dos demais personagens devem permanecer");
assert.equal(state.history.at(-1).type, "subject-delete");
const subjectBackup = Store.loadWorldStateBackup();
assert.ok(subjectBackup.subjects[subjectA], "backup automático deve conter o personagem antes da exclusão");

state = await Cleanup.deleteGroupPermanently(groupId);
assert.equal(state.groups[groupId], undefined, "grupo deve ser removido");
assert.ok(state.profiles[profileId], "apagar grupo não pode apagar o Perfil");
assert.equal(state.profiles[profileId].groupId, null, "Perfil do grupo apagado deve ir para Sem Grupo");
assert.equal(state.history.at(-1).type, "group-delete");
assert.equal(state.history.at(-1).after.movedToUngrouped, 1);

state = await Cleanup.deleteProfilePermanently(profileId);
assert.equal(state.profiles[profileId], undefined, "Perfil deve ser removido");
assert.ok(state.subjects[subjectB], "apagar Perfil não pode apagar Personagens");
assert.equal(state.history.at(-1).type, "profile-delete");

impact = Cleanup.buildCleanupImpact(state);
assert.equal(impact.subjects.length, 1);
assert.equal(impact.profiles.length, 0);
assert.equal(impact.groups.length, 0);

const stableRevision = state.revision;
globalThis.game.user.isGM = false;
let denied = null;
try { await Cleanup.deleteSubjectPermanently(subjectB); } catch (error) { denied = error; }
assert.match(String(denied?.message || denied), /Gamemaster completo/i);
assert.equal(Store.loadWorldState().revision, stableRevision, "tentativa sem permissão não pode gravar o WorldState");
assert.ok(Store.loadWorldState().subjects[subjectB]);

console.log("cleanup-manager-59.10: OK");
