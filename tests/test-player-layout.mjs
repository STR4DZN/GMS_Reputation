import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { buildPlayerDashboardContext } from "../scripts/apps/player-dashboard.js";
import { createEmptyWorldState, createProfile, createSubject } from "../scripts/data/schema.js";

const state = createEmptyWorldState({ createdBy: "gm-layout" });
state.subjects.c = createSubject({ id: "c", alias: "Terceiro", realName: "Terceiro", sortOrder: 30 });
state.subjects.a = createSubject({ id: "a", alias: "Primeiro", realName: "Primeiro", sortOrder: 10 });
state.subjects.b = createSubject({ id: "b", alias: "Segundo", realName: "Segundo", sortOrder: 20 });
state.profiles.p = createProfile({
  id: "p", name: "Perfil", sortOrder: 10,
  focal: { name: "Focal", description: "Teste" },
  subjectIds: ["c", "a", "b"],
  relationships: { a: { score: 1 }, b: { score: 2 }, c: { score: 3 } }
});
const context = buildPlayerDashboardContext({ profileId: "p", state });
assert.equal(context.hasProfile, true);
assert.equal(context.totalCount, 3);
assert.deepEqual(context.cards.map((card) => card.subjectId), ["a", "b", "c"], "Player deve respeitar a ordem manual definida pelo Mestre");
assert.equal(Object.hasOwn(context, "toolbar"), false);
assert.equal(Object.hasOwn(context, "directoryRecords"), false);

const template = await readFile(new URL("../templates/apps/player-dashboard.hbs", import.meta.url), "utf8");
assert.doesNotMatch(template, /type="search"|data-player-search|player-toolbar|empty-result|consulta/i);
assert.match(template, /gms-player-dashboard__content/);
assert.match(template, /data-player-matrix-content/);
assert.match(template, /gms-player-dashboard__focal/);
assert.match(template, /gms-player-dashboard__records/);

const main = await readFile(new URL("../scripts/main.js", import.meta.url), "utf8");
assert.doesNotMatch(main, /PlayerDirectory|PlayerToolbar|playerDirectory|playerToolbar/);

for (const retired of [
  new URL("../scripts/core/player-directory.js", import.meta.url),
  new URL("../scripts/components/player-toolbar.js", import.meta.url),
  new URL("../templates/partials/player-toolbar.hbs", import.meta.url)
]) {
  let exists = true;
  try { await access(retired, fsConstants.F_OK); } catch { exists = false; }
  assert.equal(exists, false, `${retired.pathname} deve ter sido removido`);
}

const css = await readFile(new URL("../styles/gms-reputation-59.10.css", import.meta.url), "utf8");
assert.match(css, /BOTANICAL VECTOR 59\.5/);
assert.match(css, /gms-reputation-player-dashboard-app \.gms-player-dashboard__content/);
assert.match(css, /width:min\(100%,980px\)\s*!important/);
assert.match(css, /grid-template-columns:78px minmax\(0,1fr\) auto 92px\s*!important/);
assert.match(css, /grid-auto-columns:28px\s*!important/);
assert.match(css, /gms-reputation-player-card__special/);
assert.match(css, /gms-reputation-master-panel-app \.gms-master-panel__nav/);
assert.match(css, /gms-master-reputation-console/);

console.log("player-layout: OK");
