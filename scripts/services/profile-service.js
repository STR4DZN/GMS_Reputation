import { executeTransaction } from "../state/transactions.js";
import { MODULE_CAPABILITY } from "./permission-service.js";
import { createProfile } from "../state/schema.js";
import { normalizePortrait } from "../domain/portraits.js";
import { sanitizeText, sanitizeMultilineText } from "../domain/validation.js";

function randomId() {
  return globalThis.foundry?.utils?.randomID?.(16) ?? `prof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class ProfileService {
  static async create({
    name,
    focalName,
    groupId = null,
    actor = globalThis.game?.user,
    reason = "Criação de perfil"
  } = {}) {
    const id = randomId();
    const newProfile = createProfile({
      id,
      name,
      groupId,
      focal: { name: focalName || name }
    });

    await executeTransaction({
      type: "profile-create",
      actor,
      capability: MODULE_CAPABILITY.FOCAL,
      reason,
      mutate: (draft) => {
        draft.profiles[id] = newProfile;
      },
      history: {
        type: "profile-create",
        profileId: id,
        after: { name, groupId }
      }
    });

    return newProfile;
  }

  static async updateFocal({
    profileId,
    name,
    description,
    portrait,
    actor = globalThis.game?.user,
    reason = "Atualização focal"
  } = {}) {
    if (!profileId) throw new Error("profileId é obrigatório.");

    return executeTransaction({
      type: "focal-update",
      actor,
      capability: MODULE_CAPABILITY.FOCAL,
      reason,
      mutate: (draft) => {
        const profile = draft.profiles?.[profileId];
        if (!profile) throw new Error(`Perfil ${profileId} não encontrado.`);

        const currentFocal = profile.focal ?? {};
        const nextFocal = {
          name: name !== undefined ? sanitizeText(name, 240, profile.name) : currentFocal.name,
          description: description !== undefined ? sanitizeMultilineText(description, 12000) : currentFocal.description,
          portrait: portrait !== undefined ? normalizePortrait(portrait) : currentFocal.portrait
        };

        draft.profiles[profileId] = createProfile({
          ...profile,
          focal: nextFocal
        });
      },
      // Correção da Seção 55: Focal gera evento de histórico formal!
      history: {
        type: "focal-update",
        profileId,
        after: { name, description, portrait }
      }
    });
  }

  static async updateRoster({
    profileId,
    subjectId,
    included,
    actor = globalThis.game?.user,
    reason = "Atualização de roster"
  } = {}) {
    if (!profileId || !subjectId) throw new Error("profileId e subjectId são obrigatórios.");

    return executeTransaction({
      type: "profile-roster",
      actor,
      capability: MODULE_CAPABILITY.SUBJECTS,
      reason,
      mutate: (draft) => {
        const profile = draft.profiles?.[profileId];
        if (!profile) throw new Error(`Perfil ${profileId} não encontrado.`);

        const currentRoster = new Set(Array.isArray(profile.subjectIds) ? profile.subjectIds.map(String) : []);
        if (included) {
          currentRoster.add(String(subjectId));
        } else {
          currentRoster.delete(String(subjectId));
        }

        draft.profiles[profileId] = createProfile({
          ...profile,
          subjectIds: [...currentRoster]
        });
      },
      // Correção da Seção 55: Roster gera evento de histórico formal e suporta Undo/Redo!
      history: {
        type: "profile-roster",
        profileId,
        subjectId,
        after: { included: Boolean(included) }
      }
    });
  }

  static async update({
    profileId,
    name,
    groupId,
    active,
    archived,
    actor = globalThis.game?.user,
    reason = "Atualização de perfil"
  } = {}) {
    if (!profileId) throw new Error("profileId é obrigatório.");

    return executeTransaction({
      type: "profile-update",
      actor,
      capability: MODULE_CAPABILITY.FOCAL,
      reason,
      mutate: (draft) => {
        const profile = draft.profiles?.[profileId];
        if (!profile) throw new Error(`Perfil ${profileId} não encontrado.`);

        draft.profiles[profileId] = createProfile({
          ...profile,
          name: name !== undefined ? sanitizeText(name, 240, profile.name) : profile.name,
          groupId: groupId !== undefined ? (groupId ? String(groupId) : null) : profile.groupId,
          active: active !== undefined ? Boolean(active) : profile.active,
          archived: archived !== undefined ? Boolean(archived) : profile.archived
        });
      },
      history: {
        type: "profile-update",
        profileId,
        after: { name, groupId, active, archived }
      }
    });
  }
}
