import { normalizeWorldState } from "./schema.js";
import { diffWorldStates } from "./diff.js";

const listeners = new Set();
let lastState = null;
let pendingState = null;
let pendingOptions = null;
let scheduled = false;

export function primeWorldStateSync(state) {
  lastState = normalizeWorldState(state);
  return lastState;
}

export function getLastSyncedWorldState() {
  return lastState;
}

export function subscribeWorldStateChanges(callback) {
  if (typeof callback !== "function") throw new TypeError("Listener de sincronização deve ser uma função.");
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function dispatch(nextInput, options = {}) {
  const next = normalizeWorldState(nextInput);
  const previous = lastState ?? next;
  const diff = diffWorldStates(previous, next);
  lastState = next;

  if (
    diff.fromRevision === diff.toRevision &&
    !diff.structural &&
    !diff.changedGroupIds.length &&
    !diff.changedSubjectIds.length &&
    !diff.changedProfileIds.length &&
    !diff.historyAppended
  ) {
    return null;
  }

  const event = Object.freeze({
    state: next,
    previous,
    diff,
    options: Object.freeze({ ...(options ?? {}) })
  });

  for (const callback of [...listeners]) {
    try {
      callback(event);
    } catch (error) {
      console.warn("GMS Reputation | Falha em listener de sincronização.", error);
    }
  }

  globalThis.Hooks?.callAll?.("gmsReputationWorldStateChanged", event);
  return event;
}

export function ingestWorldStateSetting(value, options = {}) {
  pendingState = value;
  pendingOptions = options;
  if (scheduled) return;
  scheduled = true;

  const schedule = globalThis.queueMicrotask ?? ((cb) => Promise.resolve().then(cb));
  schedule(() => {
    scheduled = false;
    const state = pendingState;
    const reqOptions = pendingOptions;
    pendingState = null;
    pendingOptions = null;
    dispatch(state, reqOptions);
  });
}
