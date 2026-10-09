import { buildSmartSelectorContext } from "../../../components/smart-selector.js";

/** Registry presentation shares ordered indexes with navigation and relationship context. */
export function buildMasterRegistryContext(readModel, entries, { newProfileGroupId = "" } = {}) {
  const { profiles, subjects, groups, groupMap, profilesByGroup, ungroupedProfiles } = readModel;
  const { profile, subject, profileRoster, sameGroupProfiles, profileGroupIndex, subjectIndex } = entries;
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
  const profileGroupChoices = Object.freeze(groupSelectorItems.map((item) => Object.freeze({
    ...item,
    active: String(item.value) === String(selectedProfileGroup)
  })));
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
    newProfileGroupId: initialNewProfileGroup,
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
      canMoveUp: subjectIndex > 0,
      canMoveDown: subjectIndex >= 0 && subjectIndex < subjects.length - 1
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
  });
}
