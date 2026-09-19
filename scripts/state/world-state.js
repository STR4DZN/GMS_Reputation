import { normalizeWorldState } from "./schema.js";

export function clonePlain(value) {
  const deepClone = globalThis.foundry?.utils?.deepClone;
  if (deepClone && value && typeof value === "object") return deepClone(value);
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function isWorldStateEmpty(state = {}) {
  return (
    Object.keys(state.groups ?? {}).length === 0 &&
    Object.keys(state.subjects ?? {}).length === 0 &&
    Object.keys(state.profiles ?? {}).length === 0 &&
    (state.history?.length ?? 0) === 0
  );
}

export class RevisionConflictError extends Error {
  constructor(expected, actual) {
    super(`GMS Reputation conflito de revisão: esperado ${expected}, atual ${actual}.`);
    this.name = "RevisionConflictError";
    this.expectedRevision = expected;
    this.actualRevision = actual;
  }
}
