import { MASTER_SAVE_MODE } from "../../constants.js";
import { normalizeMasterAutoSaveDelay, normalizeMasterSaveMode } from "../../persistence/master-preferences.js";

export const SAVE_STATUS = Object.freeze({
  DIRTY: "dirty",
  SAVING: "saving",
  SYNCED: "synced",
  ERROR: "error"
});

export const SAVE_STATUS_LABEL = Object.freeze({
  [SAVE_STATUS.DIRTY]: "Alterações pendentes",
  [SAVE_STATUS.SAVING]: "Salvando",
  [SAVE_STATUS.SYNCED]: "Sincronizado",
  [SAVE_STATUS.ERROR]: "Erro"
});

function normalizeAction(action) {
  if (typeof action !== "function") throw new TypeError("Save action must be a function.");
  return action;
}

export class MasterSaveController {
  constructor({
    mode = MASTER_SAVE_MODE.AUTOMATIC,
    idleDelay = 2,
    automaticDelay = 300,
    onStatus = null,
    onCommitted = null
  } = {}) {
    this.mode = normalizeMasterSaveMode(mode);
    this.idleDelay = normalizeMasterAutoSaveDelay(idleDelay);
    this.automaticDelay = Math.max(100, Math.min(1500, Math.trunc(Number(automaticDelay) || 300)));
    this.onStatus = typeof onStatus === "function" ? onStatus : null;
    this.onCommitted = typeof onCommitted === "function" ? onCommitted : null;
    this.pending = new Map();
    this.timer = null;
    this.status = SAVE_STATUS.SYNCED;
    this.lastError = null;
    this.destroyed = false;
  }

  get hasPending() { return this.pending.size > 0; }
  get pendingCount() { return this.pending.size; }

  snapshot() {
    return Object.freeze({
      mode: this.mode,
      idleDelay: this.idleDelay,
      status: this.status,
      label: SAVE_STATUS_LABEL[this.status],
      pendingCount: this.pendingCount,
      hasPending: this.hasPending,
      error: this.lastError
    });
  }

  _emitStatus(status, error = null) {
    this.status = status;
    this.lastError = error;
    this.onStatus?.(this.snapshot());
  }

  _clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  _schedule() {
    this._clearTimer();
    if (!this.hasPending || this.destroyed || this.mode === MASTER_SAVE_MODE.MANUAL) return;
    const delay = this.mode === MASTER_SAVE_MODE.IDLE
      ? Math.round(this.idleDelay * 1000)
      : this.automaticDelay;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch(() => {});
    }, delay);
  }

  configure({ mode = this.mode, idleDelay = this.idleDelay } = {}) {
    this.mode = normalizeMasterSaveMode(mode);
    this.idleDelay = normalizeMasterAutoSaveDelay(idleDelay);
    if (this.hasPending) this._schedule();
    return this.snapshot();
  }

  queue(key, action) {
    if (this.destroyed) throw new Error("Save controller is destroyed.");
    const id = String(key || "default");
    this.pending.set(id, normalizeAction(action));
    this._emitStatus(SAVE_STATUS.DIRTY);
    this._schedule();
    return this.snapshot();
  }

  discard() {
    this._clearTimer();
    this.pending.clear();
    this._emitStatus(SAVE_STATUS.SYNCED);
    return this.snapshot();
  }

  async flush() {
    if (this.destroyed) return null;
    this._clearTimer();
    if (!this.hasPending) {
      this._emitStatus(SAVE_STATUS.SYNCED);
      return null;
    }

    const batch = Array.from(this.pending.entries());
    this.pending.clear();
    this._emitStatus(SAVE_STATUS.SAVING);
    const results = [];
    let completed = 0;
    try {
      for (const [, action] of batch) {
        results.push(await action());
        completed += 1;
      }
    } catch (error) {
      for (const [key, action] of batch.slice(completed)) if (!this.pending.has(key)) this.pending.set(key, action);
      this._emitStatus(SAVE_STATUS.ERROR, error);
      throw error;
    }

    this._emitStatus(SAVE_STATUS.SYNCED);
    try {
      await this.onCommitted?.(results, batch.map(([key]) => key));
    } catch (callbackError) {
      console.warn("GMS Reputation | Post-save UI callback failed after data was already persisted.", callbackError);
    }
    return results;
  }

  async runImmediate(action, { flushPending = true } = {}) {
    if (this.destroyed) return null;
    if (flushPending && this.hasPending) await this.flush();
    this._emitStatus(SAVE_STATUS.SAVING);
    let result;
    try {
      result = await normalizeAction(action)();
    } catch (error) {
      this._emitStatus(SAVE_STATUS.ERROR, error);
      throw error;
    }
    this._emitStatus(SAVE_STATUS.SYNCED);
    try {
      await this.onCommitted?.([result], ["immediate"]);
    } catch (callbackError) {
      console.warn("GMS Reputation | Post-save UI callback failed after data was already persisted.", callbackError);
    }
    return result;
  }

  destroy() {
    this.destroyed = true;
    this._clearTimer();
    this.pending.clear();
  }
}
