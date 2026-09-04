import { createProfile } from "./schema.js";
import { normalizePortrait, portraitEquals } from "../core/portrait.js";
import { loadWorldState, mutateWorldState, NO_STATE_CHANGE } from "../persistence/world-store.js";
import { MODULE_CAPABILITY, canUser } from "../persistence/permissions.js";
import { appendHistoryEvent, createTransactionId } from "./history-registry.js";

function normalizeFocalDescription(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 12000);
}

function normalizeFocalName(value, fallback = "Perfil focal") {
  return String(value ?? fallback).trim().slice(0, 240) || String(fallback || "Perfil focal").trim().slice(0, 240);
}

function focalEquals(left = {}, right = {}) {
  return normalizeFocalName(left.name) === normalizeFocalName(right.name)
    && normalizeFocalDescription(left.description) === normalizeFocalDescription(right.description)
    && portraitEquals(left.portrait, right.portrait);
}

function randomToken(length = 10) {
  const foundryRandom = globalThis.foundry?.utils?.randomID;
  if (typeof foundryRandom === "function") return foundryRandom(length);
  return Math.random().toString(36).slice(2, 2 + length).padEnd(length, "0");
}

function nextProfileId(profiles = {}) {
  let id;
  do id = `gms-profile-${randomToken(10)}`;
  while (Object.hasOwn(profiles, id));
  return id;
}

function nextSortOrder(profiles = {}) {
  const values = Object.values(profiles).map((profile) => Number(profile.sortOrder) || 0);
  return (values.length ? Math.max(...values) : 0) + 10;
}

export function getProfile(profileId) {
  const id = String(profileId ?? "").trim();
  const profile = loadWorldState().profiles?.[id];
  return profile ? createProfile({ ...profile, id }) : null;
}

/** Creates a new reputation perspective and fills neutral Relationships for every existing Subject. */
export async function createNewProfile({ name, focalName = "", groupId = null } = {}, { reason = "" } = {}) {
  const profileName = String(name ?? "").trim().slice(0, 240);
  const focal = normalizeFocalName(focalName || profileName, profileName || "Novo perfil");
  const gid = groupId == null || groupId === "" || groupId === "__ungrouped__" ? null : String(groupId);
  if (!profileName) throw new Error("Informe um nome para o perfil de reputação.");

  return mutateWorldState((draft) => {
    draft.profiles ??= {};
    if (gid && !draft.groups?.[gid]) throw new Error("Grupo de perfis de destino não encontrado.");
    const duplicate = Object.values(draft.profiles).some((profile) => !profile.archived && String(profile.name).localeCompare(profileName, "pt-BR", { sensitivity: "base" }) === 0);
    if (duplicate) throw new Error(`Já existe um perfil chamado “${profileName}”.`);
    const id = nextProfileId(draft.profiles);
    const relationships = {};
    for (const subject of Object.values(draft.subjects ?? {})) relationships[subject.id] = { subjectId: subject.id, score: 0 };
    draft.profiles[id] = createProfile({
      id,
      name: profileName,
      groupId: gid,
      focal: { name: focal, portrait: {}, description: "" },
      relationships,
      sortOrder: nextSortOrder(draft.profiles),
      metadata: { createdBy: globalThis.game?.user?.id ?? null, updatedBy: globalThis.game?.user?.id ?? null }
    });
    appendHistoryEvent(draft, {
      profileId: id,
      type: "profile-create",
      before: null,
      after: { profileId: id, name: profileName, focalName: focal, groupId: gid },
      reason,
      transactionId: createTransactionId("profile")
    });
  });
}

