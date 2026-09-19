import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeWorldState } from "../scripts/state/schema.js";
import { computeWorldStateDiff } from "../scripts/state/diff.js";
import { buildPlayerDashboardReadModel } from "../scripts/read-models/player-dashboard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures", "worldstate");

function loadFixture(filename) {
  const filepath = path.join(FIXTURES_DIR, filename);
  return JSON.parse(fs.readFileSync(filepath, "utf8"));
}

test("Performance G14: Golden WorldStates loading & normalization budget", () => {
  const empty = loadFixture("empty.json");
  const small = loadFixture("small.json");
  const large = loadFixture("large.json");
  const extreme = loadFixture("extreme.json");

  // JIT Warmup
  normalizeWorldState(empty);

  // Normalization on empty state
  const t0 = performance.now();
  const normEmpty = normalizeWorldState(empty);
  const durEmpty = performance.now() - t0;
  assert.equal(normEmpty.schemaVersion, 5);
  assert.ok(durEmpty < 20, `Empty normalization took ${durEmpty}ms (budget < 20ms)`);

  // Normalization on small state
  const t1 = performance.now();
  const normSmall = normalizeWorldState(small);
  const durSmall = performance.now() - t1;
  assert.equal(Object.keys(normSmall.profiles).length, 2);
  assert.ok(durSmall < 15, `Small normalization took ${durSmall}ms (budget < 15ms)`);

  // Normalization on large state (20 profiles, 100 subjects, 1000 relationships)
  const t2 = performance.now();
  const normLarge = normalizeWorldState(large);
  const durLarge = performance.now() - t2;
  assert.equal(Object.keys(normLarge.profiles).length, 20);
  assert.ok(durLarge < 50, `Large normalization took ${durLarge}ms (budget < 50ms)`);

  // Normalization on extreme state (50 profiles, 300 subjects, 4000 relationships)
  const t3 = performance.now();
  const normExtreme = normalizeWorldState(extreme);
  const durExtreme = performance.now() - t3;
  assert.equal(Object.keys(normExtreme.profiles).length, 50);
  assert.ok(durExtreme < 60, `Extreme normalization took ${durExtreme}ms (budget < 60ms)`);
});

test("Performance G14: Diff Engine computation budget on large states", () => {
  const largeBefore = loadFixture("large.json");
  const largeAfter = structuredClone(largeBefore);

  // Modify 3 relationships and add 1 subject
  largeAfter.profiles["prof-1"].relationships["subj-1"].score += 1.5;
  largeAfter.profiles["prof-2"].relationships["subj-2"].bond = true;
  largeAfter.subjects["subj-new"] = { id: "subj-new", alias: "New Agent", active: true };

  const t0 = performance.now();
  const diff = computeWorldStateDiff(largeBefore, largeAfter);
  const dur = performance.now() - t0;

  assert.equal(diff.relationshipChanges.length, 2);
  assert.equal(diff.structuralSubjectIds.includes("subj-new"), true);
  assert.ok(dur < 25, `Diff computation took ${dur}ms (budget < 25ms)`);
});

test("Performance G14: Player Dashboard Read-Model budget on large state", () => {
  const large = loadFixture("large.json");

  const t0 = performance.now();
  const model = buildPlayerDashboardReadModel({ profileId: "prof-1", state: large });
  const dur = performance.now() - t0;

  assert.equal(model.hasProfile, true);
  assert.equal(model.cards.length, 50); // 50 subjects in roster
  assert.ok(dur < 25, `Read model generation took ${dur}ms (budget < 25ms)`);
});
