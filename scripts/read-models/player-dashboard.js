import { activeProfiles, activeGroups, resolveProfile } from "../domain/profiles.js";
import { buildHeartTrackModel } from "../components/reputation-track.js";
import { buildIdentityModel } from "../components/identity.js";
import { buildPortraitFrameModel } from "../components/portrait.js";
import { buildSpecialProtocolModel } from "../components/special-protocol.js";
import { deriveRelationshipView } from "../domain/reputation.js";
import { HistoryService } from "../services/history-service.js";

export function buildPlayerCardReadModel({ subject, relationship, profileId }) {
  const relView = deriveRelationshipView(relationship);
  const hearts = buildHeartTrackModel(relationship);
  const identity = buildIdentityModel(subject);
  const portrait = buildPortraitFrameModel(subject.portrait, { label: identity.alias, kind: "subject" });
  const special = buildSpecialProtocolModel(relationship);

  return Object.freeze({
    subjectId: String(subject.id),
    profileId: String(profileId),
    identity,
    portrait,
    relationship: Object.freeze({
      label: relView.band.label,
      code: relView.band.code,
      bandId: relView.band.id,
      polarity: relView.polarity,
      accent: relView.band.accent
    }),
    hearts,
    score: Object.freeze({
      text: relView.scoreFormatted,
      limit: relView.scoreLimit,
      accessibleLabel: hearts.accessibleLabel
    }),
    special,
    hasNotes: Boolean(relView.note),
    notePreview: relView.note ? relView.note.slice(0, 140) : ""
  });
}

export function buildPlayerDashboardReadModel({ profileId = "", state = {} } = {}) {
  const profiles = activeProfiles(state);
  const profile = resolveProfile(state, profileId);

  if (!profile) {
    return Object.freeze({
      hasProfile: false,
      profiles: Object.freeze([]),
      profileGroups: Object.freeze([]),
      showProfileLibrary: false,
      profileId: "",
      cards: Object.freeze([])
    });
  }

  const groups = activeGroups(state);
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const roster = new Set(Array.isArray(profile.subjectIds) ? profile.subjectIds.map(String) : Object.keys(profile.relationships ?? {}));

  const subjects = Object.values(state.subjects ?? {})
    .filter((s) => roster.has(String(s.id)))
    .filter((s) => s.active !== false && !s.archived)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.realName || a.alias).localeCompare(String(b.realName || b.alias), "pt-BR"));

  const cards = subjects.map((subject) => {
    const rel = profile.relationships?.[subject.id] ?? { subjectId: subject.id, score: 0 };
    return buildPlayerCardReadModel({ subject, relationship: rel, profileId: profile.id });
  });

  const focalPortrait = buildPortraitFrameModel(profile.focal?.portrait, {
    label: profile.focal?.name || profile.name,
    kind: "focal"
  });

  const focal = Object.freeze({
    profileId: profile.id,
    name: String(profile.focal?.name || profile.name || "Perfil"),
    description: String(profile.focal?.description || ""),
    groupName: profile.groupId && groupMap.has(profile.groupId) ? String(groupMap.get(profile.groupId).name) : "Sem Grupo",
    portrait: focalPortrait
  });

  const profilesByGroup = new Map(groups.map((g) => [g.id, []]));
  const ungroupedProfiles = [];
  for (const entry of profiles) {
    const bucket = entry.groupId ? profilesByGroup.get(entry.groupId) : null;
    if (bucket) bucket.push(entry);
    else ungroupedProfiles.push(entry);
  }

  const profileGroups = groups.map((g) => {
    const entries = profilesByGroup.get(g.id) ?? [];
    return Object.freeze({
      id: g.id,
      name: g.name,
      description: g.description || "",
      count: entries.length,
      active: entries.some((e) => e.id === profile.id),
      profiles: Object.freeze(entries.map((e) => Object.freeze({
        id: e.id,
        name: String(e.name || "Perfil"),
        focalName: String(e.focal?.name || e.name || "Perfil"),
        image: String(e.focal?.portrait?.src || ""),
        selected: e.id === profile.id
      })))
    });
  }).filter((g) => g.count > 0);

  if (ungroupedProfiles.length) {
    profileGroups.push(Object.freeze({
      id: "__ungrouped__",
      name: "Sem Grupo",
      description: "Perfis sem categoria atribuída",
      count: ungroupedProfiles.length,
      active: ungroupedProfiles.some((e) => e.id === profile.id),
      profiles: Object.freeze(ungroupedProfiles.map((e) => Object.freeze({
        id: e.id,
        name: String(e.name || "Perfil"),
        focalName: String(e.focal?.name || e.name || "Perfil"),
        image: String(e.focal?.portrait?.src || ""),
        selected: e.id === profile.id
      })))
    }));
  }

  const groupName = profile.groupId && groupMap.has(profile.groupId) ? String(groupMap.get(profile.groupId).name) : "Sem Grupo";

  return Object.freeze({
    hasProfile: true,
    profileId: profile.id,
    profileName: profile.name,
    groupName,
    showProfileLibrary: profiles.length > 1,
    profileGroups: Object.freeze(profileGroups),
    focal,
    cards: Object.freeze(cards),
    totalCount: subjects.length,
    worldRevision: Number(state.revision) || 0
  });
}

