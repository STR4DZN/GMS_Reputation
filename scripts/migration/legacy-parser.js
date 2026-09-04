import { LEGACY } from "../constants.js";
import { clampScore } from "../core/score.js";
import { normalizePortrait } from "../data/schema.js";

export function normalizeLegacyDescription(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 12000);
}

export function decodeLegacyDescription(value) {
  try {
    return normalizeLegacyDescription(decodeURIComponent(String(value ?? "")));
  } catch (_error) {
    return normalizeLegacyDescription(value);
  }
}

export function parseLegacyPageContent(content = "") {
  const parsed = new DOMParser().parseFromString(String(content ?? ""), "text/html");
  const rows = Array.from(parsed.body.querySelectorAll(`.${LEGACY.CARD_CLASS} [data-character]`));
  const records = [];

  if (rows.length) {
    for (const row of rows) {
      const realName = row.getAttribute("data-character")?.trim();
      if (!realName) continue;
      const communion = row.getAttribute("data-communion") === "true"
        || row.getAttribute("data-bouquet") === "true"
        || Boolean(row.querySelector('[data-communion-bouquet="true"]'))
        || Boolean(row.querySelector('[data-dating-bouquet="true"]'));
      const bond = row.getAttribute("data-bond") === "true"
        || Boolean(row.querySelector('[data-vinculo-star="true"]'));

      records.push({
        realName,
        score: clampScore(row.getAttribute("data-value"), { communion, bond }),
        communion,
        bond,
        portrait: normalizePortrait({
          src: row.getAttribute("data-portrait-src"),
          zoom: row.getAttribute("data-portrait-zoom"),
          x: row.getAttribute("data-portrait-x"),
          y: row.getAttribute("data-portrait-y")
        })
      });
    }
  } else {
    // Compatibilidade com a tabela pré-card. Não inventa especiais/retratos inexistentes.
    for (const row of parsed.body.querySelectorAll("table tr")) {
      const cells = row.querySelectorAll("td");
      if (cells.length < 3) continue;
      const realName = cells[0].textContent.replace(/^[\s\xA0]+|[\s\xA0]+$/g, "").replace(/:$/, "").trim();
      const match = cells[2].textContent.trim().match(/\(([-+]?\d+(?:[.,]\d+)?)\)/);
      if (!realName || !match) continue;
      records.push({
        realName,
        score: clampScore(match[1].replace(",", ".")),
        communion: false,
        bond: false,
        portrait: normalizePortrait()
      });
    }
  }

  const focalNode = parsed.body.querySelector('[data-gms-focal-profile="true"]');
  const actorHeader = String(content ?? "").match(/@Actor\[[^\]]+\]\{[^}]+\}/i)?.[0] ?? null;
  const focal = focalNode ? {
    portrait: normalizePortrait({
      src: focalNode.getAttribute("data-profile-src"),
      zoom: focalNode.getAttribute("data-profile-zoom"),
      x: focalNode.getAttribute("data-profile-x"),
      y: focalNode.getAttribute("data-profile-y")
    }),
    description: decodeLegacyDescription(focalNode.getAttribute("data-profile-description"))
  } : {
    portrait: normalizePortrait(),
    description: ""
  };

  return {
    records,
    focal,
    actorHeader,
    detectedFormat: rows.length ? "card" : records.length ? "legacy-table" : "none"
  };
}

export function normalizeLegacyPortraitFlag(value = {}) {
  const source = value?.portraits && typeof value.portraits === "object" ? value.portraits : value;
  const result = {};
  for (const [name, portrait] of Object.entries(source ?? {})) {
    result[String(name)] = normalizePortrait(portrait);
  }
  return result;
}

export function portraitSignature(portrait = {}) {
  const value = normalizePortrait(portrait);
  return `${value.src}\u0000${value.zoom}\u0000${value.x}\u0000${value.y}`;
}
