import * as Store from "../persistence/world-store.js";

/**
 * Repository seam for Architecture 60.
 *
 * Phase A deliberately delegates 1:1 to the proven 59.10 WorldStore. This is
 * an architectural boundary, not a storage migration: the Foundry setting,
 * schema, revision semantics, backup and authority flow remain unchanged.
 */
export class FoundryWorldStateRepository {
  read() { return Store.loadWorldState(); }
  readRaw() { return Store.getRawWorldState(); }
  readBackup() { return Store.loadWorldStateBackup(); }
  readRawBackup() { return Store.getRawWorldStateBackup(); }
  isEmpty(state = {}) { return Store.isWorldStateEmpty(state); }
  canWrite(user = globalThis.game?.user) { return Store.canWriteWorldState(user); }
  initialize(options = {}) { return Store.initializeWorldStateIfNeeded(options); }
  save(nextState, options = {}) { return Store.saveWorldState(nextState, options); }
  transaction(mutator, options = {}) { return Store.mutateWorldState(mutator, options); }
  restoreBackup(options = {}) { return Store.restoreWorldStateBackup(options); }
  requiredCapabilities(current, candidate) { return Store.requiredCapabilitiesForTransition(current, candidate); }
  assertAuthorizedTransition(current, candidate, user) { return Store.assertAuthorizedTransition(current, candidate, user); }
  handleDelegatedSaveRequest(message = {}) { return Store.handleDelegatedSaveRequest(message); }
}

export const worldStateRepository = Object.freeze(new FoundryWorldStateRepository());