function formatHistoryTimestamp(timestamp) {
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(numeric));
  } catch {
    return new Date(numeric).toLocaleTimeString("pt-BR");
  }
}

function formatActorName(userId) {
  const id = String(userId || "").trim();
  if (!id) return "Sistema";
  const user = globalThis.game?.users?.get?.(id)
    ?? globalThis.game?.users?.find?.((u) => String(u?.id) === id);
  return String(user?.name || user?.displayName || id);
}

export function buildSubjectDetailReadModel({ profileId = "", subjectId = "", state = {} } = {}) {
  const profile = state.profiles?.[String(profileId)];
  const subject = state.subjects?.[String(subjectId)];

  if (!profile || !subject) {
    return Object.freeze({
      found: false,
      profileId: String(profileId),
      subjectId: String(subjectId)
    });
  }

  const relationship = profile.relationships?.[subject.id] ?? { subjectId: subject.id, score: 0 };
  const card = buildPlayerCardReadModel({ subject, relationship, profileId: profile.id });
  const rawEvents = HistoryService.list({ state, profileId: profile.id, subjectId: subject.id, limit: 30 });

  const history = rawEvents.map((evt) => {
    const changes = [];
    if (evt.type === "relationship") {
      if (evt.before?.score !== evt.after?.score) {
        changes.push({ label: "Score", before: String(evt.before?.score ?? "—"), after: String(evt.after?.score ?? "—") });
      }
      if (evt.before?.bond !== evt.after?.bond) {
        changes.push({ label: "Vínculo", before: evt.before?.bond ? "ATIVO" : "INATIVO", after: evt.after?.bond ? "ATIVO" : "INATIVO" });
      }
      if (evt.before?.communion !== evt.after?.communion) {
        changes.push({ label: "Comunhão", before: evt.before?.communion ? "ATIVA" : "INATIVA", after: evt.after?.communion ? "ATIVA" : "INATIVA" });
      }
    }
    return {
      timestampText: formatHistoryTimestamp(evt.timestamp),
      typeLabel: evt.type === "relationship" ? "Relação" : evt.type,
      actorLabel: formatActorName(evt.userId),
      hasChanges: changes.length > 0,
      changes,
      reason: evt.reason || ""
    };
  });

  const tags = Array.isArray(subject.metadata?.tags) ? subject.metadata.tags.map(String).filter(Boolean) : [];

  return Object.freeze({
    found: true,
    profileId: profile.id,
    profileName: profile.name,
    subjectId: subject.id,
    identity: card.identity,
    portrait: card.portrait,
    relationship: card.relationship,
    score: card.score,
    hearts: card.hearts,
    special: card.special,
    description: String(subject.description || "").trim(),
    hasDescription: Boolean(String(subject.description || "").trim()),
    history: Object.freeze(history),
    hasHistory: history.length > 0,
    tags: Object.freeze(tags),
    hasTags: tags.length > 0
  });
}
