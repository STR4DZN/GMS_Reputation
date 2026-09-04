import { MODULE_ID } from "../constants.js";
import { loadWorldState } from "../persistence/world-store.js";
import { listHistory } from "../data/history-registry.js";
import { buildPortraitFrameModel } from "../components/portrait-frame.js";
import { buildIdentityModel } from "../components/identity.js";
import { buildHeartTrackModel } from "../components/heart-track.js";
import { getReputationView } from "../core/reputation-engine.js";
import { buildPlayerCardContext } from "../components/player-card.js";
import { HandlebarsApplicationV2, appElement, destroyListeners, listen, notify } from "./application-compat.js";
import { subscribeWorldStateChanges } from "../events/world-sync.js";
import { wireApplicationAccessibility } from "../utils/accessibility.js";
import { wireMotionSystem } from "../motion/motion-system.js";

const PARTIALS = [
  `modules/${MODULE_ID}/templates/partials/portrait-frame.hbs`,
  `modules/${MODULE_ID}/templates/partials/identity.hbs`,
  `modules/${MODULE_ID}/templates/partials/heart-track.hbs`
];

export function buildSubjectDetailContext({ profileId = "", subjectId = "", state = loadWorldState() } = {}) {
  const profile = state.profiles?.[String(profileId)] ?? null;
  const subject = state.subjects?.[String(subjectId)] ?? null;
  if (!profile || !subject) return Object.freeze({ found: false, profileId: String(profileId), subjectId: String(subjectId) });

  const relationship = profile.relationships?.[subject.id] ?? { subjectId: subject.id, score: 0 };
  const view = getReputationView(relationship);
  const card = buildPlayerCardContext({ subject, relationship, profileId: profile.id, allowSecondaryDisclosure: false });
  const identity = buildIdentityModel(subject);
  const portrait = buildPortraitFrameModel(subject.portrait, {
    kind: "subject-detail",
    label: `Retrato de ${identity.alias}`,
    lazy: false
  });
  const hearts = buildHeartTrackModel(view.relationship);
  const history = listHistory({ state, profileId: profile.id, subjectId: subject.id, limit: 30 });
  const tags = Array.isArray(subject.metadata?.tags) ? subject.metadata.tags.map(String).filter(Boolean) : [];

  return Object.freeze({
    found: true,
    profileId: profile.id,
    profileName: profile.name,
    subjectId: subject.id,
    identity,
    portrait,
    relationship: card.relationship,
    score: card.score,
    hearts,
    special: card.special,
    description: String(subject.description || "").trim(),
    hasDescription: Boolean(String(subject.description || "").trim()),
    history,
    hasHistory: history.length > 0,
    historyReserved: history.length === 0,
    tags: Object.freeze(tags),
    hasTags: tags.length > 0
  });
}

export class ReputationSubjectDetailApplication extends HandlebarsApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "gms-reputation-subject-detail",
    classes: ["gms-reputation-app", "gms-reputation-subject-detail-app"],
    tag: "section",
    window: {
      title: "GMS // Detalhes da Relação",
      icon: "fa-solid fa-address-card",
      resizable: true
    },
    position: { width: 760, height: 700 }
  };

  static PARTS = {
    main: {
      root: true,
      template: `modules/${MODULE_ID}/templates/apps/subject-detail.hbs`,
      templates: PARTIALS,
      scrollable: [".gms-subject-detail__body"]
    }
  };

  constructor({ profileId = "", subjectId = "", ...options } = {}) {
    super(options);
    this.profileId = String(profileId || "");
    this.subjectId = String(subjectId || "");
    this._listeners = [];
    this._accessibilityController = null;
    this._motionController = null;
    this._motionBooted = false;
    this._pendingMotion = "";
    this._syncUnsubscribe = subscribeWorldStateChanges((event) => {
      if (!this.rendered) return;
      const relevantRelationship = event.diff.relationshipChanges.some((change) => change.profileId === this.profileId && change.subjectId === this.subjectId);
      const relevantSubject = event.diff.changedSubjectIds.includes(this.subjectId);
      const relevantProfile = event.diff.changedProfileIds.includes(this.profileId);
      if (relevantRelationship || relevantSubject || relevantProfile) { this._pendingMotion = relevantRelationship ? "relation" : "detail"; this.render({ force: true }); }
    });
  }

  async _prepareContext(options) {
    const parent = await super._prepareContext?.(options) ?? {};
    return { ...parent, ...buildSubjectDetailContext({ profileId: this.profileId, subjectId: this.subjectId }) };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    destroyListeners(this._listeners);
    const root = appElement(this);
    const close = root?.querySelector?.("[data-subject-detail-close]");
    listen(this._listeners, close, "click", () => this.close());
    this._accessibilityController?.destroy?.();
    this._accessibilityController = wireApplicationAccessibility(root, { onEscape: () => this.close() });
    this._motionController?.destroy?.();
    this._motionController = wireMotionSystem(root, { kind: "detail", boot: !this._motionBooted });
    this._motionBooted = true;
    if (this._pendingMotion === "relation") this._motionController.relationship?.(root.querySelector?.("[data-subject-detail-root]") ?? root);
    else if (this._pendingMotion) this._motionController.transition?.("detail", root);
    this._pendingMotion = "";
  }

  async _onClose(options) {
    destroyListeners(this._listeners);
    this._accessibilityController?.destroy?.();
    this._accessibilityController = null;
    this._motionController?.destroy?.();
    this._motionController = null;
    this._syncUnsubscribe?.();
    this._syncUnsubscribe = null;
    return super._onClose?.(options);
  }
}

let detailApp = null;

export function openSubjectDetail({ profileId = "", subjectId = "" } = {}) {
  if (!profileId || !subjectId) {
    notify("warn", "Selecione um perfil e uma relação para abrir os detalhes.");
    return null;
  }
  detailApp?.close?.();
  detailApp = new ReputationSubjectDetailApplication({ profileId, subjectId });
  detailApp.render(true);
  return detailApp;
}
