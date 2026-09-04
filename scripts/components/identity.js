function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

export const IDENTITY_GLITCH_TIMING = Object.freeze({
  durationMs: 480,
  settleMs: 360
});

export function buildIdentityModel(subject = {}) {
  const realName = String(subject.realName ?? "").trim();
  const alias = String(subject.alias ?? "").trim();
  const primary = alias || realName || "SEM IDENTIDADE";
  const secondary = realName || primary;
  return Object.freeze({
    subjectId: subject.id ? String(subject.id) : "",
    alias: primary,
    realName: secondary,
    hasDistinctRealName: secondary !== primary,
    accessibleLabel: secondary !== primary ? `${primary}; nome real ${secondary}` : primary
  });
}

/**
 * Alias e nome real compartilham exatamente a mesma classe tipográfica.
 * Ghost layers são decorativas e só entram em ação durante um hover/focus finito.
 */
export function renderIdentityHTML(modelOrSubject = {}, { className = "" } = {}) {
  const model = Object.hasOwn(modelOrSubject, "hasDistinctRealName")
    ? modelOrSubject
    : buildIdentityModel(modelOrSubject);
  const safeExtraClass = String(className).replace(/[^\w\-\s]/g, "").trim();
  const classes = ["gms-reputation-identity", safeExtraClass, model.hasDistinctRealName ? "has-reveal" : "is-single"].filter(Boolean).join(" ");
  const alias = escapeHTML(model.alias);
  const realName = escapeHTML(model.realName);

  return `<span class="${classes}" data-subject-id="${escapeHTML(model.subjectId)}" data-identity-reveal="${model.hasDistinctRealName}" tabindex="0" aria-label="${escapeHTML(model.hasDistinctRealName ? `${model.alias}; nome real ${model.realName}` : model.alias)}"><span class="gms-reputation-identity__viewport"><span class="gms-reputation-identity__text gms-reputation-identity__alias">${alias}</span><span class="gms-reputation-identity__text gms-reputation-identity__real" aria-hidden="true">${realName}</span>${model.hasDistinctRealName ? `<span class="gms-reputation-identity__ghost is-cyan" aria-hidden="true">${realName}</span><span class="gms-reputation-identity__ghost is-magenta" aria-hidden="true">${realName}</span><i class="gms-reputation-identity__band is-a" aria-hidden="true"></i><i class="gms-reputation-identity__band is-b" aria-hidden="true"></i><i class="gms-reputation-identity__band is-c" aria-hidden="true"></i>` : ""}</span></span>`;
}
