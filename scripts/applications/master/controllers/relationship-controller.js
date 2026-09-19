import { MODULE_ID } from "../../../constants.js";
import { WorldStateRepository } from "../../../state/repository.js";
import { ReputationService } from "../../../services/reputation-service.js";
import { deriveRelationshipView } from "../../../domain/reputation.js";
import { clampScore, deriveSpecialLimits } from "../../../domain/score.js";
import { buildHeartTrackModel } from "../../../components/reputation-track.js";
import { buildPortraitFrameModel } from "../../../components/portrait.js";
import { motionEngine } from "../../../motion/motion-engine.js";

const TEMPLATE = `modules/${MODULE_ID}/templates/master/relationship.hbs`;

async function renderTemplateSafe(path, context) {
  const render = globalThis.foundry?.applications?.handlebars?.renderTemplate
    ?? globalThis.renderTemplate;
  if (typeof render === "function") {
    return render(path, context);
  }
  return "";
}

export class RelationshipController {
  constructor() {
    this.container = null;
    this.shell = null;
    this.selectedProfileId = null;
    this.selectedSubjectId = null;
    this.searchQuery = "";
    this.bulkMode = false;
    this.bulkSelected = new Set();
    this._listeners = [];
  }

  async mount(container, { profileId = "", subjectId = "", shell = null } = {}) {
    this.container = container;
    this.shell = shell;
    const state = WorldStateRepository.load();

    const profiles = Object.values(state.profiles ?? {}).filter((p) => !p.archived);
    this.selectedProfileId = profileId || this.selectedProfileId || profiles[0]?.id || null;

    const profile = state.profiles?.[this.selectedProfileId];
    const roster = Array.isArray(profile?.subjectIds) ? profile.subjectIds : Object.keys(profile?.relationships ?? {});
    this.selectedSubjectId = subjectId || this.selectedSubjectId || roster[0] || null;

    const context = this._buildContext(state);
    const html = await renderTemplateSafe(TEMPLATE, context);
    if (this.container) {
      this.container.innerHTML = html;
      this._wireEvents();
    }
  }

  _buildContext(state) {
    const rawProfiles = Object.values(state.profiles ?? {}).filter((p) => !p.archived);
    const profiles = rawProfiles.map((p) => ({
      id: p.id,
      name: p.name,
      selected: p.id === this.selectedProfileId
    }));

    const profile = state.profiles?.[this.selectedProfileId] ?? null;
    let rosterList = [];

    if (profile) {
      const rosterIds = Array.isArray(profile.subjectIds) ? profile.subjectIds : Object.keys(profile.relationships ?? {});
      const allSubjects = Object.values(state.subjects ?? {}).filter((s) => !s.archived);
      const subjectMap = new Map(allSubjects.map((s) => [String(s.id), s]));

      let filteredIds = rosterIds.filter((id) => subjectMap.has(String(id)));
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        filteredIds = filteredIds.filter((id) => {
          const s = subjectMap.get(String(id));
          return String(s.alias || "").toLowerCase().includes(q) || String(s.realName || "").toLowerCase().includes(q);
        });
      }

      rosterList = filteredIds.map((id) => {
        const s = subjectMap.get(String(id));
        const rel = profile.relationships?.[id] ?? { subjectId: id, score: 0 };
        const view = deriveRelationshipView(rel);
        return {
          subjectId: s.id,
          alias: s.alias,
          portrait: s.portrait ?? {},
          bandId: view.band.id,
          bandLabel: view.band.label,
          accent: view.band.accent,
          scoreText: view.scoreFormatted,
          selected: s.id === this.selectedSubjectId,
          bulkChecked: this.bulkSelected.has(String(s.id))
        };
      });
    }

    const currentSubject = state.subjects?.[this.selectedSubjectId] ?? null;
    const currentRelationship = profile?.relationships?.[this.selectedSubjectId] ?? { subjectId: this.selectedSubjectId, score: 0 };
    const hasSelectedRelation = Boolean(profile && currentSubject);

    let relationView = null;
    let heartTrackModel = null;
    let currentPortraitContext = null;
    let isDualSync = false;

    if (hasSelectedRelation) {
      relationView = deriveRelationshipView(currentRelationship);
      heartTrackModel = buildHeartTrackModel(currentRelationship);
      currentPortraitContext = buildPortraitFrameModel(currentSubject.portrait, {
        label: `Retrato de ${currentSubject.alias}`,
        kind: "subject"
      });
      isDualSync = Boolean(currentRelationship.bond && currentRelationship.communion && currentRelationship.score >= 10);
    }

