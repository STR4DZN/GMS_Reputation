import { MODULE_ID } from "../constants.js";
import { loadWorldState } from "../persistence/world-store.js";
import { buildPlayerCardContext } from "../components/player-card.js";
import { buildFocalProfileContext } from "../components/focal-profile.js";
import { openSubjectDetail } from "./subject-detail.js";
import { HandlebarsApplicationV2, appElement, destroyListeners, listen, notify, renderApplicationSafely } from "./application-compat.js";
import { subscribeWorldStateChanges } from "../events/world-sync.js";
import { wireApplicationAccessibility } from "../utils/accessibility.js";
import { wireMotionSystem } from "../motion/motion-system.js";

const CARD_TEMPLATE = `modules/${MODULE_ID}/templates/partials/player-card.hbs`;
const FOCAL_TEMPLATE = `modules/${MODULE_ID}/templates/partials/focal-profile.hbs`;

const PARTIALS = [
  `modules/${MODULE_ID}/templates/partials/background-art.hbs`,
  `modules/${MODULE_ID}/templates/partials/portrait-frame.hbs`,
  `modules/${MODULE_ID}/templates/partials/identity.hbs`,
  `modules/${MODULE_ID}/templates/partials/heart-track.hbs`,
  `modules/${MODULE_ID}/templates/partials/player-card.hbs`,
  `modules/${MODULE_ID}/templates/partials/focal-profile.hbs`
];

function activeProfiles(state) {
  return Object.values(state.profiles ?? {})
    .filter((profile) => profile.active !== false && !profile.archived)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name), "pt-BR"));
}

function activeGroups(state) {
  return Object.values(state.groups ?? {})
    .filter((group) => group.active !== false && !group.archived)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name), "pt-BR"));
}

function resolveProfile(state, requestedId = "") {
  const available = activeProfiles(state);
  const requested = available.find((profile) => profile.id === String(requestedId));
  return requested ?? available[0] ?? null;
}

