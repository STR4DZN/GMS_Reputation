import * as Subjects from "../../data/subject-registry.js";
import { deleteSubjectPermanently } from "../../data/destructive-operations.js";

/** Compatibility-first command facade. Delegates to proven registries in Phase A. */
export const SubjectCommands = Object.freeze({
  create: (input = {}) => Subjects.createNewSubject(input),
  update: (subjectId, patch = {}, options = {}) => Subjects.updateSubject(subjectId, patch, options),
  setActive: (subjectId, active) => Subjects.setSubjectActive(subjectId, active),
  archive: (subjectId, archived = true) => Subjects.archiveSubject(subjectId, archived),
  duplicate: (subjectId, options = {}) => Subjects.duplicateSubject(subjectId, options),
  reorder: (orderedIds = []) => Subjects.reorderSubjects(orderedIds),
  deletePermanently: (subjectId, options = {}) => deleteSubjectPermanently(subjectId, options)
});
