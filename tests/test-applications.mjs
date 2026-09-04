import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const storage = new Map();
globalThis.foundry = { utils: { deepClone: structuredClone } };
globalThis.game = {
  user: { id: "gm-apps", isGM: true },
  settings: {
    register(namespace, key, config) {
      const id = `${namespace}.${key}`;
      if (!storage.has(id)) storage.set(id, structuredClone(config.default));
    },
    get(namespace, key) { return structuredClone(storage.get(`${namespace}.${key}`)); },
    async set(namespace, key, value) { storage.set(`${namespace}.${key}`, structuredClone(value)); return structuredClone(value); }
  }
};

const { MODULE_ID, SETTINGS, MODULE_VERSION } = await import("../scripts/constants.js");
const Schema = await import("../scripts/data/schema.js");
const { registerPersistenceSettings } = await import("../scripts/persistence/settings.js");
registerPersistenceSettings();
assert.equal(MODULE_VERSION, "1.2.0-dev.60.1");

const state = Schema.createEmptyWorldState({ createdBy: "gm-apps" });
state.subjects.s1 = Schema.createSubject({
  id: "s1", realName: "Daniel Shirako", alias: "Corvo",
  description: "Biografia completa do Corvo.",
  portrait: { src: "corvo.webp", zoom: 120, x: 47, y: 52 },
  sortOrder: 10, metadata: { tags: ["aliado", "observado"] }
});
state.subjects.s2 = Schema.createSubject({ id: "s2", realName: "Agnes", alias: "Fio Rubro", sortOrder: 20 });
state.profiles.p1 = Schema.createProfile({
  id: "p1", name: "Perfil A", sortOrder: 10,
  focal: { name: "Titular A", portrait: { src: "focal.gif" }, description: "Perfil focal de teste." },
  relationships: { s1: { score: 8.5, bond: true }, s2: { score: -2, communion: true } }
});
state.profiles.p2 = Schema.createProfile({ id: "p2", name: "Perfil B", sortOrder: 20, relationships: { s1: { score: 2 }, s2: { score: 0 } } });
state.profiles.p3 = Schema.createProfile({ id: "p3", name: "Arquivado", archived: true, relationships: {} });
state.history.push(Schema.createHistoryEvent({ id: "h1", profileId: "p1", subjectId: "s1", type: "score", reason: "Teste", timestamp: 1000 }));
storage.set(`${MODULE_ID}.${SETTINGS.WORLD_STATE}`, structuredClone(state));
storage.set(`${MODULE_ID}.${SETTINGS.WORLD_STATE_BACKUP}`, {});

const Detail = await import("../scripts/apps/subject-detail.js");
const Player = await import("../scripts/apps/player-dashboard.js");
const Master = await import("../scripts/apps/master-panel.js");

const detail = Detail.buildSubjectDetailContext({ profileId: "p1", subjectId: "s1" });
assert.equal(detail.found, true);
assert.equal(detail.identity.alias, "Corvo");
assert.equal(detail.score.value, 8.5);
assert.equal(detail.special.label, "VÍNCULO");
assert.equal(detail.description, "Biografia completa do Corvo.");
assert.equal(detail.history.length, 1);
assert.deepEqual(detail.tags, ["aliado", "observado"]);
assert.equal(Detail.buildSubjectDetailContext({ profileId: "missing", subjectId: "s1" }).found, false);

const player = Player.buildPlayerDashboardContext({ profileId: "p1" });
assert.equal(player.hasProfile, true);
assert.equal(player.profileId, "p1");
assert.equal(player.profiles.length, 2);
assert.equal(player.cards.length, 2);
assert.equal(player.cards[0].detailEnabled, true);
assert.equal(player.focal.name, "Titular A");
assert.equal(player.totalCount, 2);
assert.equal(Object.hasOwn(player, "toolbar"), false);
assert.equal(Object.hasOwn(player, "directoryRecords"), false);
assert.equal(Object.hasOwn(player.cards[0], "favorite"), false, "favoritos aposentados não devem sobreviver no contexto Player");
const worldBefore = structuredClone(storage.get(`${MODULE_ID}.${SETTINGS.WORLD_STATE}`));
Player.buildPlayerDashboardContext({ profileId: "p2" });
assert.deepEqual(storage.get(`${MODULE_ID}.${SETTINGS.WORLD_STATE}`), worldBefore, "Player context não pode mutar WorldState");

const master = Master.buildMasterPanelContext({ profileId: "p1", subjectId: "s1", activeSection: "relationship" });
assert.equal(master.authorized, true);
assert.equal(master.sections.length, 6);
assert.deepEqual(master.sections.map((entry) => entry.id), ["profiles", "characters", "relationship", "history", "cleanup", "settings"]);
assert.equal(master.selection.score, 8.5);
assert.equal(master.selection.special.label, "VÍNCULO");
assert.equal(master.selection.special.dualSyncActive, false);
assert.equal(master.history.length, 1);
assert.equal(master.world.schemaVersion, 5);

globalThis.game.user.isGM = false;
assert.equal(Master.buildMasterPanelContext({ profileId: "p1", subjectId: "s1" }).authorized, false);
assert.equal(Master.openMasterPanel(), null);

const detailTemplate = await readFile(new URL("../templates/apps/subject-detail.hbs", import.meta.url), "utf8");
const playerTemplate = await readFile(new URL("../templates/apps/player-dashboard.hbs", import.meta.url), "utf8");
const masterTemplate = await readFile(new URL("../templates/apps/master-panel.hbs", import.meta.url), "utf8");
for (const source of [detailTemplate, playerTemplate]) {
  assert.doesNotMatch(source, /data-delta|name="score"|data-edit-portrait|data-toggle-bond|data-toggle-communion/i);
}
assert.doesNotMatch(playerTemplate, /player-toolbar|data-player-search|data-player-empty-result/i);
assert.match(playerTemplate, /gms-player-dashboard__content/);
assert.match(playerTemplate, /templates\/partials\/player-card\.hbs/);
assert.match(playerTemplate, /templates\/partials\/focal-profile\.hbs/);
assert.match(masterTemplate, /data-master-section-choice="\{\{id\}\}"/);
assert.match(masterTemplate, /data-master-section-panel="subjects"/);
assert.match(masterTemplate, /data-master-section-panel="settings"/);
assert.match(masterTemplate, /data-master-score-delta="-1"/);
assert.match(detailTemplate, /data-gms-visual-generation="3"/);

console.log("applications: OK");