    return {
      profiles,
      searchQuery: this.searchQuery,
      bulkMode: this.bulkMode,
      rosterList,
      hasSelectedRelation,
      currentSubject,
      currentRelationship,
      relationView,
      heartTrackModel,
      currentPortraitContext,
      isDualSync,
      showBulkBar: this.bulkSelected.size >= 2,
      bulkCount: this.bulkSelected.size
    };
  }

  _wireEvents() {
    if (!this.container) return;
    this._cleanupListeners();

    // Profile selector
    const profileSelect = this.container.querySelector("[data-action='select-profile']");
    if (profileSelect) {
      const onSelect = () => {
        this.selectedProfileId = profileSelect.value;
        this.selectedSubjectId = null;
        this.bulkSelected.clear();
        if (this.shell) this.shell.selectedProfileId = this.selectedProfileId;
        this.mount(this.container, { profileId: this.selectedProfileId, shell: this.shell });
      };
      profileSelect.addEventListener("change", onSelect);
      this._listeners.push(() => profileSelect.removeEventListener("change", onSelect));
    }

    // Search input
    const searchInput = this.container.querySelector("[data-action='filter-subjects']");
    if (searchInput) {
      const onSearch = () => {
        this.searchQuery = searchInput.value;
        this.mount(this.container, {
          profileId: this.selectedProfileId,
          subjectId: this.selectedSubjectId,
          shell: this.shell
        });
      };
      searchInput.addEventListener("input", onSearch);
      this._listeners.push(() => searchInput.removeEventListener("input", onSearch));
    }

    // Toggle bulk mode
    const bulkBtn = this.container.querySelector("[data-action='toggle-bulk-mode']");
    if (bulkBtn) {
      const onToggleBulk = () => {
        this.bulkMode = !this.bulkMode;
        if (!this.bulkMode) this.bulkSelected.clear();
        this.mount(this.container, {
          profileId: this.selectedProfileId,
          subjectId: this.selectedSubjectId,
          shell: this.shell
        });
      };
      bulkBtn.addEventListener("click", onToggleBulk);
      this._listeners.push(() => bulkBtn.removeEventListener("click", onToggleBulk));
    }

    // Select subject card
    const cards = this.container.querySelectorAll(".gms-reputation-roster-card");
    for (const card of cards) {
      const onClick = (e) => {
        if (e.target.closest("input[data-action='bulk-check']")) return;
        const id = card.dataset.subjectId;
        if (id && id !== this.selectedSubjectId) {
          this.selectedSubjectId = id;
          if (this.shell) this.shell.selectedSubjectId = id;
          this.mount(this.container, {
            profileId: this.selectedProfileId,
            subjectId: id,
            shell: this.shell
          });
        }
      };
      card.addEventListener("click", onClick);
      this._listeners.push(() => card.removeEventListener("click", onClick));
    }

    // Bulk checkboxes
    const bulkCheckboxes = this.container.querySelectorAll("[data-action='bulk-check']");
    for (const cb of bulkCheckboxes) {
      const onCheck = (e) => {
        e.stopPropagation();
        const id = cb.dataset.subjectId;
        if (cb.checked) this.bulkSelected.add(String(id));
        else this.bulkSelected.delete(String(id));
        this.mount(this.container, {
          profileId: this.selectedProfileId,
          subjectId: this.selectedSubjectId,
          shell: this.shell
        });
      };
      cb.addEventListener("change", onCheck);
      this._listeners.push(() => cb.removeEventListener("change", onCheck));
    }

    // Stepper delta buttons
    const deltaButtons = this.container.querySelectorAll("[data-action='delta-score']");
    for (const btn of deltaButtons) {
      const onDelta = async () => {
        const delta = Number(btn.dataset.delta);
        const state = WorldStateRepository.load();
        const profile = state.profiles?.[this.selectedProfileId];
        const currentRel = profile?.relationships?.[this.selectedSubjectId] ?? { score: 0 };
        const limits = deriveSpecialLimits(currentRel.bond, currentRel.communion);
        const nextScore = clampScore(currentRel.score + delta, limits);

        await ReputationService.update({
          profileId: this.selectedProfileId,
          subjectId: this.selectedSubjectId,
          score: nextScore
        });

        const stepper = this.container.querySelector(".gms-stepper");
        if (stepper) motionEngine.pulse(stepper);
      };
      btn.addEventListener("click", onDelta);
      this._listeners.push(() => btn.removeEventListener("click", onDelta));
    }

    // Preset score buttons
    const presetButtons = this.container.querySelectorAll("[data-action='set-score']");
    for (const btn of presetButtons) {
      const onPreset = async () => {
        const val = Number(btn.dataset.value);
        const state = WorldStateRepository.load();
        const profile = state.profiles?.[this.selectedProfileId];
        const currentRel = profile?.relationships?.[this.selectedSubjectId] ?? { score: 0 };
        const limits = deriveSpecialLimits(currentRel.bond, currentRel.communion);
        const nextScore = clampScore(val, limits);

        await ReputationService.update({
          profileId: this.selectedProfileId,
          subjectId: this.selectedSubjectId,
          score: nextScore
        });

        const hero = this.container.querySelector(".gms-reputation-stage__hero");
        if (hero) motionEngine.pulse(hero);
      };
      btn.addEventListener("click", onPreset);
      this._listeners.push(() => btn.removeEventListener("click", onPreset));
    }

    // Direct score input
    const scoreInput = this.container.querySelector("input[data-field='score']");
    if (scoreInput) {
      const onScoreInput = () => {
        scoreInput.dataset.dirty = "true";
        this.shell?.saveController?.queue?.(`rel-score-${this.selectedSubjectId}`, async () => {
          const val = Number(scoreInput.value);
          if (Number.isFinite(val)) {
            await ReputationService.update({
              profileId: this.selectedProfileId,
              subjectId: this.selectedSubjectId,
              score: val
            });
          }
          scoreInput.dataset.dirty = "false";
        });
      };
      scoreInput.addEventListener("input", onScoreInput);
      this._listeners.push(() => scoreInput.removeEventListener("input", onScoreInput));
    }

    // Toggle Bond protocol
    const bondBtn = this.container.querySelector("[data-action='toggle-bond']");
    if (bondBtn) {
      const onBond = async () => {
        const state = WorldStateRepository.load();
        const profile = state.profiles?.[this.selectedProfileId];
        const currentRel = profile?.relationships?.[this.selectedSubjectId] ?? { score: 0, bond: false };
        await ReputationService.update({
          profileId: this.selectedProfileId,
          subjectId: this.selectedSubjectId,
          bond: !currentRel.bond
        });
        motionEngine.protocol(bondBtn);
      };
      bondBtn.addEventListener("click", onBond);
      this._listeners.push(() => bondBtn.removeEventListener("click", onBond));
    }

    // Toggle Communion protocol
    const communionBtn = this.container.querySelector("[data-action='toggle-communion']");
    if (communionBtn) {
      const onCommunion = async () => {
        const state = WorldStateRepository.load();
        const profile = state.profiles?.[this.selectedProfileId];
        const currentRel = profile?.relationships?.[this.selectedSubjectId] ?? { score: 0, communion: false };
        await ReputationService.update({
          profileId: this.selectedProfileId,
          subjectId: this.selectedSubjectId,
          communion: !currentRel.communion
        });
        motionEngine.protocol(communionBtn);
      };
      communionBtn.addEventListener("click", onCommunion);
      this._listeners.push(() => communionBtn.removeEventListener("click", onCommunion));
    }

    // Note input
    const noteInput = this.container.querySelector("textarea[data-field='note']");
    if (noteInput) {
      const onNoteInput = () => {
        noteInput.dataset.dirty = "true";
        this.shell?.saveController?.queue?.(`rel-note-${this.selectedSubjectId}`, async () => {
          await ReputationService.update({
            profileId: this.selectedProfileId,
            subjectId: this.selectedSubjectId,
            note: noteInput.value
          });
          noteInput.dataset.dirty = "false";
        });
      };
      noteInput.addEventListener("input", onNoteInput);
      this._listeners.push(() => noteInput.removeEventListener("input", onNoteInput));
    }

    // Bulk bar actions
    const bulkBar = this.container.querySelector("[data-bulk-bar]");
    if (bulkBar) {
      const onBulkDelta = async (e) => {
        const btn = e.target.closest("[data-action='bulk-delta']");
        if (!btn) return;
        const delta = Number(btn.dataset.delta);
        await ReputationService.bulkUpdate({
          profileId: this.selectedProfileId,
          subjectIds: Array.from(this.bulkSelected),
          scoreDelta: delta
        });
      };

      const onBulkSet = async (e) => {
        const btn = e.target.closest("[data-action='bulk-set']");
        if (!btn) return;
        const val = Number(btn.dataset.value);
        await ReputationService.bulkUpdate({
          profileId: this.selectedProfileId,
          subjectIds: Array.from(this.bulkSelected),
          scoreSet: val
        });
      };

      const onBulkBond = async (e) => {
        const btn = e.target.closest("[data-action='bulk-bond']");
        if (!btn) return;
        const state = btn.dataset.state === "true";
        await ReputationService.bulkUpdate({
          profileId: this.selectedProfileId,
          subjectIds: Array.from(this.bulkSelected),
          bond: state
        });
      };

      const onBulkCommunion = async (e) => {
        const btn = e.target.closest("[data-action='bulk-communion']");
        if (!btn) return;
        const state = btn.dataset.state === "true";
        await ReputationService.bulkUpdate({
          profileId: this.selectedProfileId,
          subjectIds: Array.from(this.bulkSelected),
          communion: state
        });
      };

      const onBulkClear = (e) => {
        const btn = e.target.closest("[data-action='bulk-clear']");
        if (!btn) return;
        this.bulkSelected.clear();
        this.mount(this.container, {
          profileId: this.selectedProfileId,
          subjectId: this.selectedSubjectId,
          shell: this.shell
        });
      };

      bulkBar.addEventListener("click", onBulkDelta);
      bulkBar.addEventListener("click", onBulkSet);
      bulkBar.addEventListener("click", onBulkBond);
      bulkBar.addEventListener("click", onBulkCommunion);
      bulkBar.addEventListener("click", onBulkClear);

      this._listeners.push(() => {
        bulkBar.removeEventListener("click", onBulkDelta);
        bulkBar.removeEventListener("click", onBulkSet);
        bulkBar.removeEventListener("click", onBulkBond);
        bulkBar.removeEventListener("click", onBulkCommunion);
        bulkBar.removeEventListener("click", onBulkClear);
      });
    }
  }

  _cleanupListeners() {
    this._listeners.forEach((cleanup) => cleanup());
    this._listeners = [];
  }

  async patch(diff, state) {
    const relChanges = diff.relationshipChanges?.filter(
      (c) => c.profileId === this.selectedProfileId
    ) ?? [];

    if (!relChanges.length) return false;

    // Check if the currently active subject was modified
    const currentChanged = relChanges.some((c) => c.subjectId === this.selectedSubjectId);
    if (currentChanged) {
      // Fast in-place patch without full DOM recreation (Section 50)
      const profile = state.profiles?.[this.selectedProfileId];
      const rel = profile?.relationships?.[this.selectedSubjectId] ?? { score: 0 };
      const view = deriveRelationshipView(rel);

      const scoreInput = this.container?.querySelector?.("input[data-field='score']");
      if (scoreInput && document.activeElement !== scoreInput) {
        scoreInput.value = String(rel.score);
      }

      const bandDisplay = this.container?.querySelector?.(".gms-reputation-stage__band-display");
      if (bandDisplay) {
        bandDisplay.style.setProperty("--band-accent", view.band.accent);
        const label = bandDisplay.querySelector(".gms-band-label");
        const polarity = bandDisplay.querySelector(".gms-polarity-tag");
        if (label) label.textContent = view.band.label;
        if (polarity) polarity.textContent = view.polarity;
      }

      const trackWrap = this.container?.querySelector?.(".gms-reputation-stage__track-wrap");
      if (trackWrap) {
        const heartModel = buildHeartTrackModel(rel);
        const trackHtml = await renderTemplateSafe(
          `modules/${MODULE_ID}/templates/components/reputation-track.hbs`,
          heartModel
        );
        if (trackHtml) trackWrap.innerHTML = trackHtml;
      }

      const bondBtn = this.container?.querySelector?.("[data-action='toggle-bond']");
      if (bondBtn) {
        bondBtn.classList.toggle("is-active", Boolean(rel.bond));
        const status = bondBtn.querySelector(".gms-protocol-toggle__status");
        if (status) status.textContent = rel.bond ? "ATIVO" : "INATIVO";
      }

      const communionBtn = this.container?.querySelector?.("[data-action='toggle-communion']");
      if (communionBtn) {
        communionBtn.classList.toggle("is-active", Boolean(rel.communion));
        const status = communionBtn.querySelector(".gms-protocol-toggle__status");
        if (status) status.textContent = rel.communion ? "ATIVA" : "INATIVA";
      }

      const dualSync = this.container?.querySelector?.(".gms-protocol-toggle.is-derived");
      if (dualSync) {
        const isDual = Boolean(rel.bond && rel.communion && rel.score >= 10);
        dualSync.classList.toggle("is-active", isDual);
        const status = dualSync.querySelector(".gms-protocol-toggle__status");
        if (status) status.textContent = isDual ? "RESSONÂNCIA" : "DESALINHADO";
      }

      // Also update score text in roster card
      const rosterCard = this.container?.querySelector?.(`.gms-reputation-roster-card[data-subject-id="${this.selectedSubjectId}"]`);
      if (rosterCard) {
        const scoreStrong = rosterCard.querySelector(".gms-reputation-roster-card__score strong");
        if (scoreStrong) scoreStrong.textContent = view.scoreFormatted;
        const bandSpan = rosterCard.querySelector(".gms-reputation-roster-card__band");
        if (bandSpan) {
          bandSpan.textContent = view.band.label;
          bandSpan.style.setProperty("--band-accent", view.band.accent);
        }
      }

      return true;
    }

    return false;
  }

  unmount() {
    this._cleanupListeners();
    this.container = null;
    this.shell = null;
  }
}
