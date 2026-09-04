import { SPECIAL_STATE } from "../constants.js";
import { getReputationView } from "../core/reputation-engine.js";
import { buildPortraitFrameModel } from "./portrait-frame.js";
import { buildIdentityModel } from "./identity.js";
import { buildHeartTrackModel } from "./heart-track.js";
import { QUICK_READ_SEQUENCE } from "../core/quick-read.js";

const DESCRIPTION_PREVIEW_LIMIT = 320;

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1).replace(".", ",");
}

function normalizeDescriptionPreview(value) {
  const text = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return "";
  if (text.length <= DESCRIPTION_PREVIEW_LIMIT) return text;
  return `${text.slice(0, DESCRIPTION_PREVIEW_LIMIT - 1).trimEnd()}…`;
}

function buildSpecialContext(presentation = {}) {
  const active = Boolean(presentation.active);
  return Object.freeze({
    active,
    state: presentation.state ?? SPECIAL_STATE.STANDARD,
    label: active ? String(presentation.compactLabel || presentation.label || "") : "",
    sigilAsset: active && presentation.sigilAsset ? String(presentation.sigilAsset) : ""
  });
}

/**
 * BLOCO 17/18 — modelo do Card definitivo do Player.
 * O card recebe Subject + Relationship e não persiste estado visual derivado.
 */
export function buildPlayerCardContext({
  subject = {},
  relationship = {},
  profileId = "",
  allowSecondaryDisclosure = true,
  detailEnabled = false
} = {}) {
  const view = getReputationView(relationship);
  const identity = buildIdentityModel(subject);
  const portrait = buildPortraitFrameModel(subject.portrait, {
    label: `Retrato de ${identity.alias}`,
    kind: "subject",
    lazy: true
  });
  const hearts = buildHeartTrackModel(view.relationship);
  const special = buildSpecialContext(view.special.presentation);
  const descriptionPreview = normalizeDescriptionPreview(subject.description);
  const hasSecondary = Boolean(allowSecondaryDisclosure && descriptionPreview);

  return Object.freeze({
    subjectId: subject.id ? String(subject.id) : "",
    profileId: String(profileId || ""),
    active: subject.active !== false,
    archived: Boolean(subject.archived),
    detailEnabled: Boolean(detailEnabled),
    detailAccessibleLabel: detailEnabled ? `Abrir detalhes de ${identity.alias}` : "",
    readSequence: QUICK_READ_SEQUENCE,
    portrait,
    identity,
    relationship: Object.freeze({
      label: view.band.label,
      bandId: view.band.id,
      polarity: view.polarity
    }),
    hearts,
    score: Object.freeze({
      value: view.score,
      text: formatScore(view.score),
      limit: view.scoreLimit,
      accessibleLabel: `Reputação ${formatScore(view.score)} de ${view.scoreLimit}`
    }),
    special,
    disclosure: Object.freeze({
      available: hasSecondary,
      descriptionPreview
    }),
    classes: Object.freeze([
      `is-band-${view.band.id}`,
      `is-polarity-${view.polarity}`,
      `is-special-${special.state}`,
      subject.active === false ? "is-inactive" : "",
      subject.archived ? "is-archived" : ""
    ].filter(Boolean))
  });
}

export const PLAYER_CARD_DESCRIPTION_PREVIEW_LIMIT = DESCRIPTION_PREVIEW_LIMIT;
