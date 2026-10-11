import { buildCleanupImpact } from "../../../data/destructive-operations.js";
import { listHistory } from "../../../data/history-registry.js";
import { buildUndoRedoState } from "../../../data/undo-redo.js";
import { masterProfileRosterCount } from "../../../application/queries/master-panel-query.js";
import { SECTIONS, WORKSPACE_PANELS } from "../workspaces.js";

/** Navigation counts/history are needed even when their panels are currently hidden. */
export function buildMasterNavigationContext(state, readModel, entries, { sectionId, permissions }) {
  const { profiles, subjects, groups } = readModel;
  const { profile, subject } = entries;
  const history = listHistory({ state, profileId: profile?.id, subjectId: subject?.id, limit: 80 });
  const undoRedo = buildUndoRedoState(state);
  const cleanup = sectionId === "cleanup" && permissions.isFullGM ? buildCleanupImpact(state) : { subjects: [], profiles: [], groups: [] };
  const sectionCounts = { profiles: profiles.length, characters: subjects.length, relationship: masterProfileRosterCount(profile), history: history.length, cleanup: subjects.length + profiles.length + groups.length, settings: "" };
  return Object.freeze({
    navigationKind: "master",
    navigationPlaceholder: "Área, perfil ou personagem…",
    activeSectionLabel: SECTIONS.find(([id]) => id === sectionId)?.[1] ?? "Perfis",
    subjectPosition: subject ? entries.subjectIndex + 1 : 0,
    hasPreviousSubject: entries.hasPreviousSubject,
    hasNextSubject: entries.hasNextSubject,
    sections: Object.freeze(SECTIONS
      .filter(([id]) => id !== "cleanup" || permissions.isFullGM)
      .map(([id, label, icon, kicker]) => Object.freeze({ id, label, icon, kicker, active: id === sectionId, count: sectionCounts[id], controls: WORKSPACE_PANELS[id].map((panel) => `gms-workspace-${panel}`).join(" ") }))),
    cleanup,
    activeSection: sectionId,
    history,
    undoRedo,
  });
}