export async function renameProfile(profileId, name, { reason = "" } = {}) {
  const pid = String(profileId ?? "").trim();
  const normalizedName = String(name ?? "").trim().slice(0, 240);
  if (!pid || !normalizedName) throw new Error("Perfil e nome são obrigatórios.");
  return mutateWorldState((draft) => {
    const profile = draft.profiles?.[pid];
    if (!profile) throw new Error("Perfil não encontrado.");
    if (String(profile.name || "") === normalizedName) return NO_STATE_CHANGE;
    const duplicate = Object.values(draft.profiles ?? {}).some((entry) => entry.id !== pid && !entry.archived && String(entry.name || "").localeCompare(normalizedName, "pt-BR", { sensitivity: "base" }) === 0);
    if (duplicate) throw new Error(`Já existe um perfil chamado “${normalizedName}”.`);
    const before = String(profile.name || "");
    profile.name = normalizedName;
    profile.metadata ??= {};
    profile.metadata.updatedAt = Date.now();
    profile.metadata.updatedBy = globalThis.game?.user?.id ?? null;
    appendHistoryEvent(draft, {
      profileId: pid,
      type: "profile-update",
      before: { name: before },
      after: { name: normalizedName },
      reason,
      transactionId: createTransactionId("profile")
    });
  });
}

export async function setProfileGroup(profileId, groupId = null, { reason = "" } = {}) {
  const pid = String(profileId ?? "").trim();
  const gid = groupId == null || groupId === "" || groupId === "__ungrouped__" ? null : String(groupId).trim();
  if (!pid) throw new Error("Perfil não informado.");
  return mutateWorldState((draft) => {
    const profile = draft.profiles?.[pid];
    if (!profile) throw new Error("Perfil não encontrado.");
    if (gid && !draft.groups?.[gid]) throw new Error("Grupo de perfis de destino não encontrado.");
    const beforeGroupId = profile.groupId ?? null;
    if (beforeGroupId === gid) return NO_STATE_CHANGE;
    const beforeGroupName = beforeGroupId ? String(draft.groups?.[beforeGroupId]?.name || beforeGroupId) : "Sem Grupo";
    const afterGroupName = gid ? String(draft.groups?.[gid]?.name || gid) : "Sem Grupo";
    profile.groupId = gid;
    profile.metadata ??= {};
    profile.metadata.updatedAt = Date.now();
    profile.metadata.updatedBy = globalThis.game?.user?.id ?? null;
    appendHistoryEvent(draft, {
      profileId: pid,
      type: "profile-group",
      before: { groupId: beforeGroupId, groupName: beforeGroupName },
      after: { groupId: gid, groupName: afterGroupName },
      reason,
      transactionId: createTransactionId("profile-group")
    });
  });
}


/** Hotfix 49.8.6 — edita o Perfil como entidade, separado do Focal. */
export async function updateProfile(profileId, patch = {}, { reason = "" } = {}) {
  const pid = String(profileId ?? "").trim();
  if (!pid) throw new Error("Perfil não informado.");
  return mutateWorldState((draft) => {
    const profile = draft.profiles?.[pid];
    if (!profile) throw new Error("Perfil não encontrado.");

    const before = {
      name: String(profile.name || ""),
      groupId: profile.groupId ?? null,
      active: profile.active !== false,
      archived: Boolean(profile.archived),
      sortOrder: Number(profile.sortOrder) || 0
    };

    const nextName = patch.name === undefined ? before.name : String(patch.name ?? "").trim().slice(0, 240);
    if (!nextName) throw new Error("Informe um nome para o perfil de reputação.");
    const nextGroupId = patch.groupId === undefined
      ? before.groupId
      : (patch.groupId == null || patch.groupId === "" || patch.groupId === "__ungrouped__" ? null : String(patch.groupId).trim());
    if (nextGroupId && !draft.groups?.[nextGroupId]) throw new Error("Grupo de perfis de destino não encontrado.");
    const duplicate = Object.values(draft.profiles ?? {}).some((entry) => entry.id !== pid && !entry.archived && String(entry.name || "").localeCompare(nextName, "pt-BR", { sensitivity: "base" }) === 0);
    if (duplicate) throw new Error(`Já existe um perfil chamado “${nextName}”.`);

    const nextArchived = patch.archived === undefined ? before.archived : Boolean(patch.archived);
    const nextActive = nextArchived ? false : (patch.active === undefined ? before.active : Boolean(patch.active));
    const after = {
      name: nextName,
      groupId: nextGroupId,
      active: nextActive,
      archived: nextArchived,
      sortOrder: before.sortOrder
    };
    if (JSON.stringify(before) === JSON.stringify(after)) return NO_STATE_CHANGE;

    profile.name = after.name;
    profile.groupId = after.groupId;
    profile.active = after.active;
    profile.archived = after.archived;
    profile.metadata ??= {};
    profile.metadata.updatedAt = Date.now();
    profile.metadata.updatedBy = globalThis.game?.user?.id ?? null;

    const groupName = (groupId) => groupId ? String(draft.groups?.[groupId]?.name || groupId) : "Sem Grupo";
    appendHistoryEvent(draft, {
      profileId: pid,
      type: "profile-update",
      before: { ...before, groupName: groupName(before.groupId) },
      after: { ...after, groupName: groupName(after.groupId) },
      reason,
      transactionId: createTransactionId("profile-update")
    });
  });
}

