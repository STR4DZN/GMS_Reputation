import test from "node:test";
import assert from "node:assert/strict";

import { MasterSaveController, SAVE_STATUS } from "../scripts/applications/master/save-controller.js";
import { MASTER_SAVE_MODE } from "../scripts/constants.js";
import { HistoryService } from "../scripts/services/history-service.js";
import { WorldStateRepository } from "../scripts/state/repository.js";
import { MasterShellApplication } from "../scripts/applications/master/master-shell.js";

test("MasterSaveController: queue, dirty status and flush", async () => {
  let statusEmitted = null;
  const controller = new MasterSaveController({
    mode: MASTER_SAVE_MODE.MANUAL,
    onStatus: (snap) => {
      statusEmitted = snap.status;
    }
  });

  assert.equal(controller.status, SAVE_STATUS.SYNCED);
  assert.equal(controller.hasPending, false);

  let executed = false;
  controller.queue("edit-1", async () => {
    executed = true;
    return { success: true };
  });

  assert.equal(controller.hasPending, true);
  assert.equal(controller.pendingCount, 1);
  assert.equal(statusEmitted, SAVE_STATUS.DIRTY);

  const results = await controller.flush();

  assert.equal(executed, true);
  assert.deepEqual(results, [{ success: true }]);
  assert.equal(controller.hasPending, false);
  assert.equal(controller.status, SAVE_STATUS.SYNCED);

  controller.destroy();
});

test("HistoryService: buildUndoRedoState and reversible stack", () => {
  const state = {
    history: [
      {
        id: "evt-1",
        transactionId: "tx-1",
        type: "relationship",
        timestamp: Date.now() - 1000,
        profileId: "p1",
        subjectId: "s1",
        before: { score: 0 },
        after: { score: 2 }
      },
      {
        id: "evt-2",
        transactionId: "tx-2",
        type: "focal-update",
        timestamp: Date.now() - 500,
        profileId: "p1",
        before: null,
        after: { name: "Novo Focal" }
      }
    ]
  };

  const ur = HistoryService.buildUndoRedoState(state);

  assert.equal(ur.canUndo, true);
  assert.equal(ur.canRedo, false);
  assert.equal(ur.undoTarget, "tx-2");
  assert.equal(ur.undoDepth, 2);
});

test("MasterShellApplication: initialization & context", async () => {
  const shell = new MasterShellApplication({ workspace: "characters" });

  assert.equal(shell.activeWorkspace, "characters");
  const ctx = await shell._prepareContext({});

  assert.equal(ctx.activeWorkspace, "characters");
  assert.equal(ctx.workspaces.length, 6);
  assert.equal(ctx.workspaces.find((w) => w.id === "characters").active, true);
  assert.equal(ctx.save.status, SAVE_STATUS.SYNCED);

  await shell.close();
});
