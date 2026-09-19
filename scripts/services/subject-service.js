import { executeTransaction } from "../state/transactions.js";
import { MODULE_CAPABILITY } from "./permission-service.js";
import { createSubject } from "../state/schema.js";
import { sanitizeText, sanitizeMultilineText } from "../domain/validation.js";

function randomId() {
  return globalThis.foundry?.utils?.randomID?.(16) ?? `subj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class SubjectService {
  static async create({
    realName,
    alias,
    description = "",
    portrait = {},
    actor = globalThis.game?.user,
    reason = "Criação de personagem"
  } = {}) {
    const id = randomId();
    const newSubject = createSubject({
      id,
      realName,
      alias,
      description,
      portrait
    });

    await executeTransaction({
      type: "subject-create",
      actor,
      capability: MODULE_CAPABILITY.SUBJECTS,
      reason,
      mutate: (draft) => {
        draft.subjects[id] = newSubject;
      },
      history: {
        type: "subject-update",
        subjectId: id,
        after: { realName, alias }
      }
    });

    return newSubject;
  }

  static async update({
    subjectId,
    realName,
    alias,
    description,
    portrait,
    active,
    archived,
    actor = globalThis.game?.user,
    reason = "Atualização de personagem"
  } = {}) {
    if (!subjectId) throw new Error("subjectId é obrigatório.");

    return executeTransaction({
      type: "subject-update",
      actor,
      capability: MODULE_CAPABILITY.SUBJECTS,
      reason,
      mutate: (draft) => {
        const subject = draft.subjects?.[subjectId];
        if (!subject) throw new Error(`Personagem ${subjectId} não encontrado.`);

        draft.subjects[subjectId] = createSubject({
          ...subject,
          realName: realName !== undefined ? sanitizeText(realName, 160) : subject.realName,
          alias: alias !== undefined ? sanitizeText(alias, 160) : subject.alias,
          description: description !== undefined ? sanitizeMultilineText(description, 12000) : subject.description,
          portrait: portrait !== undefined ? portrait : subject.portrait,
          active: active !== undefined ? Boolean(active) : subject.active,
          archived: archived !== undefined ? Boolean(archived) : subject.archived
        });
      },
      history: {
        type: "subject-update",
        subjectId,
        after: { realName, alias, active, archived }
      }
    });
  }
}
