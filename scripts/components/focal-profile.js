import { buildPortraitFrameModel } from "./portrait-frame.js";
import { normalizeFocalDescription, normalizeFocalName } from "../data/profile-registry.js";

/** BLOCO 24 — componente Player read-only; sem controles, overlays ou efeitos sobre a imagem. */
export function buildFocalProfileContext(profile = {}) {
  const focal = profile.focal ?? profile;
  const name = normalizeFocalName(focal.name, profile.name || "Perfil focal");
  const description = normalizeFocalDescription(focal.description);
  const portrait = buildPortraitFrameModel(focal.portrait, {
    kind: "focal",
    label: `Imagem de ${name}`,
    lazy: false
  });
  return Object.freeze({
    profileId: String(profile.id || profile.profileId || ""),
    name,
    description,
    hasDescription: Boolean(description),
    portrait
  });
}
