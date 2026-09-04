import { createHistoryEvent } from "./schema.js";
import { normalizeRelationship, deriveSpecialState } from "../core/score.js";
import { normalizePortrait } from "../core/portrait.js";
import { loadWorldState } from "../persistence/world-store.js";

const HISTORY_TYPE_LABELS = Object.freeze({
  relationship: "Relação alterada",
  portrait: "Retrato alterado",
  "subject-archive": "Arquivamento alterado",
  "subject-reorder": "Ordem alterada",
  "subject-active": "Ativação alterada",
  "subject-create": "Personagem criado",
  "subject-update": "Personagem atualizado",
  "subject-delete": "Personagem apagado",
  "subject-group": "Grupo legado do personagem alterado",
  "profile-create": "Perfil criado",
  "profile-update": "Perfil atualizado",
  "profile-reorder": "Ordem de perfil alterada",
  "profile-group": "Grupo do perfil alterado",
  "profile-delete": "Perfil apagado",
  "group-create": "Grupo criado",
  "group-update": "Grupo renomeado",
  "group-reorder": "Ordem de grupos alterada",
  "group-delete": "Grupo apagado",
  undo: "Alteração desfeita",
  redo: "Alteração refeita"
});

function randomToken(length = 12) {
  const foundryRandom = globalThis.foundry?.utils?.randomID;
  if (typeof foundryRandom === "function") return foundryRandom(length);
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let index = 0; index < length; index += 1) {
    token += alphabet[(Date.now() + index * 17 + Math.floor(Math.random() * 1000)) % alphabet.length];
  }
  return token;
}

export function createTransactionId(prefix = "tx") {
  return `${String(prefix || "tx")}-${Date.now().toString(36)}-${randomToken(8)}`;
}

export function relationshipSnapshot(relationship = {}) {
  const normalized = normalizeRelationship(relationship);
  return Object.freeze({
    score: normalized.score,
    communion: normalized.communion,
    bond: normalized.bond,
    note: normalized.note
  });
}

export function portraitSnapshot(portrait = {}) {
  const normalized = normalizePortrait(portrait);
  return Object.freeze({
    src: normalized.src,
    zoom: normalized.zoom,
    x: normalized.x,
    y: normalized.y
  });
}

export function appendHistoryEvent(draft, {
  profileId = null,
  subjectId = null,
  type = "unknown",
  before = null,
  after = null,
  reason = "",
  transactionId = null,
  userId = globalThis.game?.user?.id ?? null,
  timestamp = Date.now()
} = {}) {
  if (!draft || typeof draft !== "object") throw new TypeError("History draft is required.");
  draft.history ??= [];
  const event = createHistoryEvent({
    id: `gms-history-${randomToken(16)}`,
    timestamp,
    userId,
    profileId,
    subjectId,
    type,
    before,
    after,
    reason,
    transactionId
  });
  draft.history.push(event);
  return event;
}

function scoreText(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1).replace(".", ",");
}

function specialLabel(snapshot = {}) {
  const state = deriveSpecialState(snapshot);
  if (state === "dual-sync") return "DUPLO//SINC";
  if (state === "communion") return "COMUNHÃO";
  if (state === "bond") return "VÍNCULO";
  return "NORMAL";
}

function formatActor(userId) {
  const id = String(userId || "").trim();
  if (!id) return "Sistema";
  const user = globalThis.game?.users?.get?.(id)
    ?? globalThis.game?.users?.find?.((entry) => String(entry?.id) === id);
  return String(user?.name || user?.displayName || id);
}

function formatTimestamp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(numeric));
  } catch (_error) {
    return new Date(numeric).toLocaleString("pt-BR");
  }
}

