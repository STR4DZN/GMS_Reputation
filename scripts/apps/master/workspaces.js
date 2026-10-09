export const SECTIONS = Object.freeze([
  ["profiles", "Perfis", "fa-layer-group", "MATRIZES"],
  ["characters", "Personagens", "fa-user-pen", "CADASTRO"],
  ["relationship", "Reputação", "fa-heart-pulse", "RELAÇÕES"],
  ["history", "Histórico", "fa-clock-rotate-left", "AUDITORIA"],
  ["cleanup", "Limpeza", "fa-trash-can", "DADOS"],
  ["settings", "Sistema", "fa-sliders", "CONTROLE"]
]);

export const WORKSPACE_PANELS = Object.freeze({
  profiles: Object.freeze(["subjects", "profile", "focal"]),
  characters: Object.freeze(["characters", "portrait"]),
  relationship: Object.freeze(["relationship"]),
  history: Object.freeze(["history"]),
  cleanup: Object.freeze(["cleanup"]),
  settings: Object.freeze(["settings"])
});

const LEGACY_SECTION_WORKSPACE = Object.freeze({
  subjects: "profiles",
  profile: "profiles",
  focal: "profiles",
  portrait: "characters"
});

export function normalizeWorkspace(value = "profiles") {
  const requested = String(value || "profiles");
  const mapped = LEGACY_SECTION_WORKSPACE[requested] ?? requested;
  return Object.hasOwn(WORKSPACE_PANELS, mapped) ? mapped : "profiles";
}
