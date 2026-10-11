import { getReputationView } from "../core/reputation-engine.js";
import { normalizePortrait } from "../core/portrait.js";
import { subscribeWorldStateChanges } from "../events/world-sync.js";
import { PersonalReputationReader, getPersonalReputationStatus } from "../persistence/personal-reputation.js";
import { loadWorldState } from "../persistence/world-store.js";
import { notify } from "../apps/application-compat.js";
import { wirePortraitVisibility } from "../components/portrait-visibility.js";

function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
export function formatReputationScore(value, { signed = false } = {}) {
  const number = Number(value) || 0;
  return `${signed && number > 0 ? "+" : ""}${String(number).replace(".", ",")}`;
}

function describe(change) {
  const beforeView = getReputationView(change.before);
  const afterView = getReputationView(change.after);
  const delta = afterView.score - beforeView.score;
  return { ...change, portrait: normalizePortrait(change.portrait), before: beforeView.relationship, after: afterView.relationship, beforeView, afterView, delta, direction: delta > 0 ? "up" : delta < 0 ? "down" : "protocol",
    title: change.personal ? (delta > 0 ? `Sua reputação aumentou com ${change.counterpartName}` : delta < 0 ? `Sua reputação diminuiu com ${change.counterpartName}` : `Seu protocolo mudou com ${change.counterpartName}`) : delta > 0 ? "Reputação aumentou" : delta < 0 ? "Reputação diminuiu" : "Protocolo atualizado" };
}

/** Only committed transitions of known profiles/subjects generate feedback. */
export function buildReputationChanges({ previous, state, diff } = {}) {
  if (!previous || !state || Number(state.revision) <= Number(previous.revision)) return [];
  const changes = [];
  for (const { profileId, subjectId } of diff?.relationshipChanges ?? []) {
    const oldProfile = previous.profiles?.[profileId];
    const before = oldProfile && previous.subjects?.[subjectId] ? oldProfile.relationships?.[subjectId] ?? { score: 0 } : null;
    const after = state.profiles?.[profileId]?.relationships?.[subjectId];
    const subject = state.subjects?.[subjectId];
    const profile = state.profiles?.[profileId];
    if (!before || !after || !subject || !profile) continue;
    const a = getReputationView(before).relationship;
    const b = getReputationView(after).relationship;
    if (a.score === b.score && a.bond === b.bond && a.communion === b.communion) continue;
    changes.push(describe({ key: `${profileId}:${subjectId}`, profileId, subjectId,
      profileName: String(profile.name || "Perfil"), subjectName: String(subject.alias || subject.realName || "Personagem"),
      portrait: normalizePortrait(subject.portrait), before: a, after: b,
      revision: state.revision, active: subject.active !== false && !subject.archived && profile.active !== false && !profile.archived,
      included: (profile.subjectIds ?? Object.keys(profile.relationships ?? {})).includes(subjectId) }));
  }
  return changes;
}

/** Coalesces a relation's rapid changes and bounds the number of pending DOM cards. */
export class ReputationFeedbackQueue {
  constructor({ limit = 24 } = {}) { this.limit = limit; this.items = []; }
  push(item) {
    const previous = this.items.find((entry) => entry.key === item.key);
    if (previous && !previous.batch && !item.batch) {
      Object.assign(previous, describe({ ...item, before: previous.before }));
      if (previous.delta === 0 && previous.before.bond === previous.after.bond && previous.before.communion === previous.after.communion) this.remove(previous.key);
      return;
    }
    if (previous) this.remove(item.key);
    this.items.push(item);
    if (this.items.length > this.limit) {
      // Preserve every change inside one summary instead of dropping bulk feedback.
      const overflow = this.items.splice(0, this.items.length - this.limit + 1);
      const merged = new Map();
      for (const change of overflow.flatMap((entry) => entry.batch ? entry.changes : [entry])) {
        const prior = merged.get(change.key);
        merged.set(change.key, prior ? describe({ ...change, before: prior.before }) : change);
      }
      const changes = [...merged.values()];
      this.items.unshift({ key: "overflow", batch: true, changes, profileId: null, revision: Math.max(...changes.map((change) => change.revision || 0)), title: "Alterações recentes" });
    }
  }
  remove(key) { this.items = this.items.filter((entry) => entry.key !== key); }
  clear() { this.items = []; }
}

