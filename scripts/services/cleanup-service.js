import { executeTransaction } from "../state/transactions.js";
import { isFullGamemaster } from "./permission-service.js";

export class CleanupService {
  static getImpact(state = {}) {
    const profiles = Object.values(state.profiles ?? {});
    const subjects = Object.values(state.subjects ?? {});
    const groups = Object.values(state.groups ?? {}).filter((g) => !g.archived);
    const history = Array.isArray(state.history) ? state.history : [];
    const groupNames = new Map(groups.map((g) => [String(g.id), String(g.name || "Grupo")]));

    const cleanupSubjects = subjects.map((subject) => {
      const id = String(subject.id);
      const relCount = profiles.filter((p) => Object.hasOwn(p.relationships ?? {}, id)).length;
      const rosterCount = profiles.filter((p) => Array.isArray(p.subjectIds) && p.subjectIds.map(String).includes(id)).length;
      return Object.freeze({
        id,
        name: String(subject.alias || subject.realName || "Sem identificação"),
        realName: String(subject.realName || ""),
        relationshipCount: relCount,
        rosterCount,
        historyCount: history.filter((e) => String(e?.subjectId || "") === id).length,
        active: subject.active !== false,
        archived: Boolean(subject.archived)
      });
    });

    const cleanupProfiles = profiles.map((profile) => {
      const id = String(profile.id);
      const groupId = profile.groupId ? String(profile.groupId) : null;
      return Object.freeze({
        id,
        name: String(profile.name || "Perfil"),
        focalName: String(profile.focal?.name || profile.name || "Perfil"),
        groupName: groupId ? (groupNames.get(groupId) || "Grupo ausente") : "Sem Grupo",
        relationshipCount: Object.keys(profile.relationships ?? {}).length,
        rosterCount: Array.isArray(profile.subjectIds) ? profile.subjectIds.length : 0,
        active: profile.active !== false,
        archived: Boolean(profile.archived)
      });
    });

    const cleanupGroups = groups.map((group) => {
      const id = String(group.id);
      return Object.freeze({
        id,
        name: String(group.name || "Grupo"),
        profileCount: profiles.filter((p) => String(p.groupId || "") === id).length,
        active: group.active !== false,
        archived: Boolean(group.archived)
      });
    });

    return Object.freeze({
      subjects: cleanupSubjects,
      profiles: cleanupProfiles,
      groups: cleanupGroups
    });
  }

  static async deleteSubjectPermanently(subjectId, actor = globalThis.game?.user) {
    if (!isFullGamemaster(actor)) throw new Error("Apenas um Gamemaster completo pode excluir permanentemente.");

    return executeTransaction({
      type: "subject-delete-permanent",
      actor,
      reason: `Exclusão permanente do personagem ${subjectId}`,
      mutate: (draft) => {
        delete draft.subjects[subjectId];
        for (const profile of Object.values(draft.profiles ?? {})) {
          if (profile.relationships) delete profile.relationships[subjectId];
          if (Array.isArray(profile.subjectIds)) {
            profile.subjectIds = profile.subjectIds.filter((id) => String(id) !== String(subjectId));
          }
        }
      }
    });
  }

  static async deleteProfilePermanently(profileId, actor = globalThis.game?.user) {
    if (!isFullGamemaster(actor)) throw new Error("Apenas um Gamemaster completo pode excluir permanentemente.");

    return executeTransaction({
      type: "profile-delete-permanent",
      actor,
      reason: `Exclusão permanente do perfil ${profileId}`,
      mutate: (draft) => {
        delete draft.profiles[profileId];
      }
    });
  }

  static async deleteGroupPermanently(groupId, actor = globalThis.game?.user) {
    if (!isFullGamemaster(actor)) throw new Error("Apenas um Gamemaster completo pode excluir permanentemente.");

    return executeTransaction({
      type: "group-delete-permanent",
      actor,
      reason: `Exclusão permanente do grupo ${groupId}`,
      mutate: (draft) => {
        delete draft.groups[groupId];
        for (const profile of Object.values(draft.profiles ?? {})) {
          if (String(profile.groupId) === String(groupId)) {
            profile.groupId = null;
          }
        }
      }
    });
  }

  static async purgeOrphanedRelationships(actor = globalThis.game?.user) {
    if (!isFullGamemaster(actor)) throw new Error("Apenas um Gamemaster completo pode purgar dados.");

    return executeTransaction({
      type: "cleanup-orphans",
      actor,
      reason: "Purga de relações órfãs",
      mutate: (draft) => {
        const validSubjectIds = new Set(Object.keys(draft.subjects ?? {}));
        for (const profile of Object.values(draft.profiles ?? {})) {
          if (profile.relationships) {
            for (const sId of Object.keys(profile.relationships)) {
              if (!validSubjectIds.has(sId)) {
                delete profile.relationships[sId];
              }
            }
          }
          if (Array.isArray(profile.subjectIds)) {
            profile.subjectIds = profile.subjectIds.filter((id) => validSubjectIds.has(String(id)));
          }
        }
      }
    });
  }

  static async purgeHistory({ keepLast = 100 } = {}, actor = globalThis.game?.user) {
    if (!isFullGamemaster(actor)) throw new Error("Apenas um Gamemaster completo pode limpar histórico.");

    return executeTransaction({
      type: "cleanup-history",
      actor,
      reason: `Purga de histórico preservando os últimos ${keepLast}`,
      mutate: (draft) => {
        if (Array.isArray(draft.history) && draft.history.length > keepLast) {
          draft.history = draft.history.slice(-keepLast);
        }
      }
    });
  }
}
