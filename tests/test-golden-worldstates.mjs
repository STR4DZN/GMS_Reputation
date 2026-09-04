import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeWorldState } from "../scripts/data/schema.js";
import { deriveSpecialState } from "../scripts/core/score.js";
import { buildWorldStateIndexes, summarizeWorldState } from "../scripts/application/queries/world-state-query.js";

const fixtureNames = [
  "empty-v5.json",
  "small-campaign-v5.json",
  "protocols-v5.json",
  "history-heavy-v5.json",
  "legacy-v3-compat.json"
];

function stableSemanticState(state) {
  const clone = structuredClone(state);
  if (clone.metadata) delete clone.metadata.moduleVersion;
  return clone;
}

for (const name of fixtureNames) {
  const raw = JSON.parse(await readFile(new URL(`./fixtures/worldstate/${name}`, import.meta.url), "utf8"));
  const normalized = normalizeWorldState(raw);
  const normalizedTwice = normalizeWorldState(normalized);
  assert.equal(normalized.schemaVersion, 5, `${name}: deve terminar em schema 5`);
  assert.deepEqual(stableSemanticState(normalizedTwice), stableSemanticState(normalized), `${name}: normalização deve ser idempotente`);

  const indexes = buildWorldStateIndexes(normalized);
  const summary = summarizeWorldState(normalized);
  assert.equal(summary.groupCount, Object.keys(normalized.groups).length);
  assert.equal(summary.subjectCount, Object.keys(normalized.subjects).length);
  assert.equal(summary.profileCount, Object.keys(normalized.profiles).length);
  assert.equal(summary.historyCount, normalized.history.length);
  assert.equal(indexes.groups.length, summary.groupCount);
}

const small = normalizeWorldState(JSON.parse(await readFile(new URL("./fixtures/worldstate/small-campaign-v5.json", import.meta.url), "utf8")));
assert.deepEqual(Object.keys(small.groups), ["grp-court"]);
assert.deepEqual(Object.keys(small.subjects), ["sub-alfa", "sub-beta"]);
assert.deepEqual(Object.keys(small.profiles), ["pro-main"]);
assert.deepEqual(small.profiles["pro-main"].subjectIds, ["sub-alfa", "sub-beta"]);
assert.equal(small.profiles["pro-main"].relationships["sub-alfa"].score, 5);
assert.equal(small.profiles["pro-main"].relationships["sub-beta"].score, -2);
assert.equal(small.subjects["sub-beta"].portrait.src, "https://example.test/beta.gif");

const protocols = normalizeWorldState(JSON.parse(await readFile(new URL("./fixtures/worldstate/protocols-v5.json", import.meta.url), "utf8")));
const rels = protocols.profiles["pro-protocol"].relationships;
assert.equal(deriveSpecialState(rels["sub-bond"]), "bond");
assert.equal(deriveSpecialState(rels["sub-communion"]), "communion");
assert.equal(deriveSpecialState(rels["sub-dual"]), "dual-sync");
assert.equal(rels["sub-dual"].score, 12);

const history = normalizeWorldState(JSON.parse(await readFile(new URL("./fixtures/worldstate/history-heavy-v5.json", import.meta.url), "utf8")));
const historyIndexes = buildWorldStateIndexes(history);
assert.equal(historyIndexes.historyByProfile.get("pro-history").length, 11);
assert.equal(historyIndexes.historyBySubject.get("sub-history").length, 11);

const legacy = normalizeWorldState(JSON.parse(await readFile(new URL("./fixtures/worldstate/legacy-v3-compat.json", import.meta.url), "utf8")));
assert.deepEqual(legacy.profiles["legacy-profile"].subjectIds, ["legacy-sub"], "v3 sem subjectIds deve inferir roster das relationships");
assert.equal(legacy.migration.deprecatedSubjectGroupAssignments["legacy-sub"], "legacy-group");
console.log(`golden-worldstates: OK | fixtures=${fixtureNames.length}`);