export function buildPlayerDashboardContext({ profileId = "", state = loadWorldState() } = {}) {
  const profiles = activeProfiles(state);
  const profile = resolveProfile(state, profileId);
  if (!profile) {
    return Object.freeze({
      hasProfile: false,
      profiles: Object.freeze([]),
      profileGroups: Object.freeze([]),
      profileId: "",
      cards: Object.freeze([])
    });
  }

  const groups = activeGroups(state);
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const roster = new Set(Array.isArray(profile.subjectIds) ? profile.subjectIds.map(String) : Object.keys(profile.relationships ?? {}));
  const subjects = Object.values(state.subjects ?? {})
    .filter((subject) => roster.has(String(subject.id)))
    .filter((subject) => subject.active !== false && !subject.archived)
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder) || String(a.realName).localeCompare(String(b.realName), "pt-BR"));
  const makeCard = (subject) => buildPlayerCardContext({
    subject,
    relationship: profile.relationships?.[subject.id] ?? { subjectId: subject.id, score: 0 },
    profileId: profile.id,
    allowSecondaryDisclosure: false,
    detailEnabled: true
  });

  const profilesByGroup = new Map(groups.map((group) => [group.id, []]));
  const ungroupedProfiles = [];
  for (const entry of profiles) {
    const bucket = entry.groupId ? profilesByGroup.get(entry.groupId) : null;
    if (bucket) bucket.push(entry);
    else ungroupedProfiles.push(entry);
  }
  const profileGroups = groups.map((group) => {
    const entries = profilesByGroup.get(group.id) ?? [];
    return Object.freeze({
      id: group.id,
      name: group.name,
      description: group.description || "",
      count: entries.length,
      active: entries.some((entry) => entry.id === profile.id),
      system: false,
      profiles: Object.freeze(entries.map((entry) => Object.freeze({
        id: entry.id,
        name: String(entry.name || "Perfil"),
        focalName: String(entry.focal?.name || entry.name || "Perfil"),
        image: String(entry.focal?.portrait?.src || ""),
        description: String(entry.focal?.description || ""),
        selected: entry.id === profile.id
      })))
    });
  }).filter((group) => group.count > 0);

  if (ungroupedProfiles.length) {
    profileGroups.push(Object.freeze({
      id: "__ungrouped__",
      name: "Sem Grupo",
      description: "Perfis ainda não organizados em uma categoria.",
      count: ungroupedProfiles.length,
      active: ungroupedProfiles.some((entry) => entry.id === profile.id),
      system: true,
      profiles: Object.freeze(ungroupedProfiles.map((entry) => Object.freeze({
        id: entry.id,
        name: String(entry.name || "Perfil"),
        focalName: String(entry.focal?.name || entry.name || "Perfil"),
        image: String(entry.focal?.portrait?.src || ""),
        description: String(entry.focal?.description || ""),
        selected: entry.id === profile.id
      })))
    }));
  }

  return Object.freeze({
    hasProfile: true,
    profileId: profile.id,
    profileName: profile.name,
    currentProfile: Object.freeze({
      id: profile.id,
      name: String(profile.name || "Perfil"),
      focalName: String(profile.focal?.name || profile.name || "Perfil"),
      image: String(profile.focal?.portrait?.src || ""),
      groupName: profile.groupId && groupMap.has(profile.groupId) ? String(groupMap.get(profile.groupId).name || "Sem Grupo") : "Sem Grupo"
    }),
    showProfileLibrary: groups.length > 0 || profiles.length > 1,
    profiles: Object.freeze(profiles.map((entry) => Object.freeze({ id: entry.id, name: entry.name, selected: entry.id === profile.id }))),
    profileGroups: Object.freeze(profileGroups),
    focal: buildFocalProfileContext(profile),
    cards: Object.freeze(subjects.map(makeCard)),
    totalCount: subjects.length,
    worldRevision: Number(state.revision) || 0
  });
}

async function renderTemplateHTML(path, context) {
  const render = globalThis.foundry?.applications?.handlebars?.renderTemplate;
  if (typeof render !== "function") return null;
  return render(path, context);
}

function parseSingleElement(html) {
  if (!html) return null;
  const parse = globalThis.foundry?.utils?.parseHTML ?? globalThis.foundry?.applications?.parseHTML;
  if (typeof parse === "function") {
    const result = parse(String(html));
    if (result?.querySelector) return result;
    if (result?.[0]?.querySelector) return result[0];
  }
  if (typeof globalThis.DOMParser === "function") return new DOMParser().parseFromString(String(html), "text/html").body.firstElementChild;
  return null;
}

