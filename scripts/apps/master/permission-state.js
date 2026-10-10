import { MODULE_CAPABILITY, canUser } from "../../persistence/permissions.js";
import { buildUndoRedoState } from "../../data/undo-redo.js";

export function applyMasterPermissionState(root, context) {
  if (!root?.querySelector) return;
  const rules = [
    ["relationship", context.permissions.canEditRelationships],
    ["portrait", context.permissions.canEditPortraits],
    ["subjects", context.permissions.canEditSubjects],
    ["profile", context.permissions.canEditSubjects],
    ["focal", context.permissions.canEditFocal],
    ["characters", context.permissions.canBulkEdit || context.permissions.canEditSubjects],
    ["history", context.permissions.canUndoRedo]
  ];
  for (const [section, allowed] of rules) {
    const panel = root.querySelector(`[data-master-section-panel="${section}"]`);
    if (!panel) continue;
    panel.dataset.permissionAllowed = String(Boolean(allowed));
    if (!allowed) for (const control of panel.querySelectorAll("button,input,select,textarea")) control.disabled = true;
  }
  if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.BULK)) {
    for (const control of root.querySelectorAll("[data-master-bulk] button, [data-master-bulk] input, [data-master-bulk] select, [data-master-bulk-subject], [data-master-bulk-select-all]")) control.disabled = true;
  }
  if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.SUBJECTS)) {
    for (const control of root.querySelectorAll("[data-master-subject-admin] button, [data-master-subject-admin] input, [data-master-subject-admin] select, [data-master-subject-admin] textarea")) control.disabled = true;
    for (const selector of root.querySelectorAll("[data-master-subject-admin] [data-smart-selector-toggle]")) selector.disabled = true;
  }
  const undo = root.querySelector("[data-master-undo]");
  const redo = root.querySelector("[data-master-redo]");
  if (!context.permissions.canUndoRedo) { if (undo) undo.disabled = true; if (redo) redo.disabled = true; }
}

export function refreshMasterUndoRedoControls(root) {
  if (!root?.querySelector) return;
  const stack = buildUndoRedoState();
  if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.BULK)) {
    for (const control of root.querySelectorAll("[data-master-bulk] button, [data-master-bulk] input, [data-master-bulk] select, [data-master-bulk-subject], [data-master-bulk-select-all]")) control.disabled = true;
  }
  if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.SUBJECTS)) {
    for (const control of root.querySelectorAll("[data-master-subject-admin] button, [data-master-subject-admin] input, [data-master-subject-admin] select, [data-master-subject-admin] textarea")) control.disabled = true;
    for (const selector of root.querySelectorAll("[data-master-subject-admin] [data-smart-selector-toggle]")) selector.disabled = true;
  }
  const undo = root.querySelector("[data-master-undo]");
  const redo = root.querySelector("[data-master-redo]");
  const allowed = canUser(globalThis.game?.user, MODULE_CAPABILITY.HISTORY);
  if (undo) {
    undo.disabled = !allowed || !stack.canUndo;
    undo.title = stack.undoTarget?.label || "Nada para desfazer";
  }
  if (redo) {
    redo.disabled = !allowed || !stack.canRedo;
    redo.title = stack.redoTarget?.label || "Nada para refazer";
  }
}
