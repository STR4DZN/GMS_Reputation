import * as Groups from "../../data/group-registry.js";
import { deleteGroupPermanently } from "../../data/destructive-operations.js";

export const GroupCommands = Object.freeze({
  create: (input = {}, options = {}) => Groups.createNewGroup(input, options),
  rename: (groupId, name, options = {}) => Groups.renameGroup(groupId, name, options),
  move: (groupId, direction = "up", options = {}) => Groups.moveGroup(groupId, direction, options),
  deletePermanently: (groupId, options = {}) => deleteGroupPermanently(groupId, options)
});
