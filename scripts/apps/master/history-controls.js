import { destroyListeners, listen, notify } from "../application-compat.js";
import { MODULE_CAPABILITY, canUser } from "../../persistence/permissions.js";
import { undoLastTransaction, redoLastTransaction } from "../../data/undo-redo.js";
import { confirmMasterAction } from "./confirmation.js";

export async function runMasterUndoRedo(direction, target, { hasPending, runMutation, isActive = () => true }) {
  if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.HISTORY)) { notify("warn", "Você não possui permissão para desfazer/refazer alterações."); return; }
  if (hasPending()) {
    notify("warn", "Salve ou descarte as alterações pendentes antes de desfazer/refazer.");
    return;
  }
  if (!target?.transactionId) return;
  const confirmed = await confirmMasterAction({
    title: direction === "undo" ? "Desfazer alteração" : "Refazer alteração",
    message: `${direction === "undo" ? "Desfazer" : "Refazer"} “${target.label}”? A operação será registrada no histórico e poderá ser ${direction === "undo" ? "refeita" : "desfeita"} novamente.`,
    confirmLabel: direction === "undo" ? "Desfazer" : "Refazer"
  });
  if (!confirmed || !isActive()) return;
  if (hasPending()) {
    notify("warn", "Salve ou descarte as alterações pendentes antes de desfazer/refazer.");
    return;
  }
  const options = { expectedTransactionId: target.transactionId };
  await runMutation(
    () => direction === "undo" ? undoLastTransaction(options) : redoLastTransaction(options),
    direction === "undo" ? "Última alteração desfeita." : "Alteração refeita."
  );
}

export function wireMasterHistoryControls(root, context, { onUndoRedo }) {
  const listeners = [];
  let disposed = false;
  const options = { isActive: () => !disposed };
  listen(listeners, root.querySelector("[data-master-undo]"), "click", () => onUndoRedo("undo", context.undoRedo.undoTarget, options));
  listen(listeners, root.querySelector("[data-master-redo]"), "click", () => onUndoRedo("redo", context.undoRedo.redoTarget, options));
  return Object.freeze({ destroy() { disposed = true; destroyListeners(listeners); } });
}