/** Move o Perfil um passo dentro do próprio Grupo. */
export async function moveProfileOneStep(profileId, direction = "up", { reason = "" } = {}) {
  const pid = String(profileId ?? "").trim();
  const step = String(direction) === "down" ? 1 : -1;
  if (!pid) throw new Error("Perfil não informado.");
  return mutateWorldState((draft) => {
    const profile = draft.profiles?.[pid];
    if (!profile) throw new Error("Perfil não encontrado.");
    const groupId = profile.groupId ?? null;
    const peers = Object.values(draft.profiles ?? {})
      .filter((entry) => (entry.groupId ?? null) === groupId)
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
    const index = peers.findIndex((entry) => entry.id === pid);
    const target = peers[index + step];
    if (index < 0 || !target) return NO_STATE_CHANGE;
    const before = { sortOrder: Number(profile.sortOrder) || 0, peerId: target.id, peerSortOrder: Number(target.sortOrder) || 0 };
    const ownOrder = Number(profile.sortOrder) || 0;
    profile.sortOrder = Number(target.sortOrder) || 0;
    target.sortOrder = ownOrder;
    const now = Date.now();
    for (const entry of [profile, target]) {
      entry.metadata ??= {};
      entry.metadata.updatedAt = now;
      entry.metadata.updatedBy = globalThis.game?.user?.id ?? null;
    }
    appendHistoryEvent(draft, {
      profileId: pid,
      type: "profile-reorder",
      before,
      after: { sortOrder: Number(profile.sortOrder) || 0, peerId: target.id, peerSortOrder: Number(target.sortOrder) || 0 },
      reason,
      transactionId: createTransactionId("profile-reorder")
    });
  });
}

/** BLOCO 24 — leitura do Player: dados puros, sem qualquer capacidade de escrita. */
export function getFocalProfile(profileId) {
  const profile = getProfile(profileId);
  if (!profile) return null;
  return Object.freeze({
    profileId: profile.id,
    name: normalizeFocalName(profile.focal?.name, profile.name),
    portrait: Object.freeze(normalizePortrait(profile.focal?.portrait)),
    description: normalizeFocalDescription(profile.focal?.description)
  });
}

