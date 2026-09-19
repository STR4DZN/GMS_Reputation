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

function fullGMRoleValue() {
  return Number(globalThis.CONST?.USER_ROLES?.GAMEMASTER ?? 4);
}

function assistantRoleValue() {
  return Number(globalThis.CONST?.USER_ROLES?.ASSISTANT ?? 3);
}

function trustedRoleValue() {
  return Number(globalThis.CONST?.USER_ROLES?.TRUSTED ?? 2);
}

export function isFullGamemaster(user = globalThis.game?.user) {
  if (!user) {
    if (!globalThis.game) return true;
    return false;
  }
  if (typeof user.isGM === "boolean" && user.role !== undefined) {
    return user.role >= fullGMRoleValue();
  }
  return Boolean(user.isGM);
}

export function isAssistant(user = globalThis.game?.user) {
  if (!user) return false;
  return user.role === assistantRoleValue();
}

export function isTrustedPlayer(user = globalThis.game?.user) {
  if (!user) return false;
  return user.role === trustedRoleValue();
}

export function getPermissionConfig() {
  if (!globalThis.game?.settings?.get) return DEFAULT_PERMISSION_CONFIG;
  const raw = globalThis.game.settings.get(MODULE_ID, SETTINGS.PERMISSIONS);
  if (!raw || typeof raw !== "object") return DEFAULT_PERMISSION_CONFIG;
  return {
    schema: 1,
    assistant: { ...DEFAULT_PERMISSION_CONFIG.assistant, ...(raw.assistant || {}) },
    trusted: { ...DEFAULT_PERMISSION_CONFIG.trusted, ...(raw.trusted || {}) }
  };
}

export async function setPermissionConfig(config) {
  if (globalThis.game?.settings?.set) {
    await globalThis.game.settings.set(MODULE_ID, SETTINGS.PERMISSIONS, config);
  }
  return config;
}

export function canUser(capability, user = globalThis.game?.user) {
  if (!user) {
    if (!globalThis.game) return true;
    return capability === MODULE_CAPABILITY.READ;
  }
  if (isFullGamemaster(user)) return true;

  const config = getPermissionConfig();
  if (isAssistant(user)) {
    return Boolean(config.assistant?.[capability]);
  }
  if (isTrustedPlayer(user)) {
    return Boolean(config.trusted?.[capability]);
  }
  return capability === MODULE_CAPABILITY.READ;
}

export function canWriteAny(user = globalThis.game?.user) {
  return WRITE_CAPABILITIES.some((cap) => canUser(cap, user));
}

export function canOpenMaster(user = globalThis.game?.user) {
  return canUser(MODULE_CAPABILITY.OPEN_MASTER, user);
}

export function designatedAuthorityUser() {
  const users = [...(globalThis.game?.users?.values?.() ?? [])];
  const activeGMs = users
    .filter((u) => u.active && isFullGamemaster(u))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return activeGMs[0] ?? null;
}

export const PermissionService = Object.freeze({
  MODULE_CAPABILITY,
  DEFAULT_PERMISSION_CONFIG,
  isFullGamemaster,
  isAssistant,
  isTrustedPlayer,
  getPermissionConfig,
  setPermissionConfig,
  canUser,
  canOpenMaster,
  canWriteAny,
  designatedAuthorityUser
});
