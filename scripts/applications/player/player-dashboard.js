import { MODULE_ID } from "../../constants.js";
import { WorldStateRepository } from "../../state/repository.js";
import { subscribeWorldStateChanges } from "../../state/sync.js";
import { buildPlayerDashboardReadModel, buildPlayerCardReadModel } from "../../read-models/player-dashboard.js";
import { renderQueue } from "../../runtime/render-queue.js";
import { motionEngine } from "../../motion/motion-engine.js";
import { openRelationshipDetail } from "./relationship-detail.js";
import { getApplicationV2Base } from "../base-application.js";

const ApplicationV2Class = getApplicationV2Base();

const CARD_TEMPLATE = `modules/${MODULE_ID}/templates/player/card.hbs`;

async function renderTemplateSafe(path, context) {
  const render = globalThis.foundry?.applications?.handlebars?.renderTemplate
    ?? globalThis.renderTemplate;
  if (typeof render === "function") {
    return render(path, context);
  }
  return null;
}

function parseElement(html) {
  if (!html) return null;
  const parse = globalThis.foundry?.utils?.parseHTML ?? globalThis.foundry?.applications?.parseHTML;
  if (typeof parse === "function") {
    const result = parse(String(html));
    if (result?.querySelector) return result;
    if (result?.[0]?.querySelector) return result[0];
  }
  if (typeof globalThis.DOMParser === "function") {
    return new DOMParser().parseFromString(String(html), "text/html").body.firstElementChild;
  }
  return null;
}

export class ReputationPlayerDashboardApplication extends ApplicationV2Class {
  static DEFAULT_OPTIONS = {
    id: "gms-reputation-player-dashboard",
    classes: ["gms-reputation-app", "gms-reputation-player-dashboard-app"],
    tag: "section",
    window: {
      title: "GMS // Matriz de Reputação",
      icon: "fa-solid fa-people-arrows-left-right",
      resizable: true
    },
    position: { width: 960, height: 800 }
  };

  static PARTS = {
    main: {
      root: true,
      template: `modules/${MODULE_ID}/templates/player/dashboard.hbs`,
      scrollable: ["[data-player-scroll]"]
    }
  };

  constructor({ profileId = "", ...options } = {}) {
    super(options);
    this.profileId = String(profileId || "");
    this._syncUnsubscribe = null;
    this._liveTimer = null;
    this._isFirstRender = true;

    this._syncUnsubscribe = subscribeWorldStateChanges((event) => this._onWorldStateSync(event));
  }

  async _prepareContext(options) {
    const parent = await super._prepareContext?.(options) ?? {};
    const state = WorldStateRepository.load();
    const context = buildPlayerDashboardReadModel({ profileId: this.profileId, state });
    if (context.hasProfile) {
      this.profileId = context.profileId;
    }
    return { ...parent, ...context };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    if (!root) return;

    this._wireCards(root);
    this._wireLibraryDrawer(root);

    if (this._isFirstRender) {
      this._isFirstRender = false;
      const focalEl = root.querySelector("[data-player-focal-profile]");
      const gridEl = root.querySelector("[data-player-cards-grid]");
      if (focalEl) motionEngine.scannerLine(focalEl);
      if (gridEl) motionEngine.staggerList(gridEl.children);
    }
  }

