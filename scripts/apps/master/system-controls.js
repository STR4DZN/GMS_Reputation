import { destroyListeners, listen, notify } from "../application-compat.js";
import { MODULE_CAPABILITY, canUser } from "../../persistence/permissions.js";
import { getPermissionConfig, setPermissionConfig } from "../../persistence/permissions.js";
import { restoreWorldStateBackup } from "../../persistence/world-store.js";
import { confirmMasterAction } from "./confirmation.js";

/** Live permission gates and backup safety, with application-owned pending edits. */
export function wireMasterSystemControls(root, { hasPendingChanges, render }) {
  const listeners = [];
  let disposed = false;
  const wirePermissions = () => {
    const save = root.querySelector("[data-master-save-permissions]");
    if (!save) return;
    listen(listeners, save, "click", async () => {
      if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.CONFIGURE_PERMISSIONS)) {
        notify("warn", "Somente um Gamemaster completo pode alterar estas permissões.");
        return;
      }
      const current = getPermissionConfig();
      const next = { schema: 1, assistant: { ...current.assistant }, trusted: { ...current.trusted } };
      for (const input of root.querySelectorAll("[data-master-permission-role][data-master-permission-capability]")) {
        const role = String(input.dataset.masterPermissionRole || "");
        const capability = String(input.dataset.masterPermissionCapability || "");
        if (!next[role] || !capability) continue;
        next[role][capability] = Boolean(input.checked);
      }
      try {
        await setPermissionConfig(next);
        notify("info", "Permissões da Matriz de Reputação atualizadas.");
      } catch (error) {
        notify("error", error?.message || "Não foi possível salvar as permissões.");
      }
    });
  };
  const wireBackup = () => {
    const restore = root.querySelector("[data-master-restore-backup]");
    if (!restore) return;
    listen(listeners, restore, "click", async () => {
      if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.CONFIGURE_PERMISSIONS)) {
        notify("warn", "Somente um Gamemaster completo pode restaurar o backup mundial.");
        return;
      }
      if (hasPendingChanges()) {
        notify("warn", "Salve ou descarte as alterações pendentes antes de restaurar um backup.");
        return;
      }
      const confirmed = await confirmMasterAction({
        title: "Restaurar backup mundial",
        message: "Restaurar o último snapshot automático da Matriz? O estado atual será preservado como novo backup antes do rollback.",
        confirmLabel: "Restaurar backup"
      });
      if (!confirmed || disposed) return;
      if (hasPendingChanges()) {
        notify("warn", "Salve ou descarte as alterações pendentes antes de restaurar um backup.");
        return;
      }
      try {
        await restoreWorldStateBackup();
        notify("info", "Backup mundial restaurado com sucesso.");
        await render({ force: true });
      } catch (error) {
        notify("error", error?.message || "Não foi possível restaurar o backup mundial.");
      }
    });
  };
  wirePermissions(); wireBackup();
  return Object.freeze({ destroy() { disposed = true; destroyListeners(listeners); } });
}