function hearts(view) {
  const path = "M12 21s-9-5.8-9-12A5 5 0 0 1 12 6a5 5 0 0 1 9 3c0 6.2-9 12-9 12Z";
  return `<span class="gms-feedback-hearts" role="img" aria-label="${escape(view.hearts.accessibleLabel)}">${view.hearts.slots.map((slot) => `<span data-state="${slot.state}" style="--heart-accent:${slot.accent}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg></span>`).join("")}</span>`;
}

function changeHTML(change, { compact = false, message = true } = {}) {
  const before = change.beforeView;
  const after = change.afterView;
  const delta = change.direction === "protocol" ? "PROTOCOLO" : formatReputationScore(change.delta, { signed: true });
  const special = after.special.presentation;
  const previousSpecial = before.special.presentation;
  const specialText = special.active ? special.compactLabel || special.label : "Sem protocolo especial";
  const previousSpecialText = previousSpecial.active ? previousSpecial.compactLabel || previousSpecial.label : "Sem protocolo especial";
  return `<div class="gms-feedback-change" data-direction="${change.direction}">
    ${change.personal && message ? `<p class="gms-feedback-personal-message">${escape(change.title)}</p>` : ""}
    <div class="gms-feedback-identity">${change.portrait.src ? `<img data-gms-portrait-src="${escape(change.portrait.src)}" data-gms-portrait-state="suspended" alt="" style="object-position:${change.portrait.x}% ${change.portrait.y}%">` : '<span class="gms-feedback-avatar" aria-hidden="true">◇</span>'}<div><small>${escape(change.profileName)}</small><strong>${escape(change.subjectName)}</strong></div><b class="gms-feedback-delta">${delta}</b></div>
    <div class="gms-feedback-comparison"><div><small>ANTES</small><strong>${formatReputationScore(before.score)}<em> / ${before.scoreLimit}</em></strong><span>${escape(before.band.label)}</span></div><span class="gms-feedback-arrow" aria-hidden="true">→</span><div style="--band:${after.band.accent}"><small>AGORA</small><strong>${formatReputationScore(after.score)}<em> / ${after.scoreLimit}</em></strong><span>${escape(after.band.label)}</span></div></div>
    ${compact ? "" : `<div class="gms-feedback-tracks"><div>${hearts(before)}</div><div>${hearts(after)}</div></div><div class="gms-feedback-protocol">${escape(previousSpecialText === specialText ? specialText : `${previousSpecialText} → ${specialText}`)}<span>Limite ${after.scoreLimit}</span></div>`}
    <button type="button" class="gms-feedback-inspect" data-feedback-inspect="${escape(change.key)}">Ver relação <span aria-hidden="true">↗</span></button>
  </div>`;
}

const surfaces = new Map();
let unsubscribe = null;
let dock = null;
let portraitVisibility = null;
const queue = new ReputationFeedbackQueue();
const timers = new Map();
const expanded = new Map();
const DURATION = 8500;
const visibleCount = () => (globalThis.innerWidth < 560 || globalThis.innerHeight < 740) ? 1 : 2;

