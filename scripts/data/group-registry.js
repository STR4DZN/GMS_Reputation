import { createGroup } from "./schema.js";
import { appendHistoryEvent, createTransactionId } from "./history-registry.js";
import { loadWorldState, mutateWorldState, NO_STATE_CHANGE } from "../persistence/world-store.js";

function randomToken(length = 10) {
  const foundryRandom = globalThis.foundry?.utils?.randomID;
  if (typeof foundryRandom === "function") return foundryRandom(length);
  return Math.random().toString(36).slice(2, 2 + length).padEnd(length, "0");
}

function nextGroupId(groups = {}) {
  let id;
  do id = `gms-group-${randomToken(10)}`;
  while (Object.hasOwn(groups, id));
  return id;
}

function nextSortOrder(groups = {}) {
  const values = Object.values(groups).map((group) => Number(group.sortOrder) || 0);
  return (values.length ? Math.max(...values) : 0) + 10;
}

function touch(group) {
  const now = Date.now();
  group.metadata ??= {};
  group.metadata.updatedAt = now;
  group.metadata.updatedBy = globalThis.game?.user?.id ?? null;
  return group;
}

/** Groups are PROFILE categories from schema v4 onward. */
export function listGroups({ includeArchived = false, includeInactive = true, state = loadWorldState() } = {}) {
  return Object.freeze(Object.values(state.groups ?? {})
    .filter((group) => includeArchived || !group.archived)
    .filter((group) => includeInactive || group.active !== false)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name), "pt-BR")));
}

export function getGroup(groupId, state = loadWorldState()) {
  const id = String(groupId ?? "").trim();
  return id ? state.groups?.[id] ?? null : null;
}

export async function createNewGroup({ name, description = "" } = {}, { reason = "" } = {}) {
  const normalizedName = String(name ?? "").trim().slice(0, 160);
  if (!normalizedName) throw new Error("Informe um nome para o grupo de perfis.");
  return mutateWorldState((draft) => {
    draft.groups ??= {};
    const duplicate = Object.values(draft.groups).some((group) => !group.archived && String(group.name).localeCompare(normalizedName, "pt-BR", { sensitivity: "base" }) === 0);
    if (duplicate) throw new Error(`Já existe um grupo de perfis chamado “${normalizedName}”.`);
    const id = nextGroupId(draft.groups);
    draft.groups[id] = createGroup({
      id,
      name: normalizedName,
      description,
      sortOrder: nextSortOrder(draft.groups),
      metadata: { createdBy: globalThis.game?.user?.id ?? null, updatedBy: globalThis.game?.user?.id ?? null }
    });
    appendHistoryEvent(draft, {
      type: "group-create",
      before: null,
      after: { groupId: id, name: normalizedName, kind: "profile" },
      reason,
      transactionId: createTransactionId("profile-group")
    });
  });
}

export async function renameGroup(groupId, name, { reason = "" } = {}) {
  const id = String(groupId ?? "").trim();
  const normalizedName = String(name ?? "").trim().slice(0, 160);
  if (!id || !normalizedName) throw new Error("Grupo e nome são obrigatórios.");
  return mutateWorldState((draft) => {
    const group = draft.groups?.[id];
    if (!group) throw new Error("Grupo de perfis não encontrado.");
    if (group.name === normalizedName) return NO_STATE_CHANGE;
    const duplicate = Object.values(draft.groups ?? {}).some((entry) => entry.id !== id && !entry.archived && String(entry.name).localeCompare(normalizedName, "pt-BR", { sensitivity: "base" }) === 0);
    if (duplicate) throw new Error(`Já existe um grupo de perfis chamado “${normalizedName}”.`);
    const before = { groupId: id, name: group.name };
    group.name = normalizedName;
    touch(group);
    appendHistoryEvent(draft, {
      type: "group-update",
      before,
      after: { groupId: id, name: normalizedName, kind: "profile" },
      reason,
      transactionId: createTransactionId("profile-group")
    });
  });
}

export async function moveGroup(groupId, direction = "up", { reason = "" } = {}) {
  const id = String(groupId ?? "").trim();
  const step = direction === "down" ? 1 : -1;
  return mutateWorldState((draft) => {
    const ordered = Object.values(draft.groups ?? {})
      .filter((group) => !group.archived)
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name), "pt-BR"));
    const index = ordered.findIndex((group) => group.id === id);
    const target = index + step;
    if (index < 0 || target < 0 || target >= ordered.length) return NO_STATE_CHANGE;
    const before = ordered.map((group) => group.id);
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    ordered.forEach((group, position) => { group.sortOrder = (position + 1) * 10; touch(group); });
    appendHistoryEvent(draft, {
      type: "group-reorder",
      before: { order: before },
      after: { order: ordered.map((group) => group.id) },
      reason,
      transactionId: createTransactionId("profile-group")
    });
  });
}
