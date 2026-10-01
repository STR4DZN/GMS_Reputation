import { MODULE_ID } from "../constants.js";
import { getRelationshipDerivedState } from "../core/score.js";
import { isFullGamemaster } from "./permissions.js";
import { loadWorldState } from "./world-store.js";

export const PERSONAL_REPUTATION_FLAGS = Object.freeze({ BINDING: "personalReputationBinding", VIEW: "personalReputationView" });
const plain = (value) => value && typeof value === "object" && !Array.isArray(value);
const id = (value) => typeof value === "string" ? value : "";
const comparableName = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
const reputation = (value) => {
  const normalized = getRelationshipDerivedState(value ?? {});
  return { score: normalized.score, bond: normalized.bond, communion: normalized.communion };
};
const sameReputation = (a, b) => a.score === b.score && a.bond === b.bond && a.communion === b.communion;
export function campaignUsers() {
  const users = globalThis.game?.users;
  return users?.contents ?? (typeof users?.values === "function" ? [...users.values()] : Array.isArray(users) ? users : []);
}
function flag(user, key) { return user?.getFlag?.(MODULE_ID, key) ?? user?.flags?.[MODULE_ID]?.[key]; }
export function getPersonalBinding(user = globalThis.game?.user) {
  const binding = flag(user, PERSONAL_REPUTATION_FLAGS.BINDING);
  return { profileId: id(binding?.profileId), subjectId: id(binding?.subjectId) };
}
function sameBinding(a, b) { return a?.profileId === b?.profileId && a?.subjectId === b?.subjectId; }
export function matchingProfileSubject(state, profileId) {
  const profile = state.profiles?.[profileId];
  if (!profile) return "";
  const names = new Set([profile.focal?.name, profile.name].map(comparableName).filter(Boolean));
  const matches = Object.values(state.subjects ?? {}).filter((subject) => names.has(comparableName(subject.alias)) || names.has(comparableName(subject.realName)));
  return matches.length === 1 ? String(matches[0].id) : "";
}
export function personalBindingAvailable(state, binding) {
  const profile = state.profiles?.[binding.profileId];
  const subject = state.subjects?.[binding.subjectId];
  return Boolean(profile && subject && profile.active !== false && !profile.archived && subject.active !== false && !subject.archived);
}
export function createPersonalSnapshot(state, binding) {
  const relations = {};
  if (personalBindingAvailable(state, binding)) {
    for (const profile of Object.values(state.profiles ?? {})) {
      if (profile.id === binding.profileId || profile.active === false || profile.archived) continue;
      const roster = profile.subjectIds ?? Object.keys(profile.relationships ?? {});
      if (!roster.includes(binding.subjectId)) continue;
      Object.defineProperty(relations, profile.id, { value: reputation(profile.relationships?.[binding.subjectId]), enumerable: true, configurable: true, writable: true });
    }
  }
  return { profileId: binding.profileId, subjectId: binding.subjectId, relations };
}
export function diffPersonalSnapshots(previous, next) {
  if (!sameBinding(previous, next) || !plain(previous?.relations)) return [];
  const changes = [];
  for (const [profileId, afterValue] of Object.entries(next.relations ?? {})) {
    if (!Object.hasOwn(previous.relations, profileId)) continue; // New matrices establish a baseline.
    const before = reputation(previous.relations[profileId]);
    const after = reputation(afterValue);
    if (!sameReputation(before, after)) changes.push({ profileId, before, after });
  }
  return changes;
}
export function personalChangeDetails(change, state, binding) {
  const profile = state.profiles?.[change.profileId];
  const subject = state.subjects?.[binding.subjectId];
  if (!profile || !subject || !personalBindingAvailable(state, binding) || profile.id === binding.profileId || profile.active === false || profile.archived) return null;
  if (!(profile.subjectIds ?? Object.keys(profile.relationships ?? {})).includes(binding.subjectId)) return null;
  const before = reputation(change.before), after = reputation(change.after);
  const delta = after.score - before.score;
  if (sameReputation(before, after)) return null;
  const counterpartName = String(profile.focal?.name || profile.name || "Personagem");
  const subjectName = String(subject.alias || subject.realName || "Seu personagem");
  return { ...change, before, after, delta, key: `${change.profileId}:${binding.subjectId}`, subjectId: binding.subjectId,
    personal: true, counterpartName, subjectName: counterpartName, profileName: `Sua reputação · ${subjectName}`,
    portrait: profile.focal?.portrait ?? {}, direction: delta > 0 ? "up" : delta < 0 ? "down" : "protocol",
    title: delta > 0 ? `Sua reputação aumentou com ${counterpartName}` : delta < 0 ? `Sua reputação diminuiu com ${counterpartName}` : `Seu protocolo mudou com ${counterpartName}` };
}
export function getPersonalReputationStatus(state = loadWorldState(), user = globalThis.game?.user) {
  const binding = getPersonalBinding(user);
  const stored = flag(user, PERSONAL_REPUTATION_FLAGS.VIEW);
  const linked = Boolean(binding.profileId && binding.subjectId);
  const available = personalBindingAvailable(state, binding);
  return { ...binding, linked, available, subjectName: String(state.subjects?.[binding.subjectId]?.alias || state.subjects?.[binding.subjectId]?.realName || "Seu personagem"),
    label: available ? `Reputação pessoal de ${state.subjects[binding.subjectId].alias || state.subjects[binding.subjectId].realName}` : linked ? "Seu vínculo está indisponível. Peça ao Mestre para revisar." : "Peça ao Mestre para vincular seu usuário em Sistema → Jogadores e perfis.",
    hasReport: Boolean(stored?.schema === 1 && sameBinding(stored, binding) && stored.lastReport?.length) };
}
export function buildPlayerBindingsContext(state) {
  const profiles = Object.values(state.profiles ?? {}).sort((a,b) => String(a.focal?.name || a.name).localeCompare(String(b.focal?.name || b.name), "pt-BR"));
  const subjects = Object.values(state.subjects ?? {}).sort((a,b) => String(a.alias || a.realName).localeCompare(String(b.alias || b.realName), "pt-BR"));
  return campaignUsers().map((user) => {
    const binding = getPersonalBinding(user);
    return { userId: String(user.id), userName: String(user.name || "Usuário"), initial: String(user.name || "U").slice(0,1), online: Boolean(user.active), linked: Boolean(binding.profileId && binding.subjectId),
      profiles: profiles.map((profile) => ({ id: profile.id, label: String(profile.focal?.name || profile.name), name: profile.name, selected: profile.id === binding.profileId, match: matchingProfileSubject(state, profile.id), unavailable: profile.active === false || Boolean(profile.archived) })),
      subjects: subjects.map((subject) => ({ id: subject.id, label: String(subject.alias || subject.realName), selected: subject.id === binding.subjectId, unavailable: subject.active === false || Boolean(subject.archived) })) };
  });
}
export async function setUserPersonalBinding(userId, { profileId = "", subjectId = "" }, state = loadWorldState()) {
  if (!isFullGamemaster()) throw new Error("Somente um Gamemaster completo pode vincular jogadores.");
  const user = campaignUsers().find((entry) => String(entry.id) === String(userId));
  if (!user) throw new Error("Usuário não encontrado no mundo.");
  if (profileId && !state.profiles?.[profileId]) throw new Error("Perfil não encontrado.");
  if (profileId && !subjectId) subjectId = matchingProfileSubject(state, profileId);
  if (profileId && !state.subjects?.[subjectId]) throw new Error("Escolha o personagem que representa esse perfil nas outras matrizes.");
  const binding = profileId ? { profileId: String(profileId), subjectId: String(subjectId) } : null;
  if (sameBinding(getPersonalBinding(user), binding ?? { profileId: "", subjectId: "" })) return binding;
  if (typeof user.update === "function") {
    await user.update({ [`flags.${MODULE_ID}.${PERSONAL_REPUTATION_FLAGS.BINDING}`]: binding, [`flags.${MODULE_ID}.${PERSONAL_REPUTATION_FLAGS.VIEW}`]: null });
  } else if (typeof user.setFlag === "function") {
    await user.setFlag(MODULE_ID, PERSONAL_REPUTATION_FLAGS.BINDING, binding);
    await user.setFlag(MODULE_ID, PERSONAL_REPUTATION_FLAGS.VIEW, null);
  } else throw new Error("O Foundry não disponibilizou a gravação de flags do usuário.");
  return binding;
}

