import { LEGACY, MODULE_VERSION } from "../constants.js";
import { createEmptyWorldState, createProfile, createRelationship, createSubject, normalizePortrait } from "../data/schema.js";
import { LEGACY_SUBJECT_SEED } from "../data/legacy-seed.js";
import { isWorldStateEmpty, loadWorldState, saveWorldState } from "../persistence/world-store.js";
import { normalizeLegacyPortraitFlag, parseLegacyPageContent, portraitSignature } from "./legacy-parser.js";

function pageModifiedTime(page) {
  const value = page?._stats?.modifiedTime ?? page?._source?._stats?.modifiedTime ?? 0;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function safeSlug(value) {
  return String(value ?? "subject")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36) || "subject";
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function unknownSubjectId(realName) {
  return `gms-legacy-${safeSlug(realName)}-${fnv1a32(realName)}`;
}

function buildSeedIndex() {
  return new Map(LEGACY_SUBJECT_SEED.map((entry) => [entry.realName.toLocaleLowerCase("pt-BR"), entry]));
}

function resolveSubjectSeed(realName, discoveredOrder, seedIndex) {
  const known = seedIndex.get(String(realName).toLocaleLowerCase("pt-BR"));
  if (known) return known;
  return {
    id: unknownSubjectId(realName),
    realName: String(realName),
    alias: String(realName),
    sortOrder: 1000 + discoveredOrder * 10
  };
}

function getPageUuid(journal, page) {
  return page?.uuid ?? (journal?.uuid && page?.id ? `${journal.uuid}.JournalEntryPage.${page.id}` : null);
}

export async function resolveLegacyJournal() {
  const resolver = globalThis.fromUuid ?? globalThis.foundry?.utils?.fromUuid;
  if (typeof resolver !== "function") throw new Error("Foundry fromUuid is not available.");
  try {
    const journal = await resolver(LEGACY.JOURNAL_UUID);
    return journal?.documentName === "JournalEntry" ? journal : null;
  } catch (_error) {
    return null;
  }
}

/**
 * Constrói um snapshot sem gravar nada. É seguro chamar para preview/diagnóstico.
 */
export async function buildLegacyMigrationSnapshot(journal = null) {
  const sourceJournal = journal ?? await resolveLegacyJournal();
  if (!sourceJournal) return { available: false, reason: "journal-not-found", state: null, report: null };

  const htmlFormat = globalThis.CONST?.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1;
  const pages = (sourceJournal.pages?.contents ?? Array.from(sourceJournal.pages ?? []))
    .filter((page) => page?.type === "text" && page.text?.format === htmlFormat);

  if (!pages.length) return { available: false, reason: "no-html-pages", state: null, report: null };

  const parsedPages = pages.map((page, index) => ({
    page,
    index,
    modifiedTime: pageModifiedTime(page),
    parsed: parseLegacyPageContent(page.text?.content ?? "")
  }));

  let rawPortraitFlag = {};
  try {
    rawPortraitFlag = sourceJournal.getFlag?.(LEGACY.SHARED_PORTRAIT_FLAG_SCOPE, LEGACY.SHARED_PORTRAIT_FLAG_KEY) ?? {};
  } catch (_error) {
    rawPortraitFlag = {};
  }
  const flagPortraits = normalizeLegacyPortraitFlag(rawPortraitFlag);

  const seedIndex = buildSeedIndex();
  const discoveredNames = [];
  const seenNames = new Set();
  for (const entry of parsedPages) {
    for (const record of entry.parsed.records) {
      const key = record.realName.toLocaleLowerCase("pt-BR");
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      discoveredNames.push(record.realName);
    }
  }
  for (const seed of LEGACY_SUBJECT_SEED) {
    const key = seed.realName.toLocaleLowerCase("pt-BR");
    if (!seenNames.has(key)) {
      seenNames.add(key);
      discoveredNames.push(seed.realName);
    }
  }

  const subjectSeedByName = new Map();
  discoveredNames.forEach((name, index) => subjectSeedByName.set(
    name.toLocaleLowerCase("pt-BR"),
    resolveSubjectSeed(name, index, seedIndex)
  ));

  const portraitCandidates = new Map();
  for (const name of discoveredNames) portraitCandidates.set(name.toLocaleLowerCase("pt-BR"), []);
  for (const entry of parsedPages) {
    for (const record of entry.parsed.records) {
      if (!record.portrait?.src) continue;
      const key = record.realName.toLocaleLowerCase("pt-BR");
      if (!portraitCandidates.has(key)) portraitCandidates.set(key, []);
      portraitCandidates.get(key).push({
        source: `page:${entry.page.id}`,
        priority: 10,
        modifiedTime: entry.modifiedTime,
        portrait: normalizePortrait(record.portrait)
      });
    }
  }
  for (const [name, portrait] of Object.entries(flagPortraits)) {
    if (!portrait?.src) continue;
    const key = name.toLocaleLowerCase("pt-BR");
    if (!portraitCandidates.has(key)) portraitCandidates.set(key, []);
    portraitCandidates.get(key).push({
      source: "journal-flag",
      priority: 100,
      modifiedTime: Number(rawPortraitFlag?.updatedAt) || Number.MAX_SAFE_INTEGER,
      portrait: normalizePortrait(portrait)
    });
  }

  const subjects = {};
  const portraitConflicts = [];
  for (const name of discoveredNames) {
    const key = name.toLocaleLowerCase("pt-BR");
    const seed = subjectSeedByName.get(key);
    const candidates = [...(portraitCandidates.get(key) ?? [])].sort((a, b) => (
      b.priority - a.priority || b.modifiedTime - a.modifiedTime || a.source.localeCompare(b.source)
    ));
    const chosen = candidates[0]?.portrait ?? normalizePortrait();
    const unique = new Map();
    for (const candidate of candidates) unique.set(portraitSignature(candidate.portrait), candidate);
    if (unique.size > 1) {
      portraitConflicts.push({
        subjectId: seed.id,
        realName: seed.realName,
        chosenSource: candidates[0]?.source ?? null,
        candidates: candidates.map((candidate) => ({
          source: candidate.source,
          modifiedTime: candidate.modifiedTime,
          portrait: candidate.portrait
        }))
      });
    }
    subjects[seed.id] = createSubject({
      ...seed,
      portrait: chosen,
      metadata: {
        legacyNames: [seed.realName],
        migratedFromLegacy: true
      }
    });
  }

  const profiles = {};
  const skippedPages = [];
  for (const entry of parsedPages) {
    const page = entry.page;
    const parsed = entry.parsed;
    if (parsed.detectedFormat === "none") {
      skippedPages.push({ pageId: page.id, name: page.name, reason: "no-reputation-data" });
      continue;
    }
    const relationships = Object.fromEntries(
      Object.values(subjects).map((subject) => [subject.id, createRelationship(subject.id, {
        score: 0,
        communion: false,
        bond: false,
        revision: 0,
        updatedAt: entry.modifiedTime,
        updatedBy: null
      })])
    );
    for (const record of parsed.records) {
      const seed = subjectSeedByName.get(record.realName.toLocaleLowerCase("pt-BR"));
      if (!seed) continue;
      relationships[seed.id] = createRelationship(seed.id, {
        score: record.score,
        communion: record.communion,
        bond: record.bond,
        revision: 0,
        updatedAt: entry.modifiedTime,
        updatedBy: null
      });
    }
    const profileId = `gms-profile-${page.id}`;
    const legacyActorLabel = String(parsed.actorHeader ?? "").match(/\{([^}]+)\}\s*$/)?.[1]?.trim() || "";
    profiles[profileId] = createProfile({
      id: profileId,
      name: page.name ?? `Perfil ${entry.index + 1}`,
      source: {
        journalUuid: sourceJournal.uuid ?? LEGACY.JOURNAL_UUID,
        pageId: page.id,
        pageUuid: getPageUuid(sourceJournal, page)
      },
      focal: {
        ...parsed.focal,
        name: legacyActorLabel || page.name || `Perfil ${entry.index + 1}`
      },
      relationships,
      sortOrder: (entry.index + 1) * 10,
      metadata: {
        migratedFromLegacy: true,
        legacyFormat: parsed.detectedFormat,
        legacyPageModifiedTime: entry.modifiedTime,
        legacyActorHeader: parsed.actorHeader
      }
    });
  }

  const state = createEmptyWorldState({ createdBy: globalThis.game?.user?.id ?? null });
  state.subjects = subjects;
  state.profiles = profiles;
  state.migration = {
    legacyMacroImported: true,
    sourceUiVersion: LEGACY.UI_VERSION,
    importedAt: Date.now(),
    sourceJournalUuid: sourceJournal.uuid ?? LEGACY.JOURNAL_UUID,
    sourceModuleVersion: MODULE_VERSION,
    portraitConflictCount: portraitConflicts.length,
    portraitConflicts,
    skippedPages,
    unknownSubjects: Object.values(subjects)
      .filter((subject) => subject.id.startsWith("gms-legacy-"))
      .map((subject) => ({ id: subject.id, realName: subject.realName }))
  };

  const report = {
    journalUuid: sourceJournal.uuid ?? LEGACY.JOURNAL_UUID,
    journalName: sourceJournal.name ?? "",
    pagesScanned: pages.length,
    profilesImported: Object.keys(profiles).length,
    subjectsImported: Object.keys(subjects).length,
    portraitConflicts,
    skippedPages,
    unknownSubjects: Object.values(subjects)
      .filter((subject) => subject.id.startsWith("gms-legacy-"))
      .map((subject) => ({ id: subject.id, realName: subject.realName }))
  };

  return { available: true, reason: null, state, report };
}

/**
 * Importação automática conservadora: só grava se o banco novo estiver vazio e nunca tiver
 * marcado a macro como importada. Em qualquer outro cenário retorna um relatório e não mescla.
 */
export async function migrateLegacyIfNeeded({ auto = true } = {}) {
  const current = loadWorldState();
  if (current.migration?.legacyMacroImported) {
    return { status: "already-imported", state: current, report: null };
  }
  if (!isWorldStateEmpty(current)) {
    return { status: "new-store-not-empty", state: current, report: null };
  }

  const preview = await buildLegacyMigrationSnapshot();
  if (!preview.available) return { status: preview.reason, state: current, report: preview.report };
  if (!auto) return { status: "preview", state: preview.state, report: preview.report };

  const saved = await saveWorldState(preview.state, {
    expectedRevision: current.revision,
    userId: globalThis.game?.user?.id ?? null,
    createBackup: true
  });
  return { status: "imported", state: saved, report: preview.report };
}
