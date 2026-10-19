import { createRelationship } from "./schema.js";
import { normalizeRelationship } from "../core/score.js";
import {
  computeRelationshipCandidate,
  resolveRelationshipRecord,
} from "./reputation-registry.js";
import {
  appendHistoryEvent,
  createTransactionId,
  relationshipSnapshot,
} from "./history-registry.js";
import {
  mutateWorldState,
  NO_STATE_CHANGE,
} from "../persistence/world-store.js";
import { canUser, MODULE_CAPABILITY } from "../persistence/permissions.js";

export const relationshipKey = (profileId, subjectId) =>
  JSON.stringify([String(profileId), String(subjectId)]);
export const sameRelationshipValue = (a, b) =>
  a.score === b.score &&
  a.bond === b.bond &&
  a.communion === b.communion &&
  a.note === b.note;

/** Multiple NPCs and characters, one atomic save, one backup and one undo transaction. */
export async function applyRelationshipGridEdits(
  edits = [],
  { reason = "" } = {},
) {
  if (!canUser(globalThis.game?.user, MODULE_CAPABILITY.RELATIONSHIPS))
    throw new Error("Você não tem permissão para editar reputação.");
  const unique = new Map(
    edits.map((edit) => [
      relationshipKey(edit.profileId, edit.subjectId),
      edit,
    ]),
  );
  if (!unique.size) return null;
  if (
    unique.size > 1 &&
    !canUser(globalThis.game?.user, MODULE_CAPABILITY.BULK)
  )
    throw new Error(
      "A edição de várias relações exige permissão para operações em lote.",
    );
  const transactionId = createTransactionId("grid-rel");
  return mutateWorldState((draft) => {
    let changed = 0;
    const now = Date.now();
    for (const edit of unique.values()) {
      const profile = draft.profiles?.[edit.profileId];
      const roster = new Set(
        Array.isArray(profile?.subjectIds)
          ? profile.subjectIds.map(String)
          : Object.keys(profile?.relationships ?? {}),
      );
      if (!roster.has(String(edit.subjectId)))
        throw new Error(
          "O personagem foi removido do elenco deste NPC. Revise o rascunho.",
        );
      const { relationship } = resolveRelationshipRecord(
        draft,
        edit.profileId,
        edit.subjectId,
        { createMissingRelationship: true },
      );
      const current = normalizeRelationship(relationship);
      if (
        !Number.isInteger(edit.expectedRevision) ||
        current.revision !== edit.expectedRevision
      ) {
        throw new Error(
          "Esta relação foi alterada em outra janela. Descarte ou revise o rascunho antes de salvar.",
        );
      }
      if (
        edit.patch?.score !== undefined &&
        !Number.isFinite(Number(edit.patch.score))
      )
        throw new Error("Informe um número válido de corações.");
      const candidate = computeRelationshipCandidate(current, edit.patch);
      if (sameRelationshipValue(current, candidate)) continue;
      profile.relationships[edit.subjectId] = createRelationship(
        edit.subjectId,
        {
          ...candidate,
          revision: current.revision + 1,
          updatedAt: now,
          updatedBy: globalThis.game?.user?.id,
        },
      );
      profile.metadata = {
        ...profile.metadata,
        updatedAt: now,
        updatedBy: globalThis.game?.user?.id,
      };
      appendHistoryEvent(draft, {
        profileId: edit.profileId,
        subjectId: edit.subjectId,
        type: "relationship",
        before: relationshipSnapshot(current),
        after: relationshipSnapshot(candidate),
        reason,
        transactionId,
      });
      changed++;
    }
    if (!changed) return NO_STATE_CHANGE;
  });
}
