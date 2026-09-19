import test from "node:test";
import assert from "node:assert/strict";

import { clampScore, deriveSpecialState, hasExpandedLimit, getScoreLimit } from "../scripts/domain/score.js";
import { getSemanticBand, RELATION_BAND } from "../scripts/domain/semantic-bands.js";
import { getSpecialPresentation } from "../scripts/domain/specials.js";
import { normalizePortrait, dragPortraitFrame } from "../scripts/domain/portraits.js";
import { createProfile } from "../scripts/domain/profiles.js";
import { createSubject } from "../scripts/domain/subjects.js";
import { createEmptyWorldState, normalizeWorldState } from "../scripts/state/schema.js";
import { diffWorldStates } from "../scripts/state/diff.js";
import { WorldStateRepository } from "../scripts/state/repository.js";
import { executeTransaction } from "../scripts/state/transactions.js";
import { ReputationService } from "../scripts/services/reputation-service.js";
import { ProfileService } from "../scripts/services/profile-service.js";
import { HistoryService } from "../scripts/services/history-service.js";
import { CleanupService } from "../scripts/services/cleanup-service.js";

test("Domain: Score clamping and limits", () => {
  assert.equal(clampScore(5.2), 5.0);
  assert.equal(clampScore(5.3), 5.5);
  assert.equal(clampScore(11, { communion: false, bond: false }), 10);
  assert.equal(clampScore(11, { communion: true, bond: false }), 11);
  assert.equal(clampScore(12.5, { communion: true, bond: true }), 12);
  assert.equal(clampScore(-15), -10);

  assert.equal(hasExpandedLimit({ communion: true }), true);
  assert.equal(getScoreLimit({ bond: true }), 12);
  assert.equal(getScoreLimit({}), 10);
});

test("Domain: Semantic bands", () => {
  assert.equal(getSemanticBand(-8).id, RELATION_BAND.HOSTILE);
  assert.equal(getSemanticBand(-3).id, RELATION_BAND.CAUTION);
  assert.equal(getSemanticBand(0).id, RELATION_BAND.NEUTRAL);
  assert.equal(getSemanticBand(2).id, RELATION_BAND.CONTACT);
  assert.equal(getSemanticBand(5).id, RELATION_BAND.TRUSTED);
  assert.equal(getSemanticBand(7.5).id, RELATION_BAND.ALLY);
  assert.equal(getSemanticBand(10, { communion: true }).id, RELATION_BAND.EXTREME);
});

test("Domain: Special protocols", () => {
  const bondPres = getSpecialPresentation({ bond: true });
  assert.equal(bondPres.state, "bond");
  assert.equal(bondPres.active, true);

  const communionPres = getSpecialPresentation({ communion: true });
  assert.equal(communionPres.state, "communion");
  assert.equal(communionPres.active, true);

  const dualPres = getSpecialPresentation({ communion: true, bond: true });
  assert.equal(dualPres.state, "dual-sync");
  assert.equal(dualPres.active, true);
});

test("Domain: Portraits", () => {
  const p = normalizePortrait({ src: "https://example.com/img.png", zoom: 150, x: 20, y: 80 });
  assert.equal(p.zoom, 150);
  assert.equal(p.x, 20);
  assert.equal(p.y, 80);

  const dragged = dragPortraitFrame(p, { deltaX: 10, deltaY: 5, viewportWidth: 100, viewportHeight: 100 });
  assert.equal(dragged.x, 10);
  assert.equal(dragged.y, 75);
});

test("State & Diff: Normalization and Diff computation", () => {
  const initial = createEmptyWorldState();
  assert.equal(initial.revision, 0);

  const next = normalizeWorldState({
    ...initial,
    profiles: {
      p1: createProfile({ id: "p1", name: "Alpha", focal: { name: "Alpha Focal" } })
    },
    subjects: {
      s1: createSubject({ id: "s1", realName: "Daniel", alias: "Corvo" })
    }
  });

  const diff = diffWorldStates(initial, next);
  assert.equal(diff.changedProfileIds.includes("p1"), true);
  assert.equal(diff.changedSubjectIds.includes("s1"), true);
});

test("State & Transactions: Mutation and History integration", async () => {
  WorldStateRepository.resetInMemory();

  // Create profile via Service
  const profile = await ProfileService.create({ name: "Matriz Primária", focalName: "Líder" });
  assert.equal(profile.name, "Matriz Primária");

  // Create subject
  const subject = createSubject({ id: "subj-test", alias: "Fio Rubro" });
  await executeTransaction({
    mutate: (draft) => {
      draft.subjects[subject.id] = subject;
    }
  });

  // Update reputation via ReputationService
  await ReputationService.update({
    profileId: profile.id,
    subjectId: subject.id,
    score: 6.5,
    bond: true,
    note: "Aliança firmada."
  });

  const state = WorldStateRepository.load();
  assert.equal(state.revision, 3);
  assert.equal(state.profiles[profile.id].relationships[subject.id].score, 6.5);
  assert.equal(state.profiles[profile.id].relationships[subject.id].bond, true);

  // Check history
  const history = HistoryService.list({ state, profileId: profile.id });
  assert.equal(history.length >= 1, true);

  // Check Section 55: Update focal generates focal-update event
  await ProfileService.updateFocal({
    profileId: profile.id,
    name: "Novo Nome Focal",
    description: "Nova descrição"
  });

  const stateAfterFocal = WorldStateRepository.load();
  const focalEvents = HistoryService.list({ state: stateAfterFocal, filter: "profiles" });
  const focalUpdateEvent = focalEvents.find((e) => e.type === "focal-update");
  assert.ok(focalUpdateEvent, "focal-update event must be recorded in history");

  // Test Cleanup Impact
  const impact = CleanupService.getImpact(stateAfterFocal);
  assert.equal(impact.profiles.length, 1);
  assert.equal(impact.subjects.length, 1);
});