/** BLOCO 24 — porta de configuração do Mestre. Players falham antes de tocar no WorldState. */
export async function updateFocalProfile(profileId, patch = {}) {
  if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.FOCAL)) {
    throw new Error("Sua função atual não possui permissão para configurar o perfil focal.");
  }
  const id = String(profileId ?? "").trim();
  if (!id) throw new Error("profileId is required.");
  return mutateWorldState((draft) => {
    const profile = draft.profiles?.[id];
    if (!profile) throw new Error(`Profile ${id} was not found.`);
    const current = {
      name: normalizeFocalName(profile.focal?.name, profile.name),
      portrait: normalizePortrait(profile.focal?.portrait),
      description: normalizeFocalDescription(profile.focal?.description)
    };
    const next = {
      name: patch.name === undefined ? current.name : normalizeFocalName(patch.name, profile.name),
      portrait: patch.portrait === undefined ? current.portrait : normalizePortrait(patch.portrait),
      description: patch.description === undefined ? current.description : normalizeFocalDescription(patch.description)
    };
    if (focalEquals(current, next)) return NO_STATE_CHANGE;
    profile.focal = next;
    const now = Date.now();
    profile.metadata ??= {};
    profile.metadata.updatedAt = now;
    profile.metadata.updatedBy = globalThis.game?.user?.id ?? null;
  });
}

/** Hotfix 49.7 — controla quais personagens aparecem neste Perfil sem apagar a Relationship. */
export async function setProfileSubjectIncluded(profileId, subjectId, included = true, { reason = "" } = {}) {
  const pid = String(profileId ?? "").trim();
  const sid = String(subjectId ?? "").trim();
  if (!pid || !sid) throw new Error("Perfil e personagem são obrigatórios.");
  return mutateWorldState((draft) => {
    const profile = draft.profiles?.[pid];
    const subject = draft.subjects?.[sid];
    if (!profile) throw new Error("Perfil não encontrado.");
    if (!subject) throw new Error("Personagem não encontrado.");
    profile.relationships ??= {};
    if (!profile.relationships[sid]) profile.relationships[sid] = { subjectId: sid, score: 0 };
    const current = new Set(Array.isArray(profile.subjectIds) ? profile.subjectIds.map(String) : Object.keys(profile.relationships));
    const before = [...current];
    if (included) current.add(sid); else current.delete(sid);
    const after = [...current];
    if (before.length === after.length && before.every((value) => current.has(value))) return NO_STATE_CHANGE;
    profile.subjectIds = after;
    profile.metadata ??= {};
    profile.metadata.updatedAt = Date.now();
    profile.metadata.updatedBy = globalThis.game?.user?.id ?? null;
    appendHistoryEvent(draft, {
      profileId: pid,
      subjectId: sid,
      type: "profile-roster",
      before: { included: before.includes(sid) },
      after: { included: Boolean(included) },
      reason,
      transactionId: createTransactionId("profile-roster")
    });
  });
}

/** Substitui o roster visível do Perfil mantendo Relationships já existentes. */
export async function setProfileRoster(profileId, subjectIds = [], { reason = "" } = {}) {
  const pid = String(profileId ?? "").trim();
  const requested = [...new Set((Array.isArray(subjectIds) ? subjectIds : []).map(String).filter(Boolean))];
  if (!pid) throw new Error("Perfil não informado.");
  return mutateWorldState((draft) => {
    const profile = draft.profiles?.[pid];
    if (!profile) throw new Error("Perfil não encontrado.");
    const valid = requested.filter((id) => Boolean(draft.subjects?.[id]));
    const current = Array.isArray(profile.subjectIds) ? profile.subjectIds.map(String) : Object.keys(profile.relationships ?? {});
    if (current.length === valid.length && current.every((id, index) => id === valid[index])) return NO_STATE_CHANGE;
    profile.relationships ??= {};
    for (const id of valid) if (!profile.relationships[id]) profile.relationships[id] = { subjectId: id, score: 0 };
    profile.subjectIds = valid;
    profile.metadata ??= {};
    profile.metadata.updatedAt = Date.now();
    profile.metadata.updatedBy = globalThis.game?.user?.id ?? null;
    appendHistoryEvent(draft, {
      profileId: pid,
      type: "profile-roster",
      before: { subjectIds: current },
      after: { subjectIds: valid },
      reason,
      transactionId: createTransactionId("profile-roster")
    });
  });
}

export { normalizeFocalDescription, normalizeFocalName };
