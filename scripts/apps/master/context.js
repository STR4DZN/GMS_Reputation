import { loadWorldState } from "../../persistence/world-store.js";
import { buildMasterPanelReadModel, selectMasterPanelEntries } from "../../application/queries/master-panel-query.js";
import { normalizeWorkspace } from "./workspaces.js";
import { buildMasterRegistryContext } from "./context/registry.js";
import { buildMasterRelationshipContext } from "./context/relationship.js";
import { buildMasterSystemContext } from "./context/system.js";
import { buildMasterNavigationContext } from "./context/navigation.js";

export function normalizeUiSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Public facade: complete context, one read model, no persistent cache or data writes. */
export function buildMasterPanelContext({ profileId = "", subjectId = "", activeSection = "profiles", newProfileGroupId = "", settingsTab = "general", state = loadWorldState() } = {}) {
  const readModel = buildMasterPanelReadModel(state);
  const entries = selectMasterPanelEntries(readModel, { profileId, subjectId });
  const sectionId = normalizeWorkspace(activeSection);
  const registry = buildMasterRegistryContext(readModel, entries, { newProfileGroupId });
  const relationship = buildMasterRelationshipContext(entries);
  const system = buildMasterSystemContext(state, readModel, entries, { sectionId, settingsTab });
  const navigation = buildMasterNavigationContext(state, readModel, entries, { sectionId, permissions: system.permissions });
  // Keep the public property order as well as values and component contracts.
  return Object.freeze({
    authorized: system.authorized,
    permissions: system.permissions,
    permissionRoles: system.permissionRoles,
    profileId: entries.profile?.id ?? "",
    subjectId: entries.subject?.id ?? "",
    newProfileGroupId: registry.newProfileGroupId,
    profileName: entries.profile?.name ?? "Sem perfil",
    personalReputation: system.personalReputation,
    playerBindings: system.playerBindings,
    settingsTabs: system.settingsTabs,
    navigationKind: navigation.navigationKind,
    navigationPlaceholder: navigation.navigationPlaceholder,
    activeSectionLabel: navigation.activeSectionLabel,
    subjectPosition: navigation.subjectPosition,
    hasPreviousSubject: navigation.hasPreviousSubject,
    hasNextSubject: navigation.hasNextSubject,
    profileEditor: registry.profileEditor,
    profiles: registry.profiles,
    profileSelector: registry.profileSelector,
    groups: registry.groups,
    profileGroups: registry.profileGroups,
    newProfileGroupSelector: registry.newProfileGroupSelector,
    profileGroupSelector: registry.profileGroupSelector,
    profileGroupChoices: registry.profileGroupChoices,
    newProfileGroupChoices: registry.newProfileGroupChoices,
    subjects: registry.subjects,
    subjectEditor: registry.subjectEditor,
    subjectSelector: registry.subjectSelector,
    sections: navigation.sections,
    cleanup: navigation.cleanup,
    activeSection: navigation.activeSection,
    hasSelection: relationship.hasSelection,
    selection: relationship.selection,
    focal: relationship.focal,
    focalEditor: relationship.focalEditor,
    focalName: relationship.focalName,
    focalDescription: relationship.focalDescription,
    history: navigation.history,
    undoRedo: navigation.undoRedo,
    savePreferences: system.savePreferences,
    world: system.world,
  });
}
