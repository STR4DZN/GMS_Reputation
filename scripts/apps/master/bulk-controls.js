import { destroyListeners, listen } from "../application-compat.js";
import { MODULE_CAPABILITY, canUser } from "../../persistence/permissions.js";
import { confirmMasterAction } from "./confirmation.js";
import { applyBulkRelationshipChanges, bulkArchiveSubjects, bulkSetSubjectsActive, moveSubjects } from "../../data/bulk-operations.js";

/** Bulk actions use the same mutation queue and confirmations as individual edits. */
export function wireMasterBulkControls(root, { selectedIds, contextIds, getReason, runMutation }) {
  const listeners = [];
  if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.BULK)) return null;
  const selectAll = root.querySelector("[data-master-bulk-select-all]");
  listen(listeners, selectAll, "change", () => {
    for (const input of root.querySelectorAll("[data-master-bulk-subject]")) input.checked = Boolean(selectAll.checked);
  });

  const applyRelation = root.querySelector("[data-master-bulk-apply-relationship]");
  listen(listeners, applyRelation, "click", () => {
    const ids = selectedIds();
    const scoreMode = String(root.querySelector("[data-master-bulk-score-mode]")?.value || "keep");
    const scoreValue = Number(root.querySelector("[data-master-bulk-score-value]")?.value || 0);
    const bond = String(root.querySelector("[data-master-bulk-bond]")?.value || "keep");
    const communion = String(root.querySelector("[data-master-bulk-communion]")?.value || "keep");
    const { profileId } = contextIds();
    const reason = getReason();
    return runMutation(
      () => applyBulkRelationshipChanges(profileId, ids, { scoreMode, scoreValue, bond, communion }, { reason }),
      `${ids.length} registro(s) processado(s) em massa.`
    );
  });

  const actions = {
    archive: () => bulkArchiveSubjects(selectedIds(), true, { reason: getReason() }),
    restore: () => bulkArchiveSubjects(selectedIds(), false, { reason: getReason() }),
    activate: () => bulkSetSubjectsActive(selectedIds(), true, { reason: getReason() }),
    deactivate: () => bulkSetSubjectsActive(selectedIds(), false, { reason: getReason() }),
    top: () => moveSubjects(selectedIds(), "top", { reason: getReason() }),
    bottom: () => moveSubjects(selectedIds(), "bottom", { reason: getReason() })
  };
  const destructiveMessages = {
    archive: "Arquivar os personagens selecionados? Os dados serão preservados, mas eles sairão das consultas normais.",
    deactivate: "Desativar os personagens selecionados? Eles permanecerão cadastrados, porém ficarão fora das consultas ativas."
  };
  for (const [action, callback] of Object.entries(actions)) {
    listen(listeners, root.querySelector(`[data-master-bulk-action="${action}"]`), "click", async () => {
      const warning = destructiveMessages[action];
      if (warning) {
        const confirmed = await confirmMasterAction({ title: "Confirmar operação em massa", message: warning, confirmLabel: "Continuar" });
        if (!confirmed) return;
      }
      await runMutation(callback, "Operação em massa concluída.");
    });
  }

  return Object.freeze({ destroy() { destroyListeners(listeners); } });
}
