import { buildIdentityModel } from "../../../components/identity.js";
import { buildPortraitFrameModel } from "../../../components/portrait-frame.js";
import { buildPortraitEditorContext } from "../../../components/portrait-editor.js";
import { buildHeartTrackModel } from "../../../components/heart-track.js";
import { buildFocalProfileContext } from "../../../components/focal-profile.js";
import { getReputationView } from "../../../core/reputation-engine.js";
import { getSemanticBand } from "../../../core/semantic-bands.js";

function quickPresets(limit = 10) {
  const values = [-10, -5, 0, 3, 6, 9, Number(limit) || 10];
  const labels = ["Hostil", "Cautela", "Neutro", "Contato", "Confiança", "Aliado", "Máximo"];
  return Object.freeze(values.map((value, index) => {
    const band = getSemanticBand(value, { bond: Number(limit) > 10 });
    return Object.freeze({ value, label: labels[index], tone: band.id, accent: band.accent });
  }));
}

/** Relationship and focal presentation preserve the existing component models. */
export function buildMasterRelationshipContext({ profile, subject }) {
  const relationship = profile && subject ? (profile.relationships?.[subject.id] ?? { subjectId: subject.id, score: 0 }) : null;
  const view = relationship ? getReputationView(relationship) : null;
  return Object.freeze({
    hasSelection: Boolean(profile && subject),
    selection: profile && subject ? Object.freeze({
      identity: buildIdentityModel(subject),
      portrait: buildPortraitFrameModel(subject.portrait, { kind: "master-subject", label: `Retrato de ${subject.alias || subject.realName}`, lazy: false }),
      portraitEditor: buildPortraitEditorContext(subject.portrait, { kind: "subject", label: `Retrato de ${subject.alias || subject.realName}` }),
      relationLabel: view.band.label,
      relationBand: view.band.id,
      relationCode: view.band.code,
      relationAccent: view.band.accent,
      polarity: view.polarity,
      score: view.score,
      scoreLimit: view.scoreLimit,
      hearts: buildHeartTrackModel(view.relationship),
      quickPresets: quickPresets(view.scoreLimit),
      special: Object.freeze({
        active: Boolean(view.special.presentation?.active),
        state: view.special.state,
        label: String(view.special.presentation?.compactLabel || view.special.presentation?.label || "Nenhum"),
        sigilAsset: String(view.special.presentation?.sigilAsset || ""),
        bondActive: Boolean(view.special.bondActive),
        communionActive: Boolean(view.special.communionActive),
        dualSyncActive: Boolean(view.special.dualSyncActive)
      }),
      portraitSource: String(subject.portrait?.src || ""),
      portraitZoom: Number(subject.portrait?.zoom) || 100,
      portraitX: Number(subject.portrait?.x) || 50,
      portraitY: Number(subject.portrait?.y) || 50
    }) : null,
    focal: profile ? buildFocalProfileContext(profile) : null,
    focalEditor: profile ? buildPortraitEditorContext(profile.focal?.portrait, { kind: "focal", label: `Retrato focal de ${profile.focal?.name || profile.name || "perfil"}` }) : null,
    focalName: profile ? String(profile.focal?.name || profile.name || "") : "",
    focalDescription: profile ? String(profile.focal?.description || "") : "",
  });
}
