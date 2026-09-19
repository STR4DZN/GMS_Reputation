import { getSpecialPresentation } from "../domain/specials.js";

export function buildSpecialProtocolModel(relationship = {}) {
  const presentation = getSpecialPresentation(relationship);
  return Object.freeze({
    ...presentation
  });
}
