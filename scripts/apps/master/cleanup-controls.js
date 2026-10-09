import { destroyListeners, listen } from "../application-compat.js";
import { normalizeUiSearch } from "./context.js";
import { confirmMasterAction } from "./confirmation.js";
import { deleteGroupPermanently, deleteProfilePermanently, deleteSubjectPermanently } from "../../data/destructive-operations.js";

/** Keeps the cleanup unlock, search and permanent-delete confirmations together. */
export function wireMasterCleanupControls(root, { isFullGM = false, runMutation }) {
  const listeners = [];
  const cleanupRoot = root.querySelector("[data-master-cleanup-root]");
  if (!cleanupRoot || !isFullGM) return null;

  const unlock = cleanupRoot.querySelector("[data-master-cleanup-unlock]");
  const refreshDeleteState = () => {
    const enabled = Boolean(unlock?.checked);
    cleanupRoot.dataset.cleanupUnlocked = String(enabled);
    for (const button of cleanupRoot.querySelectorAll("[data-master-cleanup-delete]")) button.disabled = !enabled;
  };
  listen(listeners, unlock, "change", refreshDeleteState);
  refreshDeleteState();

  const search = cleanupRoot.querySelector("[data-master-cleanup-search]");
  listen(listeners, search, "input", () => {
    const query = normalizeUiSearch(search?.value);
    for (const row of cleanupRoot.querySelectorAll("[data-master-cleanup-row]")) {
      const haystack = normalizeUiSearch(row.dataset.cleanupSearchText || row.textContent || "");
      row.hidden = Boolean(query) && !haystack.includes(query);
    }
    for (const section of cleanupRoot.querySelectorAll("[data-master-cleanup-section]")) {
      const visible = [...section.querySelectorAll("[data-master-cleanup-row]")].some((row) => !row.hidden);
      section.dataset.hasVisibleRows = String(visible);
    }
  });

  for (const button of cleanupRoot.querySelectorAll("[data-master-cleanup-delete]")) {
    listen(listeners, button, "click", async () => {
      if (!unlock?.checked) return;
      const kind = String(button.dataset.masterCleanupDelete || "");
      const id = String(button.dataset.cleanupId || "");
      const name = String(button.dataset.cleanupName || "registro");
      const impactA = Number(button.dataset.cleanupImpactA || 0);
      const impactB = Number(button.dataset.cleanupImpactB || 0);
      let title = "Confirmar exclusão permanente";
      let message = "";
      let action = null;

      if (kind === "subject") {
        message = `Apagar permanentemente o personagem “${name}”? Ele será removido de ${impactA} relação(ões) e ${impactB} roster(s) de perfil. O backup automático preservará o estado anterior, mas esta ação não entra no Undo/Redo.`;
        action = () => deleteSubjectPermanently(id, { reason: "Exclusão permanente pelo Gerenciador de Limpeza" });
      } else if (kind === "profile") {
        message = `Apagar permanentemente o perfil “${name}”? Serão removidas ${impactA} relação(ões) armazenadas dentro deste perfil. Os personagens não serão apagados. O backup automático preservará o estado anterior.`;
        action = () => deleteProfilePermanently(id, { reason: "Exclusão permanente pelo Gerenciador de Limpeza" });
      } else if (kind === "group") {
        message = `Apagar o grupo “${name}”? Os ${impactA} perfil(is) vinculados serão preservados e movidos para “Sem Grupo”. O grupo em si será removido permanentemente.`;
        action = () => deleteGroupPermanently(id, { reason: "Exclusão permanente pelo Gerenciador de Limpeza" });
      }
      if (!action) return;
      const confirmed = await confirmMasterAction({ title, message, confirmLabel: "Apagar permanentemente" });
      if (!confirmed) return;

      await runMutation(action, `${name} removido com sucesso.`);
    });
  }

  return Object.freeze({ destroy() { destroyListeners(listeners); } });
}
