import { buildPortraitFrameModel } from "../../components/portrait-frame.js";
import { buildHeartTrackModel } from "../../components/heart-track.js";
import { normalizeRelationship } from "../../core/score.js";
import { getSemanticBand } from "../../core/semantic-bands.js";
import { getSpecialPresentation } from "../../core/special-presentation.js";
import { relationshipKey } from "../../data/relationship-grid.js";

export const WORKBENCH_ROWS = 24;
export const WORKBENCH_COLUMNS = 6;
export const normalizeSearch = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
export function createWorkbenchState() {
  return {
    view: "roster",
    advancedOpen: false,
    search: "",
    npcSearch: "",
    groupId: "",
    page: 0,
    columnPage: 0,
    drafts: new Map(),
    selectedSubjects: new Set(),
    selectedProfiles: new Set(),
    reason: "",
    scrollTop: 0,
    scrollLeft: 0,
  };
}
export function buildWorkbenchCell(profile, subject, drafts = new Map()) {
  const roster = new Set(
    Array.isArray(profile.subjectIds)
      ? profile.subjectIds.map(String)
      : Object.keys(profile.relationships ?? {}),
  );
  const member = roster.has(String(subject.id));
  const base = normalizeRelationship(profile.relationships?.[subject.id]);
  const draft = drafts.get(relationshipKey(profile.id, subject.id));
  const value = draft?.patch ?? base;
  const band = getSemanticBand(value.score, value);
  const special = getSpecialPresentation(value);
  const heartTrack = buildHeartTrackModel(value);
  const limit = value.bond || value.communion ? 12 : 10;
  return {
    profileId: profile.id,
    subjectId: subject.id,
    key: relationshipKey(profile.id, subject.id),
    member,
    score: value.score,
    negative: value.score < 0,
    scoreText: String(value.score).replace(".", ","),
    label: band.label,
    accent: band.accent,
    bond: value.bond,
    communion: value.communion,
    limit,
    dirty: Boolean(draft),
    changeText: `${String(base.score).replace(".", ",")} → ${String(value.score).replace(".", ",")}`,
    special: special.active
      ? String(special.compactLabel || special.label)
      : "",
    bandId: band.id,
    polarity: band.polarity,
    specialState: special.state,
    hearts: heartTrack.slots.map((slot) => ({ ...slot, value: slot.ordinal })),
  };
}
export function buildReputationWorkbench(
  state = {},
  {
    profileId = "",
    ui = createWorkbenchState(),
    canEdit = false,
    canBulk = false,
  } = {},
) {
  const compare = (a, b) =>
    Number(a.sortOrder) - Number(b.sortOrder) ||
    String(a.name || a.alias || a.realName).localeCompare(
      String(b.name || b.alias || b.realName),
      "pt-BR",
    );
  const groups = Object.values(state.groups ?? {})
    .filter((g) => !g.archived)
    .sort(compare);
  const allProfiles = Object.values(state.profiles ?? {})
    .filter((p) => !p.archived)
    .sort(compare);
  const selectedProfile =
    allProfiles.find((p) => p.id === profileId) ?? allProfiles[0] ?? null;
  const needle = normalizeSearch(ui.npcSearch);
  const matchingProfiles = allProfiles.filter(
    (p) =>
      (!ui.groupId || (p.groupId || "__ungrouped__") === ui.groupId) &&
      normalizeSearch(`${p.name} ${p.focal?.name || ""}`).includes(needle),
  );
  const columnPages = Math.max(
    1,
    Math.ceil(matchingProfiles.length / WORKBENCH_COLUMNS),
  );
  const columnPage = Math.min(Math.max(0, ui.columnPage), columnPages - 1);
  const profiles =
    ui.view === "matrix"
      ? matchingProfiles.slice(
          columnPage * WORKBENCH_COLUMNS,
          (columnPage + 1) * WORKBENCH_COLUMNS,
        )
      : selectedProfile
        ? [selectedProfile]
        : [];
  const rosters = new Map(
    profiles.map((p) => [
      p.id,
      new Set(
        Array.isArray(p.subjectIds)
          ? p.subjectIds
          : Object.keys(p.relationships ?? {}),
      ),
    ]),
  );
  const subjectNeedle = normalizeSearch(ui.search);
  const subjects = Object.values(state.subjects ?? {})
    .filter((s) => s.active !== false && !s.archived)
    .filter((s) => profiles.some((p) => rosters.get(p.id).has(s.id)))
    .filter((s) =>
      normalizeSearch(`${s.alias} ${s.realName}`).includes(subjectNeedle),
    )
    .sort(compare);
  const pages = Math.max(1, Math.ceil(subjects.length / WORKBENCH_ROWS));
  const page = Math.min(Math.max(0, ui.page), pages - 1);
  const rows = subjects
    .slice(page * WORKBENCH_ROWS, (page + 1) * WORKBENCH_ROWS)
    .map((subject) => {
      const cells = profiles.map((p) =>
        buildWorkbenchCell(p, subject, ui.drafts),
      );
      return {
        id: subject.id,
        name: subject.alias || subject.realName || "Sem identificação",
        realName: subject.realName || "",
        image: subject.portrait?.src || "",
        portrait: buildPortraitFrameModel(subject.portrait, {
          label: subject.alias || subject.realName,
        }),
        accent: ui.view === "matrix" ? "#697584" : cells[0]?.accent,
        selected: ui.selectedSubjects.has(subject.id),
        cells,
      };
    });
  const choices = matchingProfiles.map((p) => ({
    id: p.id,
    name: p.focal?.name || p.name,
    description: p.name,
    portrait: buildPortraitFrameModel(p.focal?.portrait, {
      kind: "focal",
      label: p.focal?.name || p.name,
    }),
    selected: p.id === selectedProfile?.id,
    group: state.groups?.[p.groupId]?.name || "Sem grupo",
  }));
  return {
    canEdit,
    canBulk: canEdit && canBulk,
    matrix: ui.view === "matrix",
    roster: ui.view !== "matrix",
    search: ui.search,
    npcSearch: ui.npcSearch,
    profileName:
      selectedProfile?.focal?.name || selectedProfile?.name || "Nenhum NPC",
    profileId: selectedProfile?.id || "",
    description: selectedProfile?.focal?.description || "",
    portrait: buildPortraitFrameModel(selectedProfile?.focal?.portrait, {
      kind: "focal",
      label: selectedProfile?.focal?.name || selectedProfile?.name,
    }),
    profiles: profiles.map((p) => ({
      id: p.id,
      name: p.focal?.name || p.name,
      selected: ui.selectedProfiles.has(p.id),
    })),
    choices,
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      selected: g.id === ui.groupId,
    })),
    ungrouped: ui.groupId === "__ungrouped__",
    rows,
    total: subjects.length,
    page,
    pageText: `${page + 1} / ${pages}`,
    rangeText: subjects.length
      ? `${page * WORKBENCH_ROWS + 1}–${Math.min(subjects.length, (page + 1) * WORKBENCH_ROWS)} de ${subjects.length}`
      : "0 personagens",
    paginated: pages > 1,
    prev: page > 0,
    next: page < pages - 1,
    columnPage,
    columnText: `${columnPage + 1} / ${columnPages}`,
    prevColumns: columnPage > 0,
    nextColumns: columnPage < columnPages - 1,
    reason: ui.reason,
    dirty: ui.drafts.size,
    hasProfiles: allProfiles.length > 0,
  };
}