function canViewPersonal() {
  return !globalThis.document?.hidden && [...surfaces.values()].some((surface) => surface.isRendered());
}
function showPersonalReport(changes, { binding, replay = false } = {}) {
  if (!canViewPersonal()) return false;
  for (const [key] of timers) removeTimer(key);
  queue.clear();
  if (!changes.length) { expanded.clear(); if (dock) renderDock(); return true; }
  const key = `personal:${globalThis.game?.user?.id}:${binding.profileId}:${binding.subjectId}`;
  const ordered = changes.map(describe).sort((a,b) => ({up:0,down:1,protocol:2}[a.direction] - {up:0,down:1,protocol:2}[b.direction]) || a.subjectName.localeCompare(b.subjectName,"pt-BR"));
  queue.push({ key, personal: true, batch: true, changes: ordered, revision: ++reportRevision,
    title: ordered.length === 1 ? ordered[0].title : "Suas atualizações de reputação", replay });
  renderDock();
  const announcer = dock?.querySelector(".gms-feedback-announcer");
  if (announcer) announcer.textContent = ordered.length === 1 ? ordered[0].title : `Sua reputação mudou com ${ordered.length} personagens. Abra o resumo para ver os detalhes.`;
  updatePersonalControls();
  return Boolean(dock && !dock.hidden);
}
let reportRevision = 0;
let bindingHook = null;
let flagErrorShown = false;
const reader = new PersonalReputationReader({ onReport: showPersonalReport, onError(error) {
  console.warn("GMS Reputation | Personal read marker could not be saved.", error);
  if (!flagErrorShown) { flagErrorShown = true; notify("warn", "Não foi possível guardar sua última visualização. Seu resumo continuará disponível e poderá reaparecer na próxima sessão."); }
} });
function updatePersonalControls(state = loadWorldState()) {
  const status = getPersonalReputationStatus(state);
  for (const surface of surfaces.values()) {
    const root = surface.owner.element?.[0] ?? surface.owner.element;
    for (const button of root?.querySelectorAll?.("[data-personal-reputation-open]") ?? []) {
      button.disabled = !status.available;
      button.title = status.available ? "Rever seu último resumo de reputação" : status.label;
    }
    for (const label of root?.querySelectorAll?.("[data-personal-reputation-label]") ?? []) label.textContent = status.label;
  }
}
function refreshPersonal(state = loadWorldState()) {
  if (!surfaces.size) return;
  reader.refresh(state, { visible: canViewPersonal() });
  updatePersonalControls(state);
}
function removeTimer(key) {
  const timer = timers.get(key);
  if (timer) clearTimeout(timer.id);
  timers.delete(key);
}
function pause(key) {
  const timer = timers.get(key);
  if (!timer || timer.paused) return;
  clearTimeout(timer.id);
  timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.started));
  timer.paused = true;
}
function resume(key) {
  const timer = timers.get(key);
  if (!timer || !timer.paused || globalThis.document?.hidden) return;
  const card = [...(dock?.querySelector("[data-feedback-cards]")?.children ?? [])].find((element) => element.dataset.feedbackKey === key);
  if (card?.matches?.(":hover") || card?.contains(globalThis.document?.activeElement)) return;
  timer.paused = false;
  timer.started = Date.now();
  timer.id = setTimeout(() => dismiss(key), Math.max(1000, timer.remaining));
}
function dismiss(key) {
  removeTimer(key);
  expanded.delete(key);
  const item = queue.items.find((entry) => entry.key === key);
  queue.remove(key);
  if (item?.personal) reader.dismiss();
  renderDock();
}
function startTimer(key) {
  if (queue.items.find((item) => item.key === key)?.personal) return;
  if (timers.has(key) || expanded.has(key)) return;
  const timer = { remaining: DURATION, started: Date.now(), paused: false, id: setTimeout(() => dismiss(key), DURATION) };
  timers.set(key, timer);
  if (globalThis.document?.hidden) pause(key);
}
function renderCard(item) {
  if (item.personal && item.changes.length === 1) return `<header><span>${item.changes[0].direction === "up" ? "↗" : item.changes[0].direction === "down" ? "↘" : "◇"}</span><strong>${escape(item.title)}</strong><button type="button" data-feedback-dismiss="${escape(item.key)}" aria-label="Fechar resumo">×</button></header><p class="gms-feedback-period">${item.replay ? "Seu último resumo" : "Desde sua última visualização"}</p>${changeHTML(item.changes[0], { message: false })}`;
  if (!item.batch) return `<header><span>${item.direction === "up" ? "↗" : item.direction === "down" ? "↘" : "◇"}</span><strong>${item.title}</strong><button type="button" data-feedback-dismiss="${escape(item.key)}" aria-label="Fechar notificação">×</button></header>${changeHTML(item)}`;
  const page = Math.min(expanded.get(item.key) ?? 0, Math.max(0, Math.ceil(item.changes.length / 6) - 1));
  if (expanded.has(item.key)) expanded.set(item.key, page);
  const changes = expanded.has(item.key) ? item.changes.slice(page * 6, (page + 1) * 6) : item.changes.slice(0, 2);
  const up = item.changes.filter((change) => change.delta > 0).length;
  const down = item.changes.filter((change) => change.delta < 0).length;
  return `<header><span>◇</span><strong>${escape(item.personal ? item.title : `${item.changes.length} relações atualizadas`)}</strong><button type="button" data-feedback-dismiss="${escape(item.key)}" aria-label="Fechar notificação">×</button></header><p class="gms-feedback-summary">${up} aumentaram · ${down} diminuíram · ${item.changes.length - up - down} protocolos</p>${item.personal ? `<p class="gms-feedback-period">${item.replay ? "Seu último resumo" : "Desde sua última visualização"} · ${item.changes.length} personagem(ns)</p>` : ""}<div class="gms-feedback-batch">${changes.map((change) => changeHTML(change, { compact: !expanded.has(item.key) })).join("")}</div>${expanded.has(item.key) ? `<div class="gms-feedback-pages"><button type="button" data-feedback-page="${escape(item.key)}" data-step="-1" ${page === 0 ? "disabled" : ""}>← Anterior</button><span>${page + 1} / ${Math.ceil(item.changes.length / 6)}</span><button type="button" data-feedback-page="${escape(item.key)}" data-step="1" ${(page + 1) * 6 >= item.changes.length ? "disabled" : ""}>Próxima →</button></div>` : `<button type="button" class="gms-feedback-expand" data-feedback-expand="${escape(item.key)}">Ver todas as ${item.changes.length} alterações</button>`}`;
}
function renderDock() {
  const doc = globalThis.document;
  if (!doc?.body || !doc.createElement) return;
  if (!dock) {
    dock = doc.createElement("aside");
    dock.className = "gms-feedback-dock";
    dock.setAttribute("aria-label", "Atualizações de reputação");
    // Only the concise announcer is live. Full interactive cards are not repeatedly read.
    dock.innerHTML = '<span class="gms-feedback-announcer" role="status" aria-live="polite" aria-atomic="true"></span><div data-feedback-cards></div><span class="gms-feedback-waiting"></span>';
    dock.addEventListener("click", onDockClick);
    dock.addEventListener("pointerover", onDockPause);
    dock.addEventListener("pointerout", onDockResume);
    dock.addEventListener("focusin", onDockPause);
    dock.addEventListener("focusout", onDockResume);
    dock.addEventListener("error", (event) => {
      const portrait = event.target;
      if (portrait?.tagName !== "IMG") return;
      const fallback = doc.createElement("span"); fallback.className = "gms-feedback-avatar";
      fallback.setAttribute("aria-hidden", "true"); fallback.textContent = "◇"; portrait.replaceWith(fallback);
    }, true);
    doc.addEventListener("visibilitychange", onVisibility);
    globalThis.addEventListener?.("resize", renderDock);
    doc.body.append(dock);
    portraitVisibility = wirePortraitVisibility(dock);
  }
  const container = dock.querySelector("[data-feedback-cards]");
  const queuedKeys = new Set(queue.items.map((item) => item.key));
  for (const key of expanded.keys()) if (!queuedKeys.has(key)) expanded.delete(key);
  const visible = queue.items.slice(0, visibleCount());
  const keys = new Set(visible.map((item) => item.key));
  for (const element of [...container.children]) if (!keys.has(element.dataset.feedbackKey)) element.remove();
  for (const [key] of timers) if (!keys.has(key)) removeTimer(key);
  for (const item of visible) {
    let card = [...container.children].find((element) => element.dataset.feedbackKey === item.key);
    const signature = `${item.revision ?? "batch"}:${expanded.get(item.key) ?? "collapsed"}:${item.batch ? item.changes.length : item.after.score}`;
    if (!card) {
      card = doc.createElement("section");
      card.className = "gms-feedback-card";
      card.dataset.feedbackKey = item.key;
      container.append(card);
    }
    card.dataset.direction = item.personal && item.changes.length === 1 ? item.changes[0].direction : item.batch ? "batch" : item.direction;
    if (card.dataset.signature !== signature) {
      const focused = card.contains(doc.activeElement) ? { name: doc.activeElement?.getAttributeNames?.().find((name) => name.startsWith("data-feedback-")), step: doc.activeElement?.dataset?.step } : null;
      card.innerHTML = renderCard(item);
      if (focused?.name) [...card.querySelectorAll(`[${focused.name}]`)].find((button) => !focused.step || button.dataset.step === focused.step)?.focus();
      card.dataset.signature = signature;
    }
    startTimer(item.key);
    if (card.matches?.(":hover") || card.contains(doc.activeElement)) pause(item.key);
  }
  dock.hidden = !visible.length;
  portraitVisibility?.refresh();
  const waiting = queue.items.length - visible.length;
  dock.querySelector(".gms-feedback-waiting").textContent = waiting > 0 ? `${waiting} atualização(ões) na fila` : "";
}
function onDockPause(event) {
  const card = event.target.closest?.("[data-feedback-key]");
  if (card) pause(card.dataset.feedbackKey);
}
function onDockResume(event) {
  const card = event.target.closest?.("[data-feedback-key]");
  if (card && !card.contains(event.relatedTarget) && !card.contains(globalThis.document?.activeElement)) resume(card.dataset.feedbackKey);
}
function onVisibility() {
  for (const [key] of timers) if (globalThis.document.hidden) pause(key); else resume(key);
}
function onDockClick(event) {
  const close = event.target.closest?.("[data-feedback-dismiss]");
  if (close) return dismiss(close.dataset.feedbackDismiss);
  const expand = event.target.closest?.("[data-feedback-expand]");
  if (expand) { expanded.set(expand.dataset.feedbackExpand, 0); removeTimer(expand.dataset.feedbackExpand); renderDock();
    [...(dock?.querySelector("[data-feedback-cards]")?.children ?? [])].find((card) => card.dataset.feedbackKey === expand.dataset.feedbackExpand)?.querySelector("[data-feedback-inspect]")?.focus();
    return; }
  const page = event.target.closest?.("[data-feedback-page]");
  if (page) { expanded.set(page.dataset.feedbackPage, (expanded.get(page.dataset.feedbackPage) ?? 0) + Number(page.dataset.step)); renderDock(); return; }
  const inspect = event.target.closest?.("[data-feedback-inspect]");
  if (!inspect) return;
  const change = queue.items.flatMap((item) => item.batch ? item.changes : [item]).find((item) => item.key === inspect.dataset.feedbackInspect);
  if (!change) return;
  const surface = [...surfaces.values()].find((item) => item.isRendered() && item.kind === "player") ?? [...surfaces.values()].find((item) => item.isRendered());
  surface?.onInspect?.({ profileId: change.profileId, subjectId: change.subjectId });
}

