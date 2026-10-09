import { DATA_SCHEMA_VERSION, MASTER_SAVE_MODE, MODULE_VERSION } from "../../constants.js";
import { loadWorldState, loadWorldStateBackup } from "../../persistence/world-store.js";
import { buildIdentityModel } from "../../components/identity.js";
import { buildPortraitFrameModel } from "../../components/portrait-frame.js";
import { buildPortraitEditorContext } from "../../components/portrait-editor.js";
import { buildHeartTrackModel } from "../../components/heart-track.js";
import { buildFocalProfileContext } from "../../components/focal-profile.js";
import { getReputationView } from "../../core/reputation-engine.js";
import { getSemanticBand } from "../../core/semantic-bands.js";
import { buildCleanupImpact } from "../../data/destructive-operations.js";
import { listHistory } from "../../data/history-registry.js";
import { buildUndoRedoState } from "../../data/undo-redo.js";
import { getMasterAutoSaveDelay, getMasterSaveMode } from "../../persistence/master-preferences.js";
import { permissionContext } from "../../persistence/permissions.js";
import { buildSmartSelectorContext } from "../../components/smart-selector.js";
import { adjacentId } from "../../ui/navigation.js";
import { buildPlayerBindingsContext, getPersonalReputationStatus } from "../../persistence/personal-reputation.js";
import { SECTIONS, WORKSPACE_PANELS, normalizeWorkspace } from "./workspaces.js";

function listProfiles(state) {
  return Object.values(state.profiles ?? {}).sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name), "pt-BR"));
}

function listSubjects(state) {
  return Object.values(state.subjects ?? {}).sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.realName).localeCompare(String(b.realName), "pt-BR"));
}

function listGroups(state) {
  return Object.values(state.groups ?? {})
    .filter((group) => !group.archived)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name), "pt-BR"));
}

function profileRosterCount(profile) {
  return Array.isArray(profile?.subjectIds) ? profile.subjectIds.length : Object.keys(profile?.relationships ?? {}).length;
}

export function normalizeUiSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function quickPresets(limit = 10) {
  const values = [-10, -5, 0, 3, 6, 9, Number(limit) || 10];
  const labels = ["Hostil", "Cautela", "Neutro", "Contato", "Confiança", "Aliado", "Máximo"];
  return Object.freeze(values.map((value, index) => {
    const band = getSemanticBand(value, { bond: Number(limit) > 10 });
    return Object.freeze({ value, label: labels[index], tone: band.id, accent: band.accent });
  }));
}

function saveModeOptions(current) {
  return Object.freeze([
    { value: MASTER_SAVE_MODE.MANUAL, label: "Manual", selected: current === MASTER_SAVE_MODE.MANUAL },
    { value: MASTER_SAVE_MODE.AUTOMATIC, label: "Automático", selected: current === MASTER_SAVE_MODE.AUTOMATIC },
    { value: MASTER_SAVE_MODE.IDLE, label: "Após pausa", selected: current === MASTER_SAVE_MODE.IDLE }
  ].map(Object.freeze));
}

function backupStatus() {
  try {
    const backup = loadWorldStateBackup();
    if (!backup) return Object.freeze({ available: false, revision: null, updatedAtText: "Nenhum backup disponível" });
    const stamp = Number(backup.metadata?.updatedAt) || Number(backup.metadata?.createdAt) || 0;
    const updatedAtText = stamp ? new Date(stamp).toLocaleString("pt-BR") : "Data indisponível";
    return Object.freeze({ available: true, revision: Number(backup.revision) || 0, updatedAtText });
  } catch (_error) {
    return Object.freeze({ available: false, revision: null, updatedAtText: "Backup indisponível" });
  }
}