export class ReputationPlayerDashboardApplication extends HandlebarsApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "gms-reputation-player-dashboard",
    classes: ["gms-reputation-app", "gms-reputation-player-dashboard-app"],
    tag: "section",
    window: {
      title: "GMS // Matriz de Reputação",
      icon: "fa-solid fa-people-arrows-left-right",
      resizable: true
    },
    position: { width: 940, height: 780 }
  };

  static PARTS = {
    main: {
      root: true,
      template: `modules/${MODULE_ID}/templates/apps/player-dashboard.hbs`,
      templates: PARTIALS,
      scrollable: [".gms-player-dashboard__scroll"]
    }
  };

  constructor({ profileId = "", ...options } = {}) {
    super(options);
    this.profileId = String(profileId || "");
    this._listeners = [];
    this._cardListeners = [];
    this._syncUnsubscribe = subscribeWorldStateChanges((event) => this._onWorldStateSync(event));
    this._liveUpdateTimer = null;
    this._accessibilityController = null;
    this._motionController = null;
    this._motionBooted = false;
    this._pendingMotion = "";
  }

  async _prepareContext(options) {
    const parent = await super._prepareContext?.(options) ?? {};
    const context = buildPlayerDashboardContext({ profileId: this.profileId });
    if (context.hasProfile) this.profileId = context.profileId;
    return { ...parent, ...context };
  }

  _wireCardDetails(root) {
    for (const card of root?.querySelectorAll?.("[data-player-card][data-detail-enabled='true']") ?? []) {
      const open = (event) => {
        if (event?.target?.closest?.("button,summary,details,a,input,select,textarea")) return;
        openSubjectDetail({ profileId: card.dataset.profileId, subjectId: card.dataset.subjectId });
      };
      listen(this._cardListeners, card, "click", open);
      listen(this._cardListeners, card, "keydown", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        if (event?.target?.closest?.("button,summary,details,a,input,select,textarea")) return;
        event.preventDefault();
        open(event);
      });
    }
  }



  _pulseLiveUpdate(root, text = "Atualizado") {
    const indicator = root?.querySelector?.("[data-player-live-update]");
    if (!indicator) return;
    indicator.textContent = text;
    indicator.dataset.active = "true";
    if (this._liveUpdateTimer) clearTimeout(this._liveUpdateTimer);
    this._liveUpdateTimer = setTimeout(() => { indicator.dataset.active = "false"; }, 1400);
  }

  async _replaceSubjectCard(root, state, subjectId) {
    const profile = state.profiles?.[this.profileId];
    const subject = state.subjects?.[subjectId];
    const existing = root?.querySelector?.(`[data-player-card][data-subject-id="${globalThis.CSS?.escape ? globalThis.CSS.escape(subjectId) : subjectId}"]`);
    if (!profile || !subject || subject.active === false || subject.archived || !existing) return false;
    const context = buildPlayerCardContext({
      subject,
      relationship: profile.relationships?.[subjectId] ?? { subjectId, score: 0 },
      profileId: this.profileId,
      allowSecondaryDisclosure: false,
      detailEnabled: true
    });
    const html = await renderTemplateHTML(CARD_TEMPLATE, context);
    const replacement = parseSingleElement(html);
    if (!replacement) return false;
    const previousSpecial = existing.querySelector?.("[data-special-state]")?.dataset?.specialState ?? "standard";
    const nextSpecial = replacement.querySelector?.("[data-special-state]")?.dataset?.specialState ?? "standard";
    existing.replaceWith(replacement);
    this._motionController?.relationship?.(replacement);
    if (previousSpecial !== nextSpecial) this._motionController?.protocol?.(replacement.querySelector?.("[data-special-state]"));
    return true;
  }

  async _replaceFocal(root, state) {
    const profile = state.profiles?.[this.profileId];
    const existing = root?.querySelector?.("[data-player-focal-profile]");
    if (!profile || !existing) return false;
    const html = await renderTemplateHTML(FOCAL_TEMPLATE, buildFocalProfileContext(profile));
    const replacement = parseSingleElement(html);
    if (!replacement) return false;
    existing.replaceWith(replacement);
    this._motionController?.transition?.("focal", replacement);
    return true;
  }

  _wireProfileChoices(root) {
    for (const button of root?.querySelectorAll?.("[data-player-profile-choice]") ?? []) {
      listen(this._listeners, button, "click", async () => {
        const nextId = String(button.dataset.playerProfileChoice || "");
        if (!nextId || nextId === this.profileId) return;
        this.profileId = nextId;
        this._pendingMotion = "profile";
        await this.render({ force: true });
      });
    }
  }

  _wireProfileGroupAccordion(root) {
    const groups = [...(root?.querySelectorAll?.("[data-player-profile-library] details[data-profile-group]") ?? [])];
    for (const group of groups) {
      listen(this._listeners, group, "toggle", () => {
        if (!group.open) return;
        for (const other of groups) {
          if (other !== group && other.open) other.open = false;
        }
        group.scrollIntoView?.({ block: "nearest", behavior: "auto" });
      });
    }
  }

  _rewireCardSurface(root) {
    destroyListeners(this._cardListeners);
    this._wireCardDetails(root);
    this._accessibilityController = wireApplicationAccessibility(root, { onEscape: () => this.close() });
  }

  async _onWorldStateSync(event) {
    if (!this.rendered) return;
    const root = appElement(this);
    if (!root) return;
    const { state, diff } = event;
    const profile = state.profiles?.[this.profileId];
    if (!profile || profile.active === false || profile.archived) { await this.render({ force: true }); return; }
    if (diff.changedGroupIds?.length || diff.structuralSubjectIds.length || diff.structuralProfileIds?.includes?.(this.profileId)) { await this.render({ force: true }); return; }
    const ids = new Set(diff.changedSubjectIds);
    for (const change of diff.relationshipChanges) if (change.profileId === this.profileId) ids.add(change.subjectId);
    if (ids.size > 8) { await this.render({ force: true }); return; }
    let patched = 0;
    if (diff.focalProfileIds.includes(this.profileId)) patched += await this._replaceFocal(root, state) ? 1 : 0;
    for (const subjectId of ids) patched += await this._replaceSubjectCard(root, state, subjectId) ? 1 : 0;
    if (!patched && !diff.historyAppended) return;
    this._rewireCardSurface(root);
    const matrixSurface = root.matches?.("[data-player-matrix-surface]") ? root : root.querySelector?.("[data-player-matrix-surface]");
    matrixSurface?.setAttribute?.("data-world-revision", String(state.revision));
    this._pulseLiveUpdate(root, ids.size === 1 ? "Relação atualizada" : "Dados sincronizados");
    this._motionController?.sync?.(root.querySelector?.("[data-player-live-update]") ?? root);
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    destroyListeners(this._listeners);
    destroyListeners(this._cardListeners);
    this._accessibilityController?.destroy?.();
    this._accessibilityController = null;
    this._motionController?.destroy?.();
    this._motionController = null;

    const root = appElement(this);
    if (!root) return;
    this._motionController = wireMotionSystem(root, { kind: "player", boot: !this._motionBooted });
    this._motionBooted = true;
    if (this._pendingMotion) { this._motionController.transition?.(this._pendingMotion, root); this._pendingMotion = ""; }
    this._wireProfileChoices(root);
    this._wireProfileGroupAccordion(root);
    this._wireCardDetails(root);
  }

  async _onClose(options) {
    destroyListeners(this._listeners);
    destroyListeners(this._cardListeners);
    this._accessibilityController?.destroy?.();
    this._accessibilityController = null;
    this._motionController?.destroy?.();
    this._motionController = null;
    this._syncUnsubscribe?.();
    this._syncUnsubscribe = null;
    if (this._liveUpdateTimer) clearTimeout(this._liveUpdateTimer);
    this._liveUpdateTimer = null;
    return super._onClose?.(options);
  }
}

let playerDashboardApp = null;

export function openPlayerDashboard({ profileId = "" } = {}) {
  try {
    if (playerDashboardApp?.rendered) {
      if (profileId) playerDashboardApp.profileId = String(profileId);
      return renderApplicationSafely(playerDashboardApp, { label: "Matriz de Reputação" });
    }
    playerDashboardApp = new ReputationPlayerDashboardApplication({ profileId });
    const rendered = renderApplicationSafely(playerDashboardApp, { label: "Matriz de Reputação" });
    if (!rendered) playerDashboardApp = null;
    return rendered;
  } catch (error) {
    console.error("GMS Reputation | Falha ao criar o Dashboard do Player.", error);
    notify("error", `Matriz de Reputação não pôde ser aberta. ${String(error?.message || error || "Erro de inicialização")}`);
    playerDashboardApp = null;
    return null;
  }
}

export function getOpenPlayerDashboard() {
  return playerDashboardApp?.rendered ? playerDashboardApp : null;
}
