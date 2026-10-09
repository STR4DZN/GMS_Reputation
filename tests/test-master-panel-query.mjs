import assert from "node:assert/strict";
import { buildMasterPanelReadModel, selectMasterPanelEntries, masterProfileRosterCount } from "../scripts/application/queries/master-panel-query.js";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value); for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
const state = {
  revision: 10,
  groups: {
    archived: { id: "archive", name: "Arquivo", archived: true, sortOrder: 0 },
    inactive: { id: "inactive", name: "Grupo inativo", active: false, sortOrder: 10 },
    active: { id: "active", name: "Nexus", sortOrder: 20 }
  },
  profiles: {
    last: { id: "p3", name: "Zulu", sortOrder: 10, groupId: "archive", relationships: { s1: {} } },
    orphan: { id: "p2", name: "Beta", sortOrder: 10, groupId: "missing", subjectIds: ["s1", "s1", "unknown"], relationships: { s2: {} }, archived: true },
    first: { id: "p1", name: "Alfa", sortOrder: 10, groupId: "active", active: false, relationships: { s1: {}, s2: {} } },
    peer: { id: "p4", name: "Delta", sortOrder: 20, groupId: "missing", relationships: {} },
    empty: { id: "p5", name: "Sem Grupo", sortOrder: 30, groupId: "", relationships: {} },
    null: { id: "p6", name: "Nulo", sortOrder: 40, groupId: null, relationships: {} },
    unset: { id: "p7", name: "Ausente", sortOrder: 50, relationships: {} }
  },
  subjects: {
    late: { id: "s3", realName: "Zulu", sortOrder: 20, archived: true },
    beta: { id: "s2", realName: "Beta", sortOrder: 10, active: false },
    alpha: { id: "s1", realName: "Alfa", sortOrder: 10 }
  }
};
const snapshot = structuredClone(state); deepFreeze(state);
const model = buildMasterPanelReadModel(state);
assert.deepEqual(model.profiles.map(entry => entry.id), ["p1", "p2", "p3", "p4", "p5", "p6", "p7"]);
assert.deepEqual(model.subjects.map(entry => entry.id), ["s1", "s2", "s3"]);
assert.deepEqual(model.groups.map(entry => entry.id), ["inactive", "active"]);
assert.equal(model.profilesById.get("p1"), state.profiles.first, "Indexes point to the snapshot's original entities");
assert.deepEqual(model.profilesByGroup.get("active").map(entry => entry.id), ["p1"]);
assert.deepEqual(model.ungroupedProfiles.map(entry => entry.id), ["p2", "p3", "p4", "p5", "p6", "p7"]);
let selected = selectMasterPanelEntries(model, { profileId: "p2", subjectId: "s2" });
assert.equal(selected.profile.archived, true, "Master can still select archived records");
assert.deepEqual(selected.sameGroupProfiles.map(entry => entry.id), ["p2", "p4"], "Missing group moves remain isolated from other ungrouped records");
assert.equal(selected.profileGroupIndex, 0); assert.equal(selected.subjectIndex, 1);
assert.equal(selected.hasPreviousSubject, true); assert.equal(selected.hasNextSubject, true);
assert.deepEqual([...selected.profileRoster], ["s1", "unknown"], "Explicit roster takes precedence over relationships");
assert.equal(masterProfileRosterCount(selected.profile), 3, "Navigation preserves raw count including duplicates");
assert.equal(selected.profileRoster.size, 2, "Editor counts unique IDs");
selected = selectMasterPanelEntries(model, { profileId: "p6", subjectId: "s3" });
assert.deepEqual(selected.sameGroupProfiles.map(entry => entry.id), ["p6", "p7"], "Null and absent group values share move order");
assert.equal(selected.hasPreviousSubject, true); assert.equal(selected.hasNextSubject, false);
selected = selectMasterPanelEntries(model, { profileId: "missing", subjectId: "missing" });
assert.equal(selected.profile.id, "p1"); assert.equal(selected.subject.id, "s1"); assert.equal(selected.hasPreviousSubject, false);
assert.deepEqual([...selected.profileRoster], ["s1", "s2"], "Legacy roster is inferred only when explicit array is absent");
assert.deepEqual(state, snapshot, "Indexing deeply frozen input never modifies it");
const empty = selectMasterPanelEntries(buildMasterPanelReadModel());
assert.equal(empty.profile, null); assert.equal(empty.subject, null); assert.equal(empty.subjectIndex, -1); assert.equal(empty.profileRoster.size, 0);

// Rebuilding the same revision must reflect drafts, renames, moves and membership changes.
const edited = structuredClone(snapshot), first = buildMasterPanelReadModel(edited);
edited.profiles.first.name = "Nova identidade";
edited.profiles.first.groupId = "inactive";
edited.profiles.first.subjectIds = ["s3"];
edited.subjects.late.sortOrder = -10;
const second = buildMasterPanelReadModel(edited);
assert.notEqual(first, second); assert.equal(edited.revision, snapshot.revision);
assert.equal(second.profilesByGroup.get("inactive")[0].name, "Nova identidade");
assert.equal(first.profilesByGroup.get("inactive").length, 0);
selected = selectMasterPanelEntries(second, { profileId: "p1", subjectId: "s3" });
assert.deepEqual([...selected.profileRoster], ["s3"]); assert.equal(selected.subjectIndex, 0);

// The old UI uses strict raw IDs for selection/order and string IDs for stepping.
const raw = { groups: {}, profiles: {
  numeric: { id: 1, name: "Alfa", sortOrder: 0, groupId: NaN },
  string: { id: "1", name: "Beta", sortOrder: 1, groupId: NaN }
}, subjects: { numeric: { id: 1, realName: "Alfa", sortOrder: 0 }, string: { id: "1", realName: "Beta", sortOrder: 1 } } };
selected = selectMasterPanelEntries(buildMasterPanelReadModel(raw), { profileId: 1, subjectId: 1 });
assert.equal(selected.profile.id, "1"); assert.equal(selected.subject.id, "1"); assert.equal(selected.subjectIndex, 1);
assert.equal(selected.profileGroupIndex, -1); assert.equal(selected.sameGroupProfiles.length, 0);
assert.equal(selected.hasPreviousSubject, false); assert.equal(selected.hasNextSubject, true, "String stepping retains its earlier numeric match");

// A larger campaign exercises every lookup and neighbour after stable ordering.
const large = { groups: {}, profiles: {}, subjects: {} };
for (let i=0; i<300; i++) large.profiles[`key${i}`] = { id: `p${i}`, name: `Perfil ${i}`, sortOrder: i, groupId: `g${i%7}` };
for (let i=0; i<1500; i++) large.subjects[`key${i}`] = { id: `s${i}`, realName: `NPC ${i}`, sortOrder: i };
const indexed = buildMasterPanelReadModel(deepFreeze(large));
for (let i=0; i<1500; i++) {
  const selection = selectMasterPanelEntries(indexed, { profileId: `p${i%300}`, subjectId: `s${i}` });
  assert.equal(selection.profile.id, `p${i%300}`); assert.equal(selection.subjectIndex, i);
  assert.equal(selection.hasPreviousSubject, i>0); assert.equal(selection.hasNextSubject, i<1499);
}
console.log("master-panel-query: OK | frozen snapshots, ordering/fallbacks, archived/orphan groups, legacy/duplicate rosters, same-revision edits, raw IDs and 1500 selections");