  _wireCards(root) {
    const cards = root.querySelectorAll?.("[data-player-card]") ?? [];
    for (const card of cards) {
      const open = (e) => {
        if (e.target.closest("button, summary, details, a, input, select, textarea")) return;
        const profileId = card.dataset.profileId || this.profileId;
        const subjectId = card.dataset.subjectId;
        if (profileId && subjectId) {
          openRelationshipDetail({ profileId, subjectId });
        }
      };

      card.addEventListener("click", open);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(e);
        }
      });
    }
  }

  _wireLibraryDrawer(root) {
    const toggleBtn = root.querySelector?.("[data-action='toggle-library']");
    const closeBtn = root.querySelector?.("[data-action='close-library']");
    const drawer = root.querySelector?.("[data-player-library-drawer]");

    const openDrawer = () => {
      if (!drawer) return;
      drawer.hidden = false;
      toggleBtn?.setAttribute("aria-expanded", "true");
      motionEngine.fade(drawer, "in", 200);
    };

    const closeDrawer = () => {
      if (!drawer) return;
      motionEngine.fade(drawer, "out", 150).finished.then(() => {
        drawer.hidden = true;
        toggleBtn?.setAttribute("aria-expanded", "false");
      });
    };

    toggleBtn?.addEventListener("click", () => {
      if (drawer?.hidden) openDrawer();
      else closeDrawer();
    });

    closeBtn?.addEventListener("click", closeDrawer);

    // Profile choices
    const choices = root.querySelectorAll?.("[data-player-profile-choice]") ?? [];
    for (const choice of choices) {
      choice.addEventListener("click", async () => {
        const nextId = choice.dataset.playerProfileChoice;
        if (!nextId || nextId === this.profileId) {
          closeDrawer();
          return;
        }

        const focalEl = root.querySelector("[data-player-focal-profile]");
        if (focalEl) {
          await motionEngine.fade(focalEl, "out", 180).finished;
        }

        this.profileId = nextId;
        await this.render({ force: true });
        closeDrawer();

        const newFocal = this.element?.querySelector?.("[data-player-focal-profile]");
        if (newFocal) {
          motionEngine.scannerLine(newFocal);
        }
        const grid = this.element?.querySelector?.("[data-player-cards-grid]");
        if (grid) {
          motionEngine.staggerList(grid.children);
        }
      });
    }

    // Accordions
    const accordionTriggers = root.querySelectorAll?.("[data-action='toggle-group']") ?? [];
    for (const trigger of accordionTriggers) {
      trigger.addEventListener("click", () => {
        const parent = trigger.closest(".gms-profile-group-accordion");
        const content = parent?.querySelector(".gms-profile-group-accordion__content");
        if (!parent || !content) return;
        const isOpen = parent.classList.contains("is-open");
        if (isOpen) {
          parent.classList.remove("is-open");
          content.hidden = true;
          trigger.setAttribute("aria-expanded", "false");
        } else {
          parent.classList.add("is-open");
          content.hidden = false;
          trigger.setAttribute("aria-expanded", "true");
        }
      });
    }
  }

  _pulseLiveIndicator(text = "Sincronizado") {
    const root = this.element;
    const badge = root?.querySelector?.("[data-player-live-update]");
    if (!badge) return;

    badge.textContent = text;
    badge.dataset.active = "true";
    if (this._liveTimer) clearTimeout(this._liveTimer);
    this._liveTimer = setTimeout(() => {
      if (badge) badge.dataset.active = "false";
    }, 1400);
  }

  async _patchCard(subjectId, state) {
    const root = this.element;
    if (!root) return false;

    const profile = state.profiles?.[this.profileId];
    const subject = state.subjects?.[subjectId];
    if (!profile || !subject || subject.active === false || subject.archived) return false;

    const cardModel = buildPlayerCardReadModel({
      subject,
      relationship: profile.relationships?.[subjectId] ?? { subjectId, score: 0 },
      profileId: this.profileId
    });

    const selector = `[data-player-card][data-subject-id="${globalThis.CSS?.escape ? globalThis.CSS.escape(subjectId) : subjectId}"]`;
    const existing = root.querySelector(selector);
    if (!existing) return false;

    const html = await renderTemplateSafe(CARD_TEMPLATE, cardModel);
    const replacement = parseElement(html);
    if (!replacement) return false;

    renderQueue.enqueueDom(() => {
      existing.replaceWith(replacement);
      motionEngine.pulse(replacement);
      this._wireCards(this.element);
    });

    return true;
  }

  async _onWorldStateSync(event) {
    if (!this.rendered) return;
    const { state, diff } = event;

    const profile = state.profiles?.[this.profileId];
    if (!profile || profile.active === false || profile.archived) {
      await this.render({ force: true });
      return;
    }

    if (
      diff.changedGroupIds?.length ||
      diff.structuralSubjectIds?.length ||
      diff.structuralProfileIds?.includes?.(this.profileId)
    ) {
      await this.render({ force: true });
      return;
    }

    const relevantChangedSubjects = new Set(diff.changedSubjectIds ?? []);
    for (const rel of diff.relationshipChanges ?? []) {
      if (rel.profileId === this.profileId) {
        relevantChangedSubjects.add(rel.subjectId);
      }
    }

    if (relevantChangedSubjects.size > 8) {
      await this.render({ force: true });
      return;
    }

    if (relevantChangedSubjects.size > 0) {
      for (const subjId of relevantChangedSubjects) {
        await this._patchCard(subjId, state);
      }
      this._pulseLiveIndicator("Atualizado");
    }
  }

  async render(options = {}) {
    const opts = typeof options === "boolean" ? { force: options } : (options ?? {});
    return super.render(opts);
  }

  async close(options) {
    this._syncUnsubscribe?.();
    this._syncUnsubscribe = null;
    if (this._liveTimer) {
      clearTimeout(this._liveTimer);
      this._liveTimer = null;
    }
    return super.close(options);
  }
}

let activePlayerApp = null;

export function openPlayerDashboard({ profileId = "" } = {}) {
  activePlayerApp?.close?.();
  activePlayerApp = new ReputationPlayerDashboardApplication({ profileId });
  activePlayerApp.render({ force: true });
  return activePlayerApp;
}

