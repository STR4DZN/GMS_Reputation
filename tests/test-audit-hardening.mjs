import assert from "node:assert/strict";
import {
  createGroup, createSubject, createProfile, normalizeWorldState, createEmptyWorldState
} from "../scripts/data/schema.js";
import {
  normalizeRelationship, deriveSpecialState, getScoreLimit, clampScore
} from "../scripts/core/score.js";

// Schema/core must survive null and malformed nested values instead of bricking world load.
assert.equal(createGroup({ id: "g", metadata: null }).id, "g");
assert.deepEqual(createSubject({ id: "s", metadata: null }).metadata.tags, []);
assert.equal(createProfile({ id: "p", source: null, focal: null, metadata: null, relationships: null }).focal.name, "Perfil focal");
assert.equal(normalizeRelationship(null).score, 0);
assert.equal(deriveSpecialState(null), "standard");
assert.equal(getScoreLimit(null), 10);
assert.equal(clampScore(999, null), 10);
for (const malformed of [null, false, 0, 42, "oops", [], { groups: null, subjects: null, profiles: null, migration: null, metadata: null }]) {
  const state = normalizeWorldState(malformed);
  assert.equal(state.schemaVersion, 5);
  assert.deepEqual(state.groups, {});
  assert.deepEqual(state.subjects, {});
  assert.deepEqual(state.profiles, {});
}

// Delegated history must be attributable to the requesting user.
globalThis.CONST = { USER_ROLES: { PLAYER: 1, TRUSTED: 2, ASSISTANT: 3, GAMEMASTER: 4 } };
const permissionConfig = {
  schema: 1,
  assistant: { read:true, openMaster:true, relationships:true, subjects:false, portraits:false, focal:false, bulk:false, history:false },
  trusted: { read:true, openMaster:false, relationships:false, subjects:false, portraits:false, focal:false, bulk:false, history:false }
};
globalThis.game = {
  user: { id: "assistant", role: 3 },
  settings: { get: () => permissionConfig }
};
const { assertAuthorizedTransition } = await import("../scripts/persistence/world-store.js");
const current = createEmptyWorldState({ createdBy: "gm" });
current.subjects.s1 = createSubject({ id:"s1", alias:"Alvo" });
current.profiles.p1 = createProfile({ id:"p1", name:"Perfil", subjectIds:["s1"], relationships:{ s1:{score:0} } });
const legitimate = structuredClone(current);
legitimate.profiles.p1.relationships.s1.score = 1;
legitimate.history.push({ id:"h1", timestamp:Date.now(), userId:"assistant", profileId:"p1", subjectId:"s1", type:"relationship", before:{score:0}, after:{score:1}, reason:"teste", transactionId:"t1" });
assert.equal(assertAuthorizedTransition(current, legitimate, game.user), true);
const anonymousAudit = structuredClone(legitimate);
anonymousAudit.history.push({ id:"fake", timestamp:Date.now(), userId:null, type:"unknown" });
assert.throws(() => assertAuthorizedTransition(current, anonymousAudit, game.user), /trilha de histórico/i);
const forgedAudit = structuredClone(legitimate);
forgedAudit.history.push({ id:"fake2", timestamp:Date.now(), userId:"another-user", type:"unknown" });
assert.throws(() => assertAuthorizedTransition(current, forgedAudit, game.user), /trilha de histórico/i);

console.log("audit-hardening: OK");