function receive(event) { refreshPersonal(event.state); }

/** Views are per user, across other profiles. Changing the displayed profile never filters the recap. */
export function registerReputationFeedbackSurface(owner, { kind, profileId, onInspect } = {}) {
  const previous = surfaces.get(owner);
  previous?.removers?.forEach((remove) => remove());
  const surface = { owner, kind, profileId: typeof profileId === "function" ? profileId : () => String(profileId), isRendered: () => Boolean(owner.rendered) && owner.minimized !== true, onInspect, removers: [] };
  surfaces.set(owner, surface);
  if (!unsubscribe) {
    unsubscribe = subscribeWorldStateChanges(receive);
    globalThis.document?.addEventListener?.("visibilitychange", onPersonalVisibility);
    bindingHook = globalThis.Hooks?.on?.("updateUser", (user, changes) => {
      if (String(user?.id) !== String(globalThis.game?.user?.id)) return;
      const flags = changes?.flags?.["gms-reputation"];
      if (!Object.hasOwn(changes ?? {}, "flags.gms-reputation.personalReputationBinding") && !Object.hasOwn(flags ?? {}, "personalReputationBinding")) return;
      queue.clear(); expanded.clear(); reader.close();
      if (dock) renderDock();
      reader.open(loadWorldState(), { visible: canViewPersonal() }); updatePersonalControls();
    });
  }
  const root = owner.element?.[0] ?? owner.element;
  for (const button of root?.querySelectorAll?.("[data-personal-reputation-open]") ?? []) {
    const replay = () => {
      reader.refresh(loadWorldState(), { visible: canViewPersonal() });
      if (!reader.replay(loadWorldState())) notify("info", "Sua reputação ainda não tem alterações para mostrar desde a primeira visualização.");
    };
    button.addEventListener("click", replay);
    surface.removers.push(() => button.removeEventListener("click", replay));
  }
  reader.open(loadWorldState(), { visible: canViewPersonal() });
  updatePersonalControls();
}
function onPersonalVisibility() { if (!globalThis.document?.hidden) refreshPersonal(); }
export function unregisterReputationFeedbackSurface(owner) {
  surfaces.get(owner)?.removers?.forEach((remove) => remove());
  surfaces.delete(owner);
  if (surfaces.size) return;
  unsubscribe?.(); unsubscribe = null;
  if (bindingHook != null) globalThis.Hooks?.off?.("updateUser", bindingHook);
  bindingHook = null;
  reader.close(); queue.clear(); expanded.clear();
  for (const [key] of timers) removeTimer(key);
  globalThis.document?.removeEventListener?.("visibilitychange", onVisibility);
  globalThis.document?.removeEventListener?.("visibilitychange", onPersonalVisibility);
  globalThis.removeEventListener?.("resize", renderDock);
  portraitVisibility?.destroy(); portraitVisibility = null;
  dock?.remove(); dock = null;
}
