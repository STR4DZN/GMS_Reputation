import { MODULE_ID } from "../../constants.js";
import { WorldStateRepository } from "../../state/repository.js";
import { subscribeWorldStateChanges } from "../../state/sync.js";
import { buildSubjectDetailReadModel } from "../../read-models/player-dashboard.js";
import { motionEngine } from "../../motion/motion-engine.js";

const ApplicationV2Class = globalThis.foundry?.applications?.api?.HandlebarsApplicationV2
  ?? class StandaloneApplication {
    constructor(options = {}) {
      this.options = options;
      this.rendered = false;
    }
    async render(force = false) {
      this.rendered = true;
      return this;
    }
    async close() {
      this.rendered = false;
      return this;
    }
  };

export class ReputationRelationshipDetailApplication extends ApplicationV2Class {
  static DEFAULT_OPTIONS = {
    id: "gms-reputation-relationship-detail",
    classes: ["gms-reputation-app", "gms-reputation-detail-app"],
    tag: "section",
    window: {
      title: "GMS // Registro de Relação",
      icon: "fa-solid fa-address-card",
      resizable: true
    },
    position: { width: 740, height: 700 }
  };

  static PARTS = {
    main: {
      root: true,
      template: `modules/${MODULE_ID}/templates/player/detail.hbs`,
      scrollable: ["[data-detail-scroll]"]
    }
  };

  constructor({ profileId = "", subjectId = "", ...options } = {}) {
    super(options);
    this.profileId = String(profileId || "");
    this.subjectId = String(subjectId || "");
    this._listeners = [];
    this._syncUnsubscribe = null;

    this._syncUnsubscribe = subscribeWorldStateChanges((event) => this._onWorldStateSync(event));
  }

  async _prepareContext(options) {
    const parent = await super._prepareContext?.(options) ?? {};
    const state = WorldStateRepository.load();
    const detail = buildSubjectDetailReadModel({
      profileId: this.profileId,
      subjectId: this.subjectId,
      state
    });
    return { ...parent, ...detail };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    if (!root) return;

    // Attach close listener
    const closeBtn = root.querySelector?.("[data-action='close-detail']");
    if (closeBtn) {
      const onClose = () => this.close();
      closeBtn.addEventListener("click", onClose, { once: true });
    }

    // WAAPI entry animation
    motionEngine.modalEnter(root);
  }

  async _onWorldStateSync(event) {
    if (!this.rendered) return;
    const { diff } = event;

    const relChanged = diff.relationshipChanges?.some?.(
      (c) => c.profileId === this.profileId && c.subjectId === this.subjectId
    );
    const subjChanged = diff.changedSubjectIds?.includes?.(this.subjectId);
    const profChanged = diff.changedProfileIds?.includes?.(this.profileId);

    if (relChanged || subjChanged || profChanged) {
      await this.render({ force: true });
      if (this.element) {
        motionEngine.pulse(this.element.querySelector(".gms-subject-detail__hero") || this.element);
      }
    }
  }

  async close(options) {
    this._syncUnsubscribe?.();
    this._syncUnsubscribe = null;
    return super.close(options);
  }
}

let activeDetailApp = null;

export function openRelationshipDetail({ profileId = "", subjectId = "" } = {}) {
  if (!profileId || !subjectId) return null;
  activeDetailApp?.close?.();
  activeDetailApp = new ReputationRelationshipDetailApplication({ profileId, subjectId });
  activeDetailApp.render(true);
  return activeDetailApp;
}
