import { appendHistoryEvent, createTransactionId } from "./history-registry.js";
import { mutateWorldState, NO_STATE_CHANGE } from "../persistence/world-store.js";
import { isFullGamemaster } from "../persistence/permissions.js";

function assertPermanentDeletePermission() {
  if (!isFullGamemaster(globalThis.game?.user)) {
    throw new Error("Somente um Gamemaster completo pode apagar dados permanentemente.");
  }
}

function normalizeId(value, label) {
  const id = String(value ?? "").trim();
  if (!id) throw new Error(`${label} não informado.`);
  return id;
}

function touchProfile(profile, now = Date.now()) {
  profile.metadata ??= {};
  profile.metadata.updatedAt = now;
  profile.metadata.updatedBy = globalThis.game?.user?.id ?? null;
}

export function buildCleanupImpact(state = {}) {
  const profiles = Object.values(state.profiles ?? {});
  const subjects = Object.values(state.subjects ?? {});
  const groups = Object.values(state.groups ?? {})
    .filter((group) => !group.archived)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  const history = Array.isArray(state.history) ? state.history : [];
  const groupNames = new Map(groups.map((group) => [String(group.id), String(group.name || "Grupo")]))

  const cleanupSubjects = subjects
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.alias || a.realName || "").localeCompare(String(b.alias || b.realName || ""), "pt-BR"))
    .map((subject) => {
      const id = String(subject.id);
      const relationshipRefs = profiles.filter((profile) => Object.hasOwn(profile.relationships ?? {}, id));
      const rosterRefs = profiles.filter((profile) => Array.isArray(profile.subjectIds) && profile.subjectIds.map(String).includes(id));
      return Object.freeze({
        id,
        name: String(subject.alias || subject.realName || "Sem identificação"),
        realName: String(subject.realName || ""),
        relationshipCount: relationshipRefs.length,
        rosterCount: rosterRefs.length,
        historyCount: history.filter((event) => String(event?.subjectId || "") === id).length,
        archived: Boolean(subject.archived),
        active: subject.active !== false
      });
    });

  const cleanupProfiles = profiles
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"))
    .map((profile) => {
      const id = String(profile.id);
      const groupId = profile.groupId == null ? null : String(profile.groupId);
      return Object.freeze({
        id,
        name: String(profile.name || "Perfil"),
        focalName: String(profile.focal?.name || profile.name || "Perfil"),
        groupId,
        groupName: groupId ? (groupNames.get(groupId) || "Grupo ausente") : "Sem Grupo",
        relationshipCount: Object.keys(profile.relationships ?? {}).length,
        rosterCount: Array.isArray(profile.subjectIds) ? profile.subjectIds.length : Object.keys(profile.relationships ?? {}).length,
        historyCount: history.filter((event) => String(event?.profileId || "") === id).length,
        archived: Boolean(profile.archived),
        active: profile.active !== false
      });
    });

  const cleanupGroups = groups.map((group) => {
    const id = String(group.id);
    const memberProfiles = profiles.filter((profile) => String(profile.groupId || "") === id);
    return Object.freeze({
      id,
      name: String(group.name || "Grupo"),
      description: String(group.description || ""),
      profileCount: memberProfiles.length,
      profileNames: Object.freeze(memberProfiles.map((profile) => String(profile.name || "Perfil")))
    });
  });

  return Object.freeze({
    subjects: Object.freeze(cleanupSubjects),
    profiles: Object.freeze(cleanupProfiles),
    groups: Object.freeze(cleanupGroups)
  });
}

export async function deleteSubjectPermanently(subjectId, { reason = "" } = {}) {
  assertPermanentDeletePermission();
  const id = normalizeId(subjectId, "Personagem");
  return mutateWorldState((draft) => {
    const subject = draft.subjects?.[id];
    if (!subject) return NO_STATE_CHANGE;
    const affectedProfiles = [];
    for (const profile of Object.values(draft.profiles ?? {})) {
      let changed = false;
      if (Object.hasOwn(profile.relationships ?? {}, id)) {
        delete profile.relationships[id];
        changed = true;
      }
      if (Array.isArray(profile.subjectIds)) {
        const next = profile.subjectIds.map(String).filter((entry) => entry !== id);
        if (next.length !== profile.subjectIds.length) {
          profile.subjectIds = next;
          changed = true;
        }
      }
      if (changed) {
        affectedProfiles.push(String(profile.id));
        touchProfile(profile);
      }
    }
    const snapshot = {
      subjectId: id,
      alias: String(subject.alias || ""),
      realName: String(subject.realName || ""),
      affectedProfiles: [...affectedProfiles]
    };
    delete draft.subjects[id];
    appendHistoryEvent(draft, {
      type: "subject-delete",
      before: snapshot,
      after: { deleted: true, affectedProfileCount: affectedProfiles.length },
      reason: String(reason || "Exclusão permanente pelo Gerenciador de Limpeza").trim(),
      transactionId: createTransactionId("subject-delete")
    });
  });
}

export async function deleteProfilePermanently(profileId, { reason = "" } = {}) {
  assertPermanentDeletePermission();
  const id = normalizeId(profileId, "Perfil");
  return mutateWorldState((draft) => {
    const profile = draft.profiles?.[id];
    if (!profile) return NO_STATE_CHANGE;
    const snapshot = {
      profileId: id,
      name: String(profile.name || "Perfil"),
      focalName: String(profile.focal?.name || profile.name || "Perfil"),
      groupId: profile.groupId ?? null,
      relationshipCount: Object.keys(profile.relationships ?? {}).length,
      rosterCount: Array.isArray(profile.subjectIds) ? profile.subjectIds.length : Object.keys(profile.relationships ?? {}).length
    };
    delete draft.profiles[id];
    appendHistoryEvent(draft, {
      type: "profile-delete",
      before: snapshot,
      after: { deleted: true },
      reason: String(reason || "Exclusão permanente pelo Gerenciador de Limpeza").trim(),
      transactionId: createTransactionId("profile-delete")
    });
  });
}

export async function deleteGroupPermanently(groupId, { reason = "" } = {}) {
  assertPermanentDeletePermission();
  const id = normalizeId(groupId, "Grupo");
  if (id === "__ungrouped__") throw new Error("O grupo de sistema “Sem Grupo” não pode ser apagado.");
  return mutateWorldState((draft) => {
    const group = draft.groups?.[id];
    if (!group) return NO_STATE_CHANGE;
    const movedProfiles = [];
    const now = Date.now();
    for (const profile of Object.values(draft.profiles ?? {})) {
      if (String(profile.groupId || "") !== id) continue;
      profile.groupId = null;
      touchProfile(profile, now);
      movedProfiles.push(String(profile.id));
    }
    const snapshot = {
      groupId: id,
      name: String(group.name || "Grupo"),
      profileIds: [...movedProfiles]
    };
    delete draft.groups[id];
    appendHistoryEvent(draft, {
      type: "group-delete",
      before: snapshot,
      after: { deleted: true, movedToUngrouped: movedProfiles.length },
      reason: String(reason || "Exclusão permanente pelo Gerenciador de Limpeza").trim(),
      transactionId: createTransactionId("group-delete")
    });
  });
}
