/**
 * Pure read-model/index builder. It never mutates or persists WorldState.
 * These indexes allow future UI queries to stop repeatedly scanning the same
 * collections without changing the persisted schema.
 */
export function buildWorldStateIndexes(state = {}) {
  const groups = Object.values(state.groups ?? {});
  const subjects = Object.values(state.subjects ?? {});
  const profiles = Object.values(state.profiles ?? {});
  const history = Array.isArray(state.history) ? state.history : [];

  const profilesByGroup = new Map();
  const profilesBySubject = new Map();
  const historyByProfile = new Map();
  const historyBySubject = new Map();

  for (const profile of profiles) {
    const groupKey = profile.groupId == null ? "__ungrouped__" : String(profile.groupId);
    const groupList = profilesByGroup.get(groupKey) ?? [];
    groupList.push(profile);
    profilesByGroup.set(groupKey, groupList);

    const subjectIds = new Set([
      ...(Array.isArray(profile.subjectIds) ? profile.subjectIds : []),
      ...Object.keys(profile.relationships ?? {})
    ].map(String));
    for (const subjectId of subjectIds) {
      const list = profilesBySubject.get(subjectId) ?? [];
      list.push(profile);
      profilesBySubject.set(subjectId, list);
    }
  }

  for (const event of history) {
    if (event?.profileId) {
      const key = String(event.profileId);
      const list = historyByProfile.get(key) ?? [];
      list.push(event);
      historyByProfile.set(key, list);
    }
    if (event?.subjectId) {
      const key = String(event.subjectId);
      const list = historyBySubject.get(key) ?? [];
      list.push(event);
      historyBySubject.set(key, list);
    }
  }

  return Object.freeze({
    groups: Object.freeze(groups),
    subjects: Object.freeze(subjects),
    profiles: Object.freeze(profiles),
    history: Object.freeze(history),
    profilesByGroup,
    profilesBySubject,
    historyByProfile,
    historyBySubject
  });
}

export function summarizeWorldState(state = {}) {
  const indexes = buildWorldStateIndexes(state);
  return Object.freeze({
    schemaVersion: Number(state.schemaVersion ?? 0),
    revision: Number(state.revision ?? 0),
    groupCount: indexes.groups.length,
    subjectCount: indexes.subjects.length,
    profileCount: indexes.profiles.length,
    historyCount: indexes.history.length
  });
}
