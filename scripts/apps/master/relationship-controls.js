import { destroyListeners, listen } from "../application-compat.js";
import { getSemanticBand } from "../../core/semantic-bands.js";

/** Owns score/protocol previews and delegates draft/save ownership to the panel. */
export function wireMasterRelationshipControls(root, { getMotionController, queueDraft, flushPending }) {
  const listeners = [];
  const scoreInput = root.querySelector("[data-master-score-input]");
  const scoreRange = root.querySelector("[data-master-score-range]");
  const bondInput = root.querySelector("[data-master-bond]");
  const communionInput = root.querySelector("[data-master-communion]");

  const updatePreview = (value, { animate = true } = {}) => {
    const expanded = Boolean(bondInput?.checked || communionInput?.checked);
    const limit = expanded ? 12 : 10;
    const numeric = Math.min(limit, Math.max(-10, Math.round((Number(value) || 0) * 2) / 2));
    const scoreText = Number.isInteger(numeric) ? String(numeric) : String(numeric).replace(".", ",");
    const band = getSemanticBand(numeric, { bond: expanded });
    const scorePreview = root.querySelector("[data-master-score-preview]");
    if (scorePreview) { scorePreview.textContent = scoreText; scorePreview.closest?.("[data-master-relation-console]")?.setAttribute?.("data-relation-band", band.id); }
    const relationPreview = root.querySelector("[data-master-relation-preview]");
    if (relationPreview) relationPreview.textContent = band.label;
    const limitPreview = root.querySelector("[data-master-score-limit-preview]");
    if (limitPreview) limitPreview.textContent = String(limit);
    const track = root.querySelector(".gms-master-reputation-console .gms-reputation-heart-track");
    if (track) {
      for (const id of ["hostile","caution","neutral","contact","trusted","ally","extreme"]) track.classList.remove(`is-band-${id}`);
      track.classList.add(`is-band-${band.id}`);
      track.dataset.heartBand = band.id;
      const magnitude = Math.abs(numeric);
      const full = Math.floor(magnitude);
      const half = magnitude - full >= .5;
      for (const heart of track.querySelectorAll("[data-heart-ordinal]")) {
        const index = Number(heart.dataset.heartOrdinal) - 1;
        heart.dataset.heartState = index < full ? "full" : (index === full && half ? "half" : "empty");
      }
    }
    if (animate) getMotionController()?.relationship?.(root.querySelector?.("[data-master-relation-console]"));
    return numeric;
  };

  const setScoreDraft = (value) => {
    if (!scoreInput) return;
    const numeric = updatePreview(value);
    const expanded = Boolean(bondInput?.checked || communionInput?.checked);
    const limit = expanded ? 12 : 10;
    scoreInput.max = String(limit);
    scoreInput.value = String(numeric);
    if (scoreRange) { scoreRange.max = String(limit); scoreRange.value = String(numeric); }
    queueDraft();
  };

  for (const button of root.querySelectorAll("[data-master-score-delta]")) {
    listen(listeners, button, "click", () => setScoreDraft(Number(scoreInput?.value || 0) + Number(button.dataset.masterScoreDelta)));
  }
  for (const button of root.querySelectorAll("[data-master-score-preset]")) {
    listen(listeners, button, "click", () => setScoreDraft(Number(button.dataset.masterScorePreset)));
  }
  listen(listeners, scoreInput, "input", () => { if (scoreRange) scoreRange.value = scoreInput.value; updatePreview(scoreInput.value); queueDraft(); });
  listen(listeners, scoreRange, "input", () => { if (scoreInput) scoreInput.value = scoreRange.value; updatePreview(scoreRange.value); queueDraft(); });
  listen(listeners, bondInput, "change", () => {
    getMotionController()?.protocol?.(root.querySelector?.(".gms-master-reputation-console__protocols"));
    if (scoreInput) scoreInput.max = String(bondInput.checked || communionInput?.checked ? 12 : 10);
    if (scoreRange) scoreRange.max = String(bondInput.checked || communionInput?.checked ? 12 : 10);
    updatePreview(scoreInput?.value, { animate: false });
    queueDraft();
  });
  listen(listeners, communionInput, "change", () => {
    getMotionController()?.protocol?.(root.querySelector?.(".gms-master-reputation-console__protocols"));
    if (scoreInput) scoreInput.max = String(communionInput.checked || bondInput?.checked ? 12 : 10);
    if (scoreRange) scoreRange.max = String(communionInput.checked || bondInput?.checked ? 12 : 10);
    updatePreview(scoreInput?.value, { animate: false });
    queueDraft();
  });

  updatePreview(scoreInput?.value, { animate: false });

  listen(listeners, root.querySelector("[data-master-apply-score]"), "click", async () => {
    queueDraft();
    await flushPending("Reputação sincronizada.");
  });
  listen(listeners, root.querySelector("[data-master-apply-specials]"), "click", async () => {
    queueDraft();
    await flushPending("Protocolos especiais sincronizados.");
  });

  return Object.freeze({ destroy() { destroyListeners(listeners); } });
}
