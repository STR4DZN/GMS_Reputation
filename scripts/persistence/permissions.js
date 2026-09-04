import { MODULE_ID, SETTINGS } from "../constants.js";

export const MODULE_CAPABILITY = Object.freeze({
  READ: "read",
  OPEN_MASTER: "openMaster",
  RELATIONSHIPS: "relationships",
  SUBJECTS: "subjects",
  PORTRAITS: "portraits",
  FOCAL: "focal",
  BULK: "bulk",
  HISTORY: "history",
  CONFIGURE_PERMISSIONS: "configurePermissions"
});

const WRITE_CAPABILITIES = Object.freeze([
  MODULE_CAPABILITY.RELATIONSHIPS,
  MODULE_CAPABILITY.SUBJECTS,
  MODULE_CAPABILITY.PORTRAITS,
  MODULE_CAPABILITY.FOCAL,
  MODULE_CAPABILITY.BULK,
  MODULE_CAPABILITY.HISTORY
]);

const DEFAULT_ROLE = Object.freeze({
  read: true,
  openMaster: false,
  relationships: false,
  subjects: false,
  portraits: false,
  focal: false,
  bulk: false,
  history: false
});

export const DEFAULT_PERMISSION_CONFIG = Object.freeze({
  schema: 1,
  assistant: Object.freeze({
    ...DEFAULT_ROLE,
    openMaster: true,
    relationships: true,
    subjects: true,
    portraits: true,
    focal: true,
    bulk: true,
    history: true
  }),
  trusted: Object.freeze({ ...DEFAULT_ROLE })
});

const listeners = new Set();

function fullGMRoleValue() {
  return Number(globalThis.CONST?.USER_ROLES?.GAMEMASTER ?? 4);
}

function assistantRoleValue() {
  return Number(globalThis.CONST?.USER_ROLES?.ASSISTANT ?? 3);
}

function trustedRoleValue() {
  return Number(globalThis.CONST?.USER_ROLES?.TRUSTED ?? 2);
}

export function userRole(user = globalThis.game?.user) {
  const numeric = Number(user?.role);
  if (Number.isFinite(numeric)) return numeric;
  if (user?.isGM) return assistantRoleValue();
  if (user?.isTrusted) return trustedRoleValue();
  return Number(globalThis.CONST?.USER_ROLES?.PLAYER ?? 1);
}

export function isFullGamemaster(user = globalThis.game?.user) {
  if (!user) return false;
  if (typeof user.hasRole === "function") {
    try { if (user.hasRole("GAMEMASTER", true)) return true; } catch (_error) { /* fallback below */ }
  }
  const numeric = Number(user?.role);
  if (Number.isFinite(numeric)) return numeric === fullGMRoleValue();
  return Boolean(user?.isGM);
}

export function isAssistant(user = globalThis.game?.user) {
  if (!user) return false;
  if (typeof user.hasRole === "function") {
    try { if (user.hasRole("ASSISTANT", true)) return true; } catch (_error) { /* fallback below */ }
  }
  const numeric = Number(user?.role);
  return Number.isFinite(numeric) && numeric === assistantRoleValue();
}

export function isTrustedPlayer(user = globalThis.game?.user) {
  return Boolean(user) && userRole(user) === trustedRoleValue();
}

function normalizeRolePolicy(value = {}, fallback = DEFAULT_ROLE) {
  return Object.freeze({
    read: true,
    openMaster: Boolean(value.openMaster ?? fallback.openMaster),
    relationships: Boolean(value.relationships ?? fallback.relationships),
    subjects: Boolean(value.subjects ?? fallback.subjects),
    portraits: Boolean(value.portraits ?? fallback.portraits),
    focal: Boolean(value.focal ?? fallback.focal),
    bulk: Boolean(value.bulk ?? fallback.bulk),
    history: Boolean(value.history ?? fallback.history)
  });
}

export function normalizePermissionConfig(value = {}) {
  return Object.freeze({
    schema: 1,
    assistant: normalizeRolePolicy(value.assistant, DEFAULT_PERMISSION_CONFIG.assistant),
    trusted: normalizeRolePolicy(value.trusted, DEFAULT_PERMISSION_CONFIG.trusted)
  });
}

