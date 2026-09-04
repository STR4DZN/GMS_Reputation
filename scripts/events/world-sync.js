import { normalizeWorldState } from "../data/schema.js";

const listeners = new Set();
let lastState = null;
let pendingState = null;
let pendingOptions = null;
let scheduled = false;

function stable(value) {
  try { return JSON.stringify(value ?? null); } catch (_error) { return String(value); }
}

function changed(left, right) { return stable(left) !== stable(right); }

export function diffWorldStates(previousInput = {}, nextInput = {}) {
  const previous = normalizeWorldState(previousInput);
  const next = normalizeWorldState(nextInput);
  const groupIds = new Set([...Object.keys(previous.groups ?? {}), ...Object.keys(next.groups ?? {})]);
  const subjectIds = new Set([...Object.keys(previous.subjects), ...Object.keys(next.subjects)]);
  const profileIds = new Set([...Object.keys(previous.profiles), ...Object.keys(next.profiles)]);
  const changedGroups = [];
  const changedSubjects = [];
  const structuralSubjects = [];
  const changedProfiles = [];
  const structuralProfiles = [];
  const focalProfiles = [];
  const relationshipChanges = [];
  let structural = false;

  for (const id of groupIds) {
    const before = previous.groups?.[id];
    const after = next.groups?.[id];
    if (!before || !after || changed(before, after)) {
      changedGroups.push(id);
      structural = true;
    }
  }

  for (const id of subjectIds) {
    const before = previous.subjects[id];
    const after = next.subjects[id];
    if (!before || !after) {
      changedSubjects.push(id); structuralSubjects.push(id); structural = true; continue;
    }
    if (changed(before, after)) changedSubjects.push(id);
    if (before.active !== after.active || before.archived !== after.archived || before.sortOrder !== after.sortOrder) {
      structuralSubjects.push(id); structural = true;
    }
  }

  for (const profileId of profileIds) {
    const before = previous.profiles[profileId];
    const after = next.profiles[profileId];
    if (!before || !after) {
      changedProfiles.push(profileId); structuralProfiles.push(profileId); structural = true; continue;
    }
    if (before.active !== after.active || before.archived !== after.archived || before.sortOrder !== after.sortOrder || before.groupId !== after.groupId || before.name !== after.name || changed(before.subjectIds ?? [], after.subjectIds ?? [])) { structural = true; structuralProfiles.push(profileId); }
    if (changed(before.focal, after.focal)) focalProfiles.push(profileId);
    const relationshipIds = new Set([...Object.keys(before.relationships ?? {}), ...Object.keys(after.relationships ?? {})]);
    for (const subjectId of relationshipIds) {
      if (changed(before.relationships?.[subjectId], after.relationships?.[subjectId])) relationshipChanges.push(Object.freeze({ profileId, subjectId }));
    }
    if (focalProfiles.includes(profileId) || relationshipChanges.some((entry) => entry.profileId === profileId) || changed({ ...before, relationships: undefined, focal: undefined }, { ...after, relationships: undefined, focal: undefined })) changedProfiles.push(profileId);
  }

  return Object.freeze({
    fromRevision: Number(previous.revision) || 0,
    toRevision: Number(next.revision) || 0,
    changedGroupIds: Object.freeze([...new Set(changedGroups)]),
    changedSubjectIds: Object.freeze([...new Set(changedSubjects)]),
    structuralSubjectIds: Object.freeze([...new Set(structuralSubjects)]),
    changedProfileIds: Object.freeze([...new Set(changedProfiles)]),
    structuralProfileIds: Object.freeze([...new Set(structuralProfiles)]),
    focalProfileIds: Object.freeze([...new Set(focalProfiles)]),
    relationshipChanges: Object.freeze(relationshipChanges),
    historyAppended: Math.max(0, (next.history?.length ?? 0) - (previous.history?.length ?? 0)),
    structural
  });
}

export function primeWorldStateSync(state) {
  lastState = normalizeWorldState(state);
  return lastState;
}

function dispatch(nextInput, options = {}) {
  const next = normalizeWorldState(nextInput);
  const previous = lastState ?? next;
  const diff = diffWorldStates(previous, next);
  lastState = next;
  if (diff.fromRevision === diff.toRevision && !diff.structural && !diff.changedGroupIds.length && !diff.changedSubjectIds.length && !diff.changedProfileIds.length) return null;
  const event = Object.freeze({ state: next, previous, diff, options: Object.freeze({ ...(options ?? {}) }) });
  for (const callback of [...listeners]) {
    try { callback(event); } catch (error) { console.warn("GMS Reputation | World sync listener failed.", error); }
  }
  globalThis.Hooks?.callAll?.("gmsReputationWorldStateChanged", event);
  return event;
}

export function ingestWorldStateSetting(value, options = {}) {
  pendingState = value;
  pendingOptions = options;
  if (scheduled) return;
  scheduled = true;
  const schedule = globalThis.queueMicrotask ?? ((callback) => Promise.resolve().then(callback));
  schedule(() => {
    scheduled = false;
    const state = pendingState;
    const requestOptions = pendingOptions;
    pendingState = null;
    pendingOptions = null;
    dispatch(state, requestOptions);
  });
}

export function subscribeWorldStateChanges(callback) {
  if (typeof callback !== "function") throw new TypeError("World sync listener must be a function.");
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getLastSyncedWorldState() { return lastState; }