export function buildMasterPanelContext({ profileId = "", subjectId = "", activeSection = "profiles", newProfileGroupId = "", settingsTab = "general", state = loadWorldState() } = {}) {
  const profiles = listProfiles(state);
  const subjects = listSubjects(state);
  const groups = listGroups(state);
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const profile = profiles.find((entry) => entry.id === String(profileId)) ?? profiles[0] ?? null;
  const subject = subjects.find((entry) => entry.id === String(subjectId)) ?? subjects[0] ?? null;
  const relationship = profile && subject ? (profile.relationships?.[subject.id] ?? { subjectId: subject.id, score: 0 }) : null;
  const view = relationship ? getReputationView(relationship) : null;
  const sectionId = normalizeWorkspace(activeSection);
  const history = listHistory({ state, profileId: profile?.id, subjectId: subject?.id, limit: 80 });
  const undoRedo = buildUndoRedoState(state);
  const saveMode = getMasterSaveMode();
  const idleDelay = getMasterAutoSaveDelay();
  const permissions = permissionContext();
  const backup = backupStatus();
  const cleanup = sectionId === "cleanup" && permissions.isFullGM ? buildCleanupImpact(state) : { subjects: [], profiles: [], groups: [] };
  const sectionCounts = { profiles: profiles.length, characters: subjects.length, relationship: profileRosterCount(profile), history: history.length, cleanup: subjects.length + profiles.length + groups.length, settings: "" };

  const profilesByGroup = new Map(groups.map((group) => [group.id, []]));
  const ungroupedProfiles = [];
  for (const entry of profiles) {
    const bucket = entry.groupId ? profilesByGroup.get(entry.groupId) : null;
    if (bucket) bucket.push(entry);
    else ungroupedProfiles.push(entry);
  }
  const profileGroups = groups.map((group, index) => {
    const entries = profilesByGroup.get(group.id) ?? [];
    return Object.freeze({
      id: group.id,
      name: group.name,
      description: group.description || "",
      system: false,
      canMoveUp: index > 0,
      canMoveDown: index < groups.length - 1,
      profiles: Object.freeze(entries.map((entry) => Object.freeze({
        id: entry.id,
        name: String(entry.name || "Perfil"),
        focalName: String(entry.focal?.name || entry.name || "Perfil"),
        image: String(entry.focal?.portrait?.src || ""),
        active: entry.active !== false,
        archived: Boolean(entry.archived),
        selected: entry.id === profile?.id
      })))
    });
  });
  profileGroups.push(Object.freeze({
    id: "__ungrouped__",
    name: "Sem Grupo",
    description: "Perfis ainda não organizados em uma categoria.",
    system: true,
    canMoveUp: false,
    canMoveDown: false,
    profiles: Object.freeze(ungroupedProfiles.map((entry) => Object.freeze({
      id: entry.id,
      name: String(entry.name || "Perfil"),
      focalName: String(entry.focal?.name || entry.name || "Perfil"),
      image: String(entry.focal?.portrait?.src || ""),
      active: entry.active !== false,
      archived: Boolean(entry.archived),
      selected: entry.id === profile?.id
    })))
  }));

  const groupSelectorItems = [
    { value: "__ungrouped__", primary: "Sem Grupo", secondary: "Perfil ainda não classificado", badge: "SISTEMA" },
    ...groups.map((group) => ({
      value: group.id,
      primary: group.name,
      secondary: `${(profilesByGroup.get(group.id) ?? []).length} perfil(is)`,
      badge: "GRUPO"
    }))
  ];
  const initialNewProfileGroup = groupSelectorItems.some((item) => item.value === String(newProfileGroupId))
    ? String(newProfileGroupId)
    : (groups[0]?.id ?? "__ungrouped__");
  const selectedProfileGroup = profile?.groupId && groupMap.has(profile.groupId) ? profile.groupId : "__ungrouped__";
  const profileRoster = new Set(Array.isArray(profile?.subjectIds) ? profile.subjectIds.map(String) : Object.keys(profile?.relationships ?? {}));
  const profileGroupChoices = Object.freeze(groupSelectorItems.map((item) => Object.freeze({
    ...item,
    active: String(item.value) === String(selectedProfileGroup)
  })));
  const sameGroupProfiles = profile
    ? profiles.filter((entry) => (entry.groupId ?? null) === (profile.groupId ?? null))
    : [];
  const profileGroupIndex = profile ? sameGroupProfiles.findIndex((entry) => entry.id === profile.id) : -1;
  const profileEditor = profile ? Object.freeze({
    id: profile.id,
    name: String(profile.name || "Perfil"),
    focalName: String(profile.focal?.name || profile.name || "Perfil focal"),
    groupId: selectedProfileGroup,
    groupName: selectedProfileGroup === "__ungrouped__" ? "Sem Grupo" : String(groupMap.get(selectedProfileGroup)?.name || "Sem Grupo"),
    active: profile.active !== false,
    archived: Boolean(profile.archived),
    sortOrder: Number(profile.sortOrder) || 0,
    canMoveUp: profileGroupIndex > 0,
    canMoveDown: profileGroupIndex >= 0 && profileGroupIndex < sameGroupProfiles.length - 1,
    rosterCount: profileRoster.size,
    relationshipCount: Object.keys(profile.relationships ?? {}).length,
    totalSubjects: subjects.length,
    updatedAtText: profile.metadata?.updatedAt ? new Date(Number(profile.metadata.updatedAt)).toLocaleString("pt-BR") : "Sem registro"
  }) : null;
  const newProfileGroupChoices = Object.freeze(groupSelectorItems.map((item) => Object.freeze({
    ...item,
    active: String(item.value) === String(initialNewProfileGroup)
  })));

  return Object.freeze({
    authorized: permissions.canOpenMaster,
    permissions,
    permissionRoles: Object.freeze([
      Object.freeze({ id: "assistant", label: "Assistant GM", policy: permissions.config.assistant }),
      Object.freeze({ id: "trusted", label: "Trusted Player", policy: permissions.config.trusted })
    ]),
    profileId: profile?.id ?? "",
    subjectId: subject?.id ?? "",
    newProfileGroupId: initialNewProfileGroup,
    profileName: profile?.name ?? "Sem perfil",
    personalReputation: getPersonalReputationStatus(state),
    playerBindings: sectionId === "settings" ? buildPlayerBindingsContext(state) : [],
    settingsTabs: [{ id: "general", label: "Geral", active: settingsTab !== "players" }, { id: "players", label: "Jogadores e perfis", active: settingsTab === "players" }],
    navigationKind: "master",
    navigationPlaceholder: "Área, perfil ou personagem…",
    activeSectionLabel: SECTIONS.find(([id]) => id === sectionId)?.[1] ?? "Perfis",
    subjectPosition: subject ? subjects.findIndex((entry) => entry.id === subject.id) + 1 : 0,
    hasPreviousSubject: Boolean(subject && adjacentId(subjects, subject.id, -1)),
    hasNextSubject: Boolean(subject && adjacentId(subjects, subject.id, 1)),
    profileEditor,
    profiles: Object.freeze(profiles.map((entry) => Object.freeze({
      id: entry.id,
      name: entry.name,
      groupId: entry.groupId ?? null,
      groupName: entry.groupId && groupMap.has(entry.groupId) ? groupMap.get(entry.groupId).name : "Sem Grupo",
      selected: entry.id === profile?.id,
      archived: entry.archived
    }))),
    profileSelector: buildSmartSelectorContext({
      id: "master-profile",
      label: "Perfil",
      value: profile?.id ?? "",
      searchPlaceholder: "Buscar perfil…",
      emptyText: "Nenhum perfil corresponde à busca.",
      items: profiles.map((entry) => ({
        value: entry.id,
        primary: String(entry.focal?.name || entry.name || "Perfil"),
        secondary: [
          entry.focal?.name && entry.name !== entry.focal.name ? String(entry.name) : "Perfil social",
          entry.groupId && groupMap.has(entry.groupId) ? groupMap.get(entry.groupId).name : "Sem Grupo"
        ].join(" // "),
        badge: entry.archived ? "ARQUIVADO" : entry.id === profile?.id ? "ATIVO" : "",
        image: String(entry.focal?.portrait?.src || "")
      }))
    }),
    groups: Object.freeze(groups.map((group) => Object.freeze({ id: group.id, name: group.name, sortOrder: group.sortOrder }))),
    profileGroups: Object.freeze(profileGroups),
    newProfileGroupSelector: buildSmartSelectorContext({
      id: "master-new-profile-group",
      label: "Grupo do novo perfil",
      value: initialNewProfileGroup,
      searchable: groups.length >= 6,
      items: groupSelectorItems
    }),
    profileGroupSelector: buildSmartSelectorContext({
      id: "master-profile-group",
      label: "Grupo do perfil atual",
      value: selectedProfileGroup,
      searchable: groups.length >= 6,
      items: groupSelectorItems
    }),
    profileGroupChoices,
    newProfileGroupChoices,
    subjects: Object.freeze(subjects.map((entry) => Object.freeze({
      id: entry.id,
      alias: String(entry.alias || entry.realName || "Sem identificação"),
      realName: String(entry.realName || ""),
      active: entry.active !== false,
      archived: Boolean(entry.archived),
      selected: entry.id === subject?.id,
      inProfile: profileRoster.has(String(entry.id))
    }))),
    subjectEditor: subject ? Object.freeze({
      id: subject.id,
      alias: String(subject.alias || subject.realName || "Sem identificação"),
      realName: String(subject.realName || ""),
      description: String(subject.description || ""),
      tagsText: Array.isArray(subject.metadata?.tags) ? subject.metadata.tags.join(", ") : "",
      active: subject.active !== false,
      archived: Boolean(subject.archived),
      canMoveUp: subjects.findIndex((entry) => entry.id === subject.id) > 0,
      canMoveDown: subjects.findIndex((entry) => entry.id === subject.id) >= 0 && subjects.findIndex((entry) => entry.id === subject.id) < subjects.length - 1
    }) : null,
    subjectSelector: buildSmartSelectorContext({
      id: "master-subject",
      label: "Personagem",
      value: subject?.id ?? "",
      searchPlaceholder: "Buscar personagem…",
      emptyText: "Nenhum personagem corresponde à busca.",
      items: subjects.map((entry) => ({
        value: entry.id,
        primary: String(entry.alias || entry.realName || "Sem identificação"),
        secondary: String(entry.realName || "Personagem avaliado"),
        badge: entry.archived ? "ARQUIVADO" : entry.active === false ? "INATIVO" : !profileRoster.has(String(entry.id)) ? "FORA DO PERFIL" : entry.id === subject?.id ? "ATIVO" : "",
        image: String(entry.portrait?.src || "")
      }))
    }),
    sections: Object.freeze(SECTIONS
      .filter(([id]) => id !== "cleanup" || permissions.isFullGM)
      .map(([id, label, icon, kicker]) => Object.freeze({ id, label, icon, kicker, active: id === sectionId, count: sectionCounts[id], controls: WORKSPACE_PANELS[id].map((panel) => `gms-workspace-${panel}`).join(" ") }))),
    cleanup,
    activeSection: sectionId,
    hasSelection: Boolean(profile && subject),
    selection: profile && subject ? Object.freeze({
      identity: buildIdentityModel(subject),
      portrait: buildPortraitFrameModel(subject.portrait, { kind: "master-subject", label: `Retrato de ${subject.alias || subject.realName}`, lazy: false }),
      portraitEditor: buildPortraitEditorContext(subject.portrait, { kind: "subject", label: `Retrato de ${subject.alias || subject.realName}` }),
      relationLabel: view.band.label,
      relationBand: view.band.id,
      relationCode: view.band.code,
      relationAccent: view.band.accent,
      polarity: view.polarity,
      score: view.score,
      scoreLimit: view.scoreLimit,
      hearts: buildHeartTrackModel(view.relationship),
      quickPresets: quickPresets(view.scoreLimit),
      special: Object.freeze({
        active: Boolean(view.special.presentation?.active),
        state: view.special.state,
        label: String(view.special.presentation?.compactLabel || view.special.presentation?.label || "Nenhum"),
        sigilAsset: String(view.special.presentation?.sigilAsset || ""),
        bondActive: Boolean(view.special.bondActive),
        communionActive: Boolean(view.special.communionActive),
        dualSyncActive: Boolean(view.special.dualSyncActive)
      }),
      portraitSource: String(subject.portrait?.src || ""),
      portraitZoom: Number(subject.portrait?.zoom) || 100,
      portraitX: Number(subject.portrait?.x) || 50,
      portraitY: Number(subject.portrait?.y) || 50
    }) : null,
    focal: profile ? buildFocalProfileContext(profile) : null,
    focalEditor: profile ? buildPortraitEditorContext(profile.focal?.portrait, { kind: "focal", label: `Retrato focal de ${profile.focal?.name || profile.name || "perfil"}` }) : null,
    focalName: profile ? String(profile.focal?.name || profile.name || "") : "",
    focalDescription: profile ? String(profile.focal?.description || "") : "",
    history,
    undoRedo,
    savePreferences: Object.freeze({
      mode: saveMode,
      idleDelay,
      modeOptions: saveModeOptions(saveMode),
      idleMode: saveMode === MASTER_SAVE_MODE.IDLE
    }),
    world: Object.freeze({
      revision: Number(state.revision) || 0,
      schemaVersion: DATA_SCHEMA_VERSION,
      moduleVersion: MODULE_VERSION,
      groupCount: groups.length,
      subjectCount: subjects.length,
      profileRosterCount: profileRoster.size,
      profileCount: profiles.length,
      historyCount: Array.isArray(state.history) ? state.history.length : 0,
      backup
    })
  });
}