export function getPermissionConfig() {
  try {
    return normalizePermissionConfig(globalThis.game?.settings?.get?.(MODULE_ID, SETTINGS.PERMISSIONS));
  } catch (_error) {
    return normalizePermissionConfig(DEFAULT_PERMISSION_CONFIG);
  }
}

export async function setPermissionConfig(next) {
  if (!isFullGamemaster()) throw new Error("Somente um Gamemaster completo pode alterar as permissões da Matriz de Reputação.");
  const normalized = normalizePermissionConfig(next);
  await globalThis.game.settings.set(MODULE_ID, SETTINGS.PERMISSIONS, normalized);
  return normalized;
}

export function rolePolicyFor(user = globalThis.game?.user, config = getPermissionConfig()) {
  if (!user) return Object.freeze({ ...DEFAULT_ROLE, read: false });
  if (isFullGamemaster(user)) {
    return Object.freeze({
      read: true, openMaster: true, relationships: true, subjects: true,
      portraits: true, focal: true, bulk: true, history: true,
      configurePermissions: true
    });
  }
  if (isAssistant(user)) return config.assistant;
  if (isTrustedPlayer(user)) return config.trusted;
  return Object.freeze({ ...DEFAULT_ROLE, read: true });
}

export function canUser(user, capability, config = getPermissionConfig()) {
  if (!user) return false;
  if (capability === MODULE_CAPABILITY.CONFIGURE_PERMISSIONS) return isFullGamemaster(user);
  const policy = rolePolicyFor(user, config);
  if (capability === MODULE_CAPABILITY.READ) return policy.read !== false;
  return Boolean(policy?.[capability]);
}

export function canOpenMasterPanel(user = globalThis.game?.user) {
  return canUser(user, MODULE_CAPABILITY.OPEN_MASTER);
}

export function canWriteAny(user = globalThis.game?.user) {
  return WRITE_CAPABILITIES.some((capability) => canUser(user, capability));
}

export function assertCapability(capability, user = globalThis.game?.user) {
  if (!canUser(user, capability)) {
    throw new Error(`Permissão insuficiente para a capacidade do módulo: ${capability}.`);
  }
  return true;
}

export function activeFullGamemasters() {
  const users = globalThis.game?.users;
  const list = users?.contents ?? (typeof users?.values === "function" ? [...users.values()] : Array.isArray(users) ? users : []);
  return list.filter((user) => user?.active !== false && isFullGamemaster(user))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export function designatedAuthorityUser() {
  return activeFullGamemasters()[0] ?? null;
}

export function permissionContext(user = globalThis.game?.user) {
  const config = getPermissionConfig();
  const policy = rolePolicyFor(user, config);
  return Object.freeze({
    isFullGM: isFullGamemaster(user),
    isAssistant: isAssistant(user),
    isTrusted: isTrustedPlayer(user),
    canOpenMaster: canOpenMasterPanel(user),
    canEditRelationships: canUser(user, MODULE_CAPABILITY.RELATIONSHIPS, config),
    canEditSubjects: canUser(user, MODULE_CAPABILITY.SUBJECTS, config),
    canEditPortraits: canUser(user, MODULE_CAPABILITY.PORTRAITS, config),
    canEditFocal: canUser(user, MODULE_CAPABILITY.FOCAL, config),
    canBulkEdit: canUser(user, MODULE_CAPABILITY.BULK, config),
    canUndoRedo: canUser(user, MODULE_CAPABILITY.HISTORY, config),
    canConfigurePermissions: isFullGamemaster(user),
    config
  });
}

export function subscribePermissionChanges(callback) {
  if (typeof callback !== "function") throw new TypeError("Permission listener must be a function.");
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function emitPermissionChange(value) {
  const config = normalizePermissionConfig(value);
  for (const callback of [...listeners]) {
    try { callback(config); } catch (error) { console.warn("GMS Reputation | Permission listener failed.", error); }
  }
  globalThis.Hooks?.callAll?.("gmsReputationPermissionsChanged", config);
  return config;
}
