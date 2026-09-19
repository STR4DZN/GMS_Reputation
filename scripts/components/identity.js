export function buildIdentityModel(subject = {}) {
  const alias = String(subject.alias ?? "").trim();
  const realName = String(subject.realName ?? "").trim();
  const hasDistinctRealName = Boolean(alias && realName && alias !== realName);
  const primary = alias || realName || "Sem identificação";
  const secondary = hasDistinctRealName ? realName : "";

  return Object.freeze({
    subjectId: String(subject.id || ""),
    alias: primary,
    realName: secondary,
    hasDistinctRealName,
    accessibleLabel: hasDistinctRealName ? `${primary}, codinome de ${secondary}` : primary
  });
}
