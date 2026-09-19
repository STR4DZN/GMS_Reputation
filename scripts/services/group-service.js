import { executeTransaction } from "../state/transactions.js";
import { MODULE_CAPABILITY } from "./permission-service.js";
import { createGroup } from "../state/schema.js";
import { sanitizeText, sanitizeMultilineText } from "../domain/validation.js";

function randomId() {
  return globalThis.foundry?.utils?.randomID?.(16) ?? `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class GroupService {
  static async create({
    name,
    description = "",
    actor = globalThis.game?.user,
    reason = "Criação de grupo de perfis"
  } = {}) {
    const id = randomId();
    const newGroup = createGroup({ id, name, description });

    await executeTransaction({
      type: "group-create",
      actor,
      capability: MODULE_CAPABILITY.FOCAL,
      reason,
      mutate: (draft) => {
        draft.groups[id] = newGroup;
      },
      history: {
        type: "group-update",
        after: { id, name }
      }
    });

    return newGroup;
  }

  static async update({
    groupId,
    name,
    description,
    actor = globalThis.game?.user,
    reason = "Atualização de grupo"
  } = {}) {
    if (!groupId) throw new Error("groupId é obrigatório.");

    return executeTransaction({
      type: "group-update",
      actor,
      capability: MODULE_CAPABILITY.FOCAL,
      reason,
      mutate: (draft) => {
        const group = draft.groups?.[groupId];
        if (!group) throw new Error(`Grupo ${groupId} não encontrado.`);

        draft.groups[groupId] = createGroup({
          ...group,
          name: name !== undefined ? sanitizeText(name, 160, group.name) : group.name,
          description: description !== undefined ? sanitizeMultilineText(description, 4000) : group.description
        });
      },
      history: {
        type: "group-update",
        after: { id: groupId, name }
      }
    });
  }
}