/** Per-client reader: projects only this player's row across other matrices. */
export class PersonalReputationReader {
  constructor({ user = () => globalThis.game?.user, onReport = () => false, onError = () => {} } = {}) {
    this.user = user; this.onReport = onReport; this.onError = onError;
    this.view = null; this.report = new Map(); this.pending = null; this.writeTask = null; this.session = false;
  }
  _load(binding) {
    const stored = flag(this.user(), PERSONAL_REPUTATION_FLAGS.VIEW);
    if (!(this.writeTask && sameBinding(this.view, binding))) {
      this.view = stored?.schema === 1 && sameBinding(stored, binding) && plain(stored.relations) ? structuredClone(stored) : null;
    }
    this.report.clear();
  }
  open(state, { visible = true } = {}) {
    const firstOpen = !this.session;
    const binding = getPersonalBinding(this.user());
    if (firstOpen) { this.session = true; this._load(binding); }
    const shown = this.refresh(state, { visible });
    if (firstOpen && !shown && visible && this.view && personalBindingAvailable(state, binding) && !diffPersonalSnapshots(this.view, createPersonalSnapshot(state, binding)).length) {
      this.view = { ...this.view, viewedAt: Date.now() }; this._save(this.view);
    }
    return shown;
  }
  close() { this.session = false; this.report.clear(); }
  dismiss() { this.report.clear(); }
  refresh(state, { visible = true } = {}) {
    const binding = getPersonalBinding(this.user());
    if (!sameBinding(this.view, binding)) this._load(binding);
    if (!visible) return false;
    if (!personalBindingAvailable(state, binding)) {
      if (this.report.size) { this.report.clear(); this.onReport([], { binding }); }
      return false;
    }
    const snapshot = createPersonalSnapshot(state, binding);
    if (!this.view) {
      this.view = { schema: 1, ...snapshot, viewedAt: Date.now(), lastReport: [] };
      this._save(this.view);
      return false;
    }
    const pruned = [...this.report.keys()].some(profileId => !Object.hasOwn(snapshot.relations, profileId));
    for (const profileId of this.report.keys()) if (!Object.hasOwn(snapshot.relations, profileId)) this.report.delete(profileId);
    const changes = diffPersonalSnapshots(this.view, snapshot);
    if (!changes.length) {
      // Roster/deletion changes replace stale baselines without creating reputation notices.
      if (JSON.stringify(snapshot.relations) !== JSON.stringify(this.view.relations)) {
        this.view = { ...this.view, ...snapshot, lastReport: (this.view.lastReport ?? []).filter(change => Object.hasOwn(snapshot.relations, change.profileId)) }; this._save(this.view);
      }
      if (pruned) this.onReport([...this.report.values()].map(change => personalChangeDetails(change, state, binding)).filter(Boolean), { binding, since: this.view.viewedAt });
      return false;
    }
    for (const change of changes) {
      const prior = this.report.get(change.profileId);
      const merged = { ...change, before: prior?.before ?? change.before };
      if (sameReputation(merged.before, merged.after)) this.report.delete(change.profileId); else this.report.set(change.profileId, merged);
    }
    const report = [...this.report.values()];
    const details = report.map((change) => personalChangeDetails(change, state, binding)).filter(Boolean);
    if (!this.onReport(details, { binding, since: this.view.viewedAt })) return false;
    this.view = { schema: 1, ...snapshot, viewedAt: Date.now(), lastReport: report };
    this._save(this.view);
    return true;
  }
  replay(state) {
    const binding = getPersonalBinding(this.user());
    if (!sameBinding(this.view, binding)) this._load(binding);
    if (!personalBindingAvailable(state, binding)) return false;
    const details = (this.view?.lastReport ?? []).map((change) => personalChangeDetails(change, state, binding)).filter(Boolean);
    if (!details.length) return false;
    this.report = new Map(this.view.lastReport.map((change) => [change.profileId, change]));
    return this.onReport(details, { binding, replay: true, since: this.view.viewedAt });
  }
  _save(record) {
    this.pending = { user: this.user(), record: structuredClone(record) };
    if (!this.writeTask) {
      this.writeTask = Promise.resolve().then(async () => {
        while (this.pending) {
          const job = this.pending; this.pending = null;
          if (!sameBinding(getPersonalBinding(job.user), job.record)) continue;
          try {
            if (typeof job.user?.setFlag !== "function") throw new Error("Não foi possível guardar a última visualização do usuário.");
            await job.user.setFlag(MODULE_ID, PERSONAL_REPUTATION_FLAGS.VIEW, job.record);
          } catch (error) { this.onError(error); }
        }
      }).finally(() => { this.writeTask = null; if (this.pending) this._save(this.pending.record); });
    }
  }
  async whenSaved() { while (this.writeTask) await this.writeTask; }
}
