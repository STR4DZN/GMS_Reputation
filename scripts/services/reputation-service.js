import { executeTransaction } from "../state/transactions.js";
import { MODULE_CAPABILITY } from "./permission-service.js";
import { normalizeRelationship, clampScore, deriveSpecialLimits } from "../domain/score.js";
import { createRelationship } from "../state/schema.js";
import { WorldStateRepository } from "../state/repository.js";

export class ReputationService {
  static async update({
    profileId,
    subjectId,
    score,
    bond,
    communion,
    note,
    reason = "Atualização de relação",
    actor = globalThis.game?.user
  } = {}) {
    if (!profileId) throw new Error("profileId é obrigatório para atualizar reputação.");
    if (!subjectId) throw new Error("subjectId é obrigatório para atualizar reputação.");

    return executeTransaction({
      type: "relationship-update",
      actor,
      capability: MODULE_CAPABILITY.RELATIONSHIPS,
      reason,
      mutate: (draft) => {
        const profile = draft.profiles?.[profileId];
        if (!profile) throw new Error(`Perfil ${profileId} não encontrado.`);
        const subject = draft.subjects?.[subjectId];
        if (!subject) throw new Error(`Personagem ${subjectId} não encontrado.`);

        const currentRel = profile.relationships?.[subjectId] ?? { subjectId, score: 0 };
        const nextRel = normalizeRelationship({
          score: score !== undefined ? score : currentRel.score,
          bond: bond !== undefined ? bond : currentRel.bond,
          communion: communion !== undefined ? communion : currentRel.communion,
          note: note !== undefined ? note : currentRel.note,
          revision: (Number(currentRel.revision) || 0) + 1,
          updatedAt: Date.now(),
          updatedBy: actor?.id ? String(actor.id) : null
        });

        draft.profiles[profileId].relationships ??= {};
        draft.profiles[profileId].relationships[subjectId] = createRelationship(subjectId, nextRel);

        // Roster inclusion
        const currentRoster = Array.isArray(profile.subjectIds) ? profile.subjectIds : [];
        if (!currentRoster.includes(subjectId)) {
          draft.profiles[profileId].subjectIds = [...currentRoster, subjectId];
        }
      },
      history: (_candidate, current) => {
        const currentRel = current.profiles?.[profileId]?.relationships?.[subjectId] ?? { subjectId, score: 0, bond: false, communion: false, note: "" };
        const nextRel = _candidate.profiles?.[profileId]?.relationships?.[subjectId] ?? {};
        return {
          type: "relationship",
          profileId,
          subjectId,
          before: { score: currentRel.score, bond: currentRel.bond, communion: currentRel.communion, note: currentRel.note },
          after: { score: nextRel.score, bond: nextRel.bond, communion: nextRel.communion, note: nextRel.note }
        };
      }
    });
  }

  static getRelationship(profileId, subjectId) {
    const state = WorldStateRepository.load();
    if (!state?.profiles?.[profileId]) return null;
    const rel = state.profiles[profileId].relationships?.[subjectId];
    if (!rel) return { subjectId, score: 0, bond: false, communion: false, note: "" };
    return rel;
  }

  static async setScore({ profileId, subjectId, score, reason = "Definição de score", actor }) {
    return this.update({ profileId, subjectId, score, reason, actor });
  }

  static async adjustScore({ profileId, subjectId, delta, reason = "Ajuste de score", actor }) {
    const current = this.getRelationship(profileId, subjectId);
    const score = (current?.score ?? 0) + delta;
    return this.update({ profileId, subjectId, score, reason, actor });
  }

  static async toggleBond({ profileId, subjectId, reason = "Alternar Vínculo", actor }) {
    const current = this.getRelationship(profileId, subjectId);
    const bond = !(current?.bond);
    return this.update({ profileId, subjectId, bond, reason, actor });
  }

  static async toggleCommunion({ profileId, subjectId, reason = "Alternar Comunhão", actor }) {
    const current = this.getRelationship(profileId, subjectId);
    const communion = !(current?.communion);
    return this.update({ profileId, subjectId, communion, reason, actor });
  }

  static async bulkUpdate({
    profileId,
    profileIds = null,
    subjectIds = [],
    scoreDelta = 0,
    scoreSet = null,
    setScore = null,
    bond = null,
    communion = null,
    reason = "Alteração em lote",
    actor = globalThis.game?.user
  } = {}) {
    const targetProfileIds = Array.isArray(profileIds) && profileIds.length
      ? profileIds.filter(Boolean)
      : (profileId ? [profileId] : []);

    if (!targetProfileIds.length) throw new Error("profileId ou profileIds é obrigatório.");
    const ids = Array.isArray(subjectIds) ? subjectIds.filter(Boolean) : [];
    if (!ids.length) return null;

    const finalScoreSet = typeof setScore === "number" ? setScore : scoreSet;

    return executeTransaction({
      type: "relationship-bulk",
      actor,
      capability: MODULE_CAPABILITY.RELATIONSHIPS,
      reason,
      mutate: (draft) => {
        for (const pId of targetProfileIds) {
          const profile = draft.profiles?.[pId];
          if (!profile) continue;
          profile.relationships ??= {};

          for (const sId of ids) {
            const current = profile.relationships[sId] ?? { subjectId: sId, score: 0 };
            const nextBond = typeof bond === "boolean" ? bond : current.bond;
            const nextCommunion = typeof communion === "boolean" ? communion : current.communion;

            let nextScore = current.score;
            if (typeof finalScoreSet === "number") {
              nextScore = finalScoreSet;
            } else if (typeof scoreDelta === "number" && scoreDelta !== 0) {
              nextScore = current.score + scoreDelta;
            }

            const limits = deriveSpecialLimits(nextBond, nextCommunion);
            nextScore = clampScore(nextScore, limits);

            profile.relationships[sId] = createRelationship(sId, {
              ...current,
              score: nextScore,
              bond: nextBond,
              communion: nextCommunion,
              revision: (Number(current.revision) || 0) + 1,
              updatedAt: Date.now(),
              updatedBy: actor?.id ? String(actor.id) : null
            });
          }

          const currentRoster = Array.isArray(profile.subjectIds) ? profile.subjectIds : [];
          const missing = ids.filter((id) => !currentRoster.includes(id));
          if (missing.length) {
            profile.subjectIds = [...currentRoster, ...missing];
          }
        }
      },
      history: (_candidate, current) => {
        const events = [];
        for (const pId of targetProfileIds) {
          for (const sId of ids) {
            const beforeRel = current.profiles?.[pId]?.relationships?.[sId] ?? { subjectId: sId, score: 0, bond: false, communion: false, note: "" };
            const afterRel = _candidate.profiles?.[pId]?.relationships?.[sId] ?? {};
            events.push({
              type: "relationship",
              profileId: pId,
              subjectId: sId,
              before: { score: beforeRel.score, bond: beforeRel.bond, communion: beforeRel.communion, note: beforeRel.note },
              after: { score: afterRel.score, bond: afterRel.bond, communion: afterRel.communion, note: afterRel.note }
            });
          }
        }
        return events;
      }
    });
  }
}
