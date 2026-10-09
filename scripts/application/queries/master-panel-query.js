/**
 * Master-specific ordered indexes, rebuilt for every context snapshot.
 * Preserve the UI's ordering, archived records and raw group-key semantics;
 * the general WorldState indexes serve other consumers and have different rules.
 * Entity references belong to the supplied state; no persistence or cross-render cache.
 */
export function buildMasterPanelReadModel(state = {}) {
  const profiles = Object.values(state.profiles ?? {}).sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name), "pt-BR"));
  const subjects = Object.values(state.subjects ?? {}).sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.realName).localeCompare(String(b.realName), "pt-BR"));
  const groups = Object.values(state.groups ?? {}).filter((group) => !group.archived)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name), "pt-BR"));
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const profilesById = new Map(), subjectsById = new Map();
  const subjectPositions = new Map(), subjectNavigationPositions = new Map();
  const profilesByGroup = new Map(groups.map((group) => [group.id, []]));
  const profilePeersByGroup = new Map(), profilePositionsByGroup = new Map();
  const ungroupedProfiles = [];

  for (const profile of profiles) {
    if (!profilesById.has(profile.id)) profilesById.set(profile.id, profile);
    const bucket = profile.groupId ? profilesByGroup.get(profile.groupId) : null;
    if (bucket) bucket.push(profile); else ungroupedProfiles.push(profile);
    // A missing/archived group displays as ungrouped, but still has its own move order.
    const key = profile.groupId ?? null;
    if (key !== key) continue; // Strict equality never matches NaN in the old group filter.
    if (!profilePeersByGroup.has(key)) {
      profilePeersByGroup.set(key, []); profilePositionsByGroup.set(key, new Map());
    }
    const peers = profilePeersByGroup.get(key), positions = profilePositionsByGroup.get(key);
    if (profile.id === profile.id && !positions.has(profile.id)) positions.set(profile.id, peers.length);
    peers.push(profile);
  }
  subjects.forEach((subject, index) => {
    if (!subjectsById.has(subject.id)) subjectsById.set(subject.id, subject);
    if (subject.id === subject.id && !subjectPositions.has(subject.id)) subjectPositions.set(subject.id, index);
    const navigationId = String(subject.id);
    if (!subjectNavigationPositions.has(navigationId)) subjectNavigationPositions.set(navigationId, index);
  });
  for (const bucket of [...profilesByGroup.values(), ...profilePeersByGroup.values()]) Object.freeze(bucket);
  return Object.freeze({
    profiles: Object.freeze(profiles), subjects: Object.freeze(subjects), groups: Object.freeze(groups),
    groupMap, profilesById, subjectsById, subjectPositions, subjectNavigationPositions,
    profilesByGroup, ungroupedProfiles: Object.freeze(ungroupedProfiles), profilePeersByGroup, profilePositionsByGroup
  });
}

export function selectMasterPanelEntries(readModel, { profileId = "", subjectId = "" } = {}) {
  const profile = readModel.profilesById.get(String(profileId)) ?? readModel.profiles[0] ?? null;
  const subject = readModel.subjectsById.get(String(subjectId)) ?? readModel.subjects[0] ?? null;
  const groupKey = profile?.groupId ?? null;
  const peers = profile ? readModel.profilePeersByGroup.get(groupKey) ?? [] : [];
  const profileGroupIndex = profile ? readModel.profilePositionsByGroup.get(groupKey)?.get(profile.id) ?? -1 : -1;
  const subjectIndex = subject ? readModel.subjectPositions.get(subject.id) ?? -1 : -1;
  const navigationIndex = subject ? readModel.subjectNavigationPositions.get(String(subject.id)) ?? -1 : -1;
  const profileRoster = new Set(Array.isArray(profile?.subjectIds) ? profile.subjectIds.map(String) : Object.keys(profile?.relationships ?? {}));
  return Object.freeze({
    profile, subject, profileRoster, sameGroupProfiles: peers, profileGroupIndex, subjectIndex,
    hasPreviousSubject: Boolean(subject && (readModel.subjects[navigationIndex - 1]?.id ?? null)),
    hasNextSubject: Boolean(subject && (readModel.subjects[navigationIndex + 1]?.id ?? null))
  });
}

export function masterProfileRosterCount(profile) {
  // Navigation counts the original roster length; editor/world count unique IDs.
  return Array.isArray(profile?.subjectIds) ? profile.subjectIds.length : Object.keys(profile?.relationships ?? {}).length;
}
