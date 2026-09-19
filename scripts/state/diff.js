import { normalizeWorldState } from "./schema.js";

function arePortraitsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.src === b.src && a.zoom === b.zoom && a.x === b.x && a.y === b.y;
}

function areSubjectsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.realName === b.realName &&
    a.alias === b.alias &&
    a.sortOrder === b.sortOrder &&
    a.active === b.active &&
    a.archived === b.archived &&
    arePortraitsEqual(a.portrait, b.portrait)
  );
}

function areFocalsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.name === b.name &&
    a.description === b.description &&
    arePortraitsEqual(a.portrait, b.portrait)
  );
}

function areRelationshipsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.score === b.score &&
    a.bond === b.bond &&
    a.communion === b.communion &&
    a.note === b.note &&
    a.revision === b.revision
  );
}

function areArraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Diff Engine oficial de alta performance da nova arquitetura.
 * Analisa duas instâncias do WorldState e emite a projeção cirúrgica do que mudou.
 */
export function diffWorldStates(previousInput = {}, nextInput = {}) {
  const previous = previousInput.schemaVersion === 5 ? previousInput : normalizeWorldState(previousInput);
  const next = nextInput.schemaVersion === 5 ? nextInput : normalizeWorldState(nextInput);

  const prevGroups = previous.groups || {};
  const nextGroups = next.groups || {};
  const prevSubjects = previous.subjects || {};
  const nextSubjects = next.subjects || {};
  const prevProfiles = previous.profiles || {};
  const nextProfiles = next.profiles || {};

  const groupIds = new Set([...Object.keys(prevGroups), ...Object.keys(nextGroups)]);
  const subjectIds = new Set([...Object.keys(prevSubjects), ...Object.keys(nextSubjects)]);
  const profileIds = new Set([...Object.keys(prevProfiles), ...Object.keys(nextProfiles)]);

  const changedGroups = [];
  const changedSubjects = [];
  const structuralSubjects = [];
  const changedProfiles = [];
  const structuralProfiles = [];
  const focalProfiles = [];
  const relationshipChanges = [];
  let structural = false;

  for (const id of groupIds) {
    const before = prevGroups[id];
    const after = nextGroups[id];
    if (!before || !after || before.name !== after.name || before.sortOrder !== after.sortOrder || before.color !== after.color) {
      changedGroups.push(id);
      structural = true;
    }
  }

  for (const id of subjectIds) {
    const before = prevSubjects[id];
    const after = nextSubjects[id];
    if (!before || !after) {
      changedSubjects.push(id);
      structuralSubjects.push(id);
      structural = true;
      continue;
    }
    if (!areSubjectsEqual(before, after)) {
      changedSubjects.push(id);
    }
    if (before.active !== after.active || before.archived !== after.archived || before.sortOrder !== after.sortOrder) {
      structuralSubjects.push(id);
      structural = true;
    }
  }

  for (const profileId of profileIds) {
    const before = prevProfiles[profileId];
    const after = nextProfiles[profileId];
    if (!before || !after) {
      changedProfiles.push(profileId);
      structuralProfiles.push(profileId);
      structural = true;
      continue;
    }

    let profileHasChange = false;

    if (
      before.active !== after.active ||
      before.archived !== after.archived ||
      before.sortOrder !== after.sortOrder ||
      before.groupId !== after.groupId ||
      before.name !== after.name ||
      !areArraysEqual(before.subjectIds, after.subjectIds)
    ) {
      structural = true;
      structuralProfiles.push(profileId);
      profileHasChange = true;
    }

    if (!areFocalsEqual(before.focal, after.focal)) {
      focalProfiles.push(profileId);
      profileHasChange = true;
    }

    const beforeRels = before.relationships || {};
    const afterRels = after.relationships || {};
    const relIds = new Set([...Object.keys(beforeRels), ...Object.keys(afterRels)]);
    let relsChanged = false;

    for (const sId of relIds) {
      if (!areRelationshipsEqual(beforeRels[sId], afterRels[sId])) {
        relationshipChanges.push(Object.freeze({ profileId, subjectId: sId }));
        relsChanged = true;
      }
    }

    if (profileHasChange || relsChanged) {
      changedProfiles.push(profileId);
    }
  }

  const historyDelta = Math.max(0, (next.history?.length ?? 0) - (previous.history?.length ?? 0));

  return Object.freeze({
    fromRevision: Number(previous.revision) || 0,
    toRevision: Number(next.revision) || 0,
    changedGroupIds: Object.freeze(changedGroups),
    changedSubjectIds: Object.freeze(changedSubjects),
    structuralSubjectIds: Object.freeze(structuralSubjects),
    changedProfileIds: Object.freeze(changedProfiles),
    structuralProfileIds: Object.freeze(structuralProfiles),
    focalProfileIds: Object.freeze(focalProfiles),
    relationshipChanges: Object.freeze(relationshipChanges),
    historyAppended: historyDelta > 0,
    historyCount: historyDelta,
    structural
  });
}

export const computeWorldStateDiff = diffWorldStates;
