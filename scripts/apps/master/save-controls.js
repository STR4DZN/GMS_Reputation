import { destroyListeners, listen } from "../application-compat.js";
import { MODULE_CAPABILITY, canUser } from "../../persistence/permissions.js";
import { MASTER_SAVE_MODE } from "../../constants.js";
import { setMasterSaveMode, setMasterAutoSaveDelay } from "../../persistence/master-preferences.js";
import { confirmMasterAction } from "./confirmation.js";

export function updateMasterSaveStatus(root, snapshot, { profileId, subjectId }) {
  if (!root?.querySelector) return;
  const bar = root.querySelector("[data-master-save-state]");
  if (bar) {
    bar.dataset.masterSaveState = snapshot.status;
    bar.dataset.pendingCount = String(snapshot.pendingCount);
  }
  const label = root.querySelector("[data-master-save-label]");
  if (label) label.textContent = snapshot.label;
  const count = root.querySelector("[data-master-save-pending-count]");
  if (count) count.textContent = snapshot.pendingCount ? `${snapshot.pendingCount} pendente${snapshot.pendingCount === 1 ? "" : "s"}` : "buffer limpo";
  const saveNow = root.querySelector("[data-master-save-now]");
  if (saveNow) {
    const canCaptureRelationship = Boolean(profileId && subjectId && canUser(globalThis.game?.user, MODULE_CAPABILITY.RELATIONSHIPS));
    saveNow.disabled = snapshot.status === "saving" || (!snapshot.hasPending && !canCaptureRelationship);
    saveNow.dataset.saveReady = String(Boolean(snapshot.hasPending || canCaptureRelationship));
  }
  const discard = root.querySelector("[data-master-discard-pending]");
  if (discard) discard.disabled = !snapshot.hasPending || snapshot.status === "saving";
}

export function wireMasterSaveControls(root, { saveController, updateStatus, queueRelationship, flushPending, onDiscard, render }) {
  const listeners = [];
  let disposed = false;
  updateStatus();
  listen(listeners, root.querySelector("[data-master-save-now]"), "click", async (event) => {
    event?.preventDefault?.();
    // Explicit save must be authoritative: re-read the current relationship
    // controls before flushing instead of relying only on prior input events.
    queueRelationship();
    await flushPending();
    updateStatus();
  });
  listen(listeners, root.querySelector("[data-master-discard-pending]"), "click", async () => {
    if (!saveController.hasPending) return;
    const confirmed = await confirmMasterAction({
      title: "Descartar alterações pendentes",
      message: "Descartar as alterações locais que ainda não foram gravadas?",
      confirmLabel: "Descartar"
    });
    if (!confirmed || disposed) return;
    saveController.discard();
    onDiscard();
    await render({ force: true });
  });

  const modeSelect = root.querySelector("[data-master-save-mode]");
  const delayInput = root.querySelector("[data-master-autosave-delay]");
  listen(listeners, modeSelect, "change", async () => {
    const mode = await setMasterSaveMode(modeSelect.value);
    saveController.configure({ mode });
    if (delayInput) delayInput.disabled = mode !== MASTER_SAVE_MODE.IDLE;
    updateStatus();
  });
  listen(listeners, delayInput, "change", async () => {
    const delay = await setMasterAutoSaveDelay(delayInput.value);
    delayInput.value = String(delay);
    saveController.configure({ idleDelay: delay });
  });

  return Object.freeze({ destroy() { disposed = true; destroyListeners(listeners); } });
}
