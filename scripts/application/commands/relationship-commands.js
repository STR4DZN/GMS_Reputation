import * as Reputation from "../../data/reputation-registry.js";

export const RelationshipCommands = Object.freeze({
  update: (profileId, subjectId, patch = {}, options = {}) => Reputation.updateRelationship(profileId, subjectId, patch, options),
  setScore: (profileId, subjectId, score, options = {}) => Reputation.setReputationScore(profileId, subjectId, score, options),
  adjustScore: (profileId, subjectId, delta, options = {}) => Reputation.adjustReputationScore(profileId, subjectId, delta, options),
  setBond: (profileId, subjectId, active = true, options = {}) => Reputation.setBond(profileId, subjectId, active, options),
  setCommunion: (profileId, subjectId, active = true, options = {}) => Reputation.setCommunion(profileId, subjectId, active, options)
});