export function describeHistoryEvent(event = {}) {
  const before = event.before && typeof event.before === "object" ? event.before : {};
  const after = event.after && typeof event.after === "object" ? event.after : {};
  const changes = [];

  if (event.type === "relationship") {
    if (Number(before.score) !== Number(after.score)) {
      changes.push({ key: "score", label: "Score", before: scoreText(before.score), after: scoreText(after.score) });
    }
    if (Boolean(before.bond) !== Boolean(after.bond)) {
      changes.push({ key: "bond", label: "Vínculo", before: before.bond ? "ATIVO" : "INATIVO", after: after.bond ? "ATIVO" : "INATIVO" });
    }
    if (Boolean(before.communion) !== Boolean(after.communion)) {
      changes.push({ key: "communion", label: "Comunhão", before: before.communion ? "ATIVA" : "INATIVA", after: after.communion ? "ATIVA" : "INATIVA" });
    }
    if (String(before.note ?? "") !== String(after.note ?? "")) {
      changes.push({ key: "note", label: "Nota", before: before.note ? "EDITADA" : "VAZIA", after: after.note ? "EDITADA" : "VAZIA" });
    }
    const beforeSpecial = specialLabel(before);
    const afterSpecial = specialLabel(after);
    if (beforeSpecial !== afterSpecial) {
      changes.push({ key: "special", label: "Especial", before: beforeSpecial, after: afterSpecial });
    }
  } else if (event.type === "portrait") {
    const sourceChanged = String(before.src || "") !== String(after.src || "");
    if (sourceChanged) changes.push({ key: "portrait-src", label: "Imagem", before: before.src ? "DEFINIDA" : "VAZIA", after: after.src ? "DEFINIDA" : "VAZIA" });
    if (Number(before.zoom) !== Number(after.zoom)) changes.push({ key: "portrait-zoom", label: "Zoom", before: `${Number(before.zoom) || 100}%`, after: `${Number(after.zoom) || 100}%` });
    if (Number(before.x) !== Number(after.x) || Number(before.y) !== Number(after.y)) {
      changes.push({ key: "portrait-position", label: "Posição", before: `${Number(before.x) || 50}/${Number(before.y) || 50}`, after: `${Number(after.x) || 50}/${Number(after.y) || 50}` });
    }
  } else if (event.type === "subject-archive") {
    changes.push({ key: "archived", label: "Arquivo", before: before.archived ? "ARQUIVADO" : "ATIVO", after: after.archived ? "ARQUIVADO" : "ATIVO" });
  } else if (event.type === "subject-active") {
    changes.push({ key: "active", label: "Estado", before: before.active ? "ATIVO" : "INATIVO", after: after.active ? "ATIVO" : "INATIVO" });
  } else if (event.type === "subject-reorder") {
    changes.push({ key: "sortOrder", label: "Ordem", before: String(before.sortOrder ?? "—"), after: String(after.sortOrder ?? "—") });
  } else if (event.type === "subject-group") {
    changes.push({ key: "groupId", label: "Grupo", before: String(before.groupName || before.groupId || "SEM GRUPO"), after: String(after.groupName || after.groupId || "SEM GRUPO") });
  } else if (event.type === "profile-update") {
    if (String(before.name ?? "") !== String(after.name ?? "")) changes.push({ key: "name", label: "Nome da matriz", before: String(before.name || "—"), after: String(after.name || "—") });
    if (String(before.groupId ?? "") !== String(after.groupId ?? "")) changes.push({ key: "groupId", label: "Grupo do perfil", before: String(before.groupName || before.groupId || "SEM GRUPO"), after: String(after.groupName || after.groupId || "SEM GRUPO") });
    if (Boolean(before.active) !== Boolean(after.active)) changes.push({ key: "active", label: "Estado", before: before.active ? "ATIVO" : "INATIVO", after: after.active ? "ATIVO" : "INATIVO" });
    if (Boolean(before.archived) !== Boolean(after.archived)) changes.push({ key: "archived", label: "Arquivo", before: before.archived ? "ARQUIVADO" : "NORMAL", after: after.archived ? "ARQUIVADO" : "NORMAL" });
  } else if (event.type === "profile-reorder") {
    changes.push({ key: "sortOrder", label: "Ordem do perfil", before: String(before.sortOrder ?? "—"), after: String(after.sortOrder ?? "—") });
  } else if (event.type === "profile-group") {
    changes.push({ key: "groupId", label: "Grupo do perfil", before: String(before.groupName || before.groupId || "SEM GRUPO"), after: String(after.groupName || after.groupId || "SEM GRUPO") });
  } else if (event.type === "profile-create") {
    changes.push({ key: "profile", label: "Perfil", before: "—", after: String(after.focalName || after.name || "CRIADO") });
  } else if (event.type === "subject-create") {
    changes.push({ key: "subject", label: "Personagem", before: "—", after: String(after.alias || after.realName || "CRIADO") });
  } else if (event.type === "subject-update") {
    if (String(before.alias ?? "") !== String(after.alias ?? "")) changes.push({ key: "alias", label: "Apelido", before: String(before.alias || "—"), after: String(after.alias || "—") });
    if (String(before.realName ?? "") !== String(after.realName ?? "")) changes.push({ key: "realName", label: "Nome real", before: String(before.realName || "—"), after: String(after.realName || "—") });
    if (String(before.description ?? "") !== String(after.description ?? "")) changes.push({ key: "description", label: "Biografia", before: before.description ? "EDITADA" : "VAZIA", after: after.description ? "EDITADA" : "VAZIA" });
    if (Boolean(before.active) !== Boolean(after.active)) changes.push({ key: "active", label: "Estado", before: before.active ? "ATIVO" : "INATIVO", after: after.active ? "ATIVO" : "INATIVO" });
    if (Boolean(before.archived) !== Boolean(after.archived)) changes.push({ key: "archived", label: "Arquivo", before: before.archived ? "ARQUIVADO" : "NORMAL", after: after.archived ? "ARQUIVADO" : "NORMAL" });
    if (JSON.stringify(before.tags ?? []) !== JSON.stringify(after.tags ?? [])) changes.push({ key: "tags", label: "Marcadores", before: (before.tags ?? []).join(", ") || "—", after: (after.tags ?? []).join(", ") || "—" });
  } else if (event.type === "group-create") {
    changes.push({ key: "group", label: "Grupo", before: "—", after: String(after.name || "CRIADO") });
  } else if (event.type === "group-update") {
    changes.push({ key: "group", label: "Grupo", before: String(before.name || "—"), after: String(after.name || "—") });
  } else if (event.type === "group-reorder") {
    changes.push({ key: "group-order", label: "Ordem dos grupos", before: "ANTERIOR", after: "ATUALIZADA" });
  } else if (event.type === "subject-delete") {
    changes.push({ key: "subject-delete", label: "Personagem", before: String(before.alias || before.realName || before.subjectId || "REGISTRO"), after: "APAGADO" });
    if (after.affectedProfileCount) changes.push({ key: "affected-profiles", label: "Perfis afetados", before: String(after.affectedProfileCount), after: "RELAÇÕES REMOVIDAS" });
  } else if (event.type === "profile-delete") {
    changes.push({ key: "profile-delete", label: "Perfil", before: String(before.focalName || before.name || before.profileId || "PERFIL"), after: "APAGADO" });
    if (before.relationshipCount) changes.push({ key: "deleted-relationships", label: "Relações", before: String(before.relationshipCount), after: "REMOVIDAS" });
  } else if (event.type === "group-delete") {
    changes.push({ key: "group-delete", label: "Grupo", before: String(before.name || before.groupId || "GRUPO"), after: "APAGADO" });
    if (after.movedToUngrouped) changes.push({ key: "moved-profiles", label: "Perfis preservados", before: String(after.movedToUngrouped), after: "SEM GRUPO" });
  } else if (event.type === "undo" || event.type === "redo") {
    changes.push({
      key: "history-action",
      label: "Transação",
      before: String(before.state || (event.type === "undo" ? "APLICADA" : "DESFEITA")).toLocaleUpperCase("pt-BR"),
      after: String(after.state || (event.type === "undo" ? "DESFEITA" : "APLICADA")).toLocaleUpperCase("pt-BR")
    });
    if (after.targetTransactionId) {
      changes.push({ key: "history-target", label: "Alvo", before: "TX", after: String(after.targetTransactionId) });
    }
  }

  return Object.freeze({
    id: String(event.id || ""),
    type: String(event.type || "unknown"),
    typeLabel: HISTORY_TYPE_LABELS[event.type] || String(event.type || "Alteração"),
    profileId: event.profileId ? String(event.profileId) : null,
    subjectId: event.subjectId ? String(event.subjectId) : null,
    userId: event.userId ? String(event.userId) : null,
    actorLabel: formatActor(event.userId),
    timestamp: Number(event.timestamp) || 0,
    timestampText: formatTimestamp(event.timestamp),
    reason: String(event.reason || "").trim(),
    transactionId: event.transactionId ? String(event.transactionId) : null,
    isTransaction: Boolean(event.transactionId),
    changes: Object.freeze(changes.map((entry) => Object.freeze(entry))),
    hasChanges: changes.length > 0
  });
}

export function listHistory({
  state = loadWorldState(),
  profileId = "",
  subjectId = "",
  includeGlobalSubjectEvents = true,
  limit = 100
} = {}) {
  const profileKey = String(profileId || "");
  const subjectKey = String(subjectId || "");
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(Number(limit) || 100)));
  return Object.freeze((Array.isArray(state.history) ? state.history : [])
    .filter((event) => {
      if (subjectKey && String(event?.subjectId || "") !== subjectKey) return false;
      if (!profileKey) return true;
      const eventProfile = String(event?.profileId || "");
      if (eventProfile === profileKey) return true;
      return includeGlobalSubjectEvents && subjectKey && !eventProfile;
    })
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
    .slice(0, safeLimit)
    .map(describeHistoryEvent));
}
