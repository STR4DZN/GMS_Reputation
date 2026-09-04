import * as Profiles from "../../data/profile-registry.js";
import { deleteProfilePermanently } from "../../data/destructive-operations.js";

export const ProfileCommands = Object.freeze({
  create: (input = {}, options = {}) => Profiles.createNewProfile(input, options),
  rename: (profileId, name, options = {}) => Profiles.renameProfile(profileId, name, options),
  update: (profileId, patch = {}, options = {}) => Profiles.updateProfile(profileId, patch, options),
  setGroup: (profileId, groupId = null, options = {}) => Profiles.setProfileGroup(profileId, groupId, options),
  updateFocal: (profileId, patch = {}) => Profiles.updateFocalProfile(profileId, patch),
  setSubjectIncluded: (profileId, subjectId, included = true, options = {}) => Profiles.setProfileSubjectIncluded(profileId, subjectId, included, options),
  setRoster: (profileId, subjectIds = [], options = {}) => Profiles.setProfileRoster(profileId, subjectIds, options),
  deletePermanently: (profileId, options = {}) => deleteProfilePermanently(profileId, options)
});
