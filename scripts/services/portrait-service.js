import { executeTransaction } from "../state/transactions.js";
import { MODULE_CAPABILITY } from "./permission-service.js";
import { normalizePortrait } from "../domain/portraits.js";

export class PortraitService {
  static async setSubjectPortrait({
    subjectId,
    portrait,
    actor = globalThis.game?.user,
    reason = "Atualização de retrato"
  } = {}) {
    if (!subjectId) throw new Error("subjectId é obrigatório.");
    const normalized = normalizePortrait(portrait);

    return executeTransaction({
      type: "portrait",
      actor,
      capability: MODULE_CAPABILITY.PORTRAITS,
      reason,
      mutate: (draft) => {
        const subject = draft.subjects?.[subjectId];
        if (!subject) throw new Error(`Personagem ${subjectId} não encontrado.`);
        subject.portrait = normalized;
      },
      history: {
        type: "portrait",
        subjectId,
        after: { portrait: normalized }
      }
    });
  }
}
