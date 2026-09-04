import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

const manifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));
const cssPath = manifest.styles?.[0];
assert.equal(cssPath, "styles/gms-reputation-59.10.css");
await access(new URL(`../${cssPath}`, import.meta.url), fsConstants.F_OK);
for (const retiredCss of ["gms-reputation.css", "gms-reputation-59.4.css", "gms-reputation-59.6.css", "gms-reputation-59.7.css"]) {
  let oldExists = true;
  try { await access(new URL(`../styles/${retiredCss}`, import.meta.url), fsConstants.F_OK); } catch { oldExists = false; }
  assert.equal(oldExists, false, `A folha antiga ${retiredCss} não deve sobreviver no pacote 59.10`);
}

const css = await readFile(new URL("../styles/gms-reputation-59.10.css", import.meta.url), "utf8");
const playerTemplate = await readFile(new URL("../templates/apps/player-dashboard.hbs", import.meta.url), "utf8");
const masterTemplate = await readFile(new URL("../templates/apps/master-panel.hbs", import.meta.url), "utf8");
const playerApp = await readFile(new URL("../scripts/apps/player-dashboard.js", import.meta.url), "utf8");
const masterApp = await readFile(new URL("../scripts/apps/master-panel.js", import.meta.url), "utf8");

assert.match(playerApp, /classes:\s*\["gms-reputation-app",\s*"gms-reputation-player-dashboard-app"\]/);
assert.match(masterApp, /classes:\s*\["gms-reputation-app",\s*"gms-reputation-master-panel-app"\]/);
assert.match(playerTemplate, /class="gms-player-dashboard /);
assert.match(masterTemplate, /class="gms-master-panel /);
assert.match(playerTemplate, /data-gms-build="59\.10"/);
assert.match(masterTemplate, /data-gms-build="59\.10"/);

for (const selector of [
  ".application.gms-reputation-player-dashboard-app .gms-player-dashboard",
  ".application.gms-reputation-player-dashboard-app .gms-reputation-player-card",
  ".application.gms-reputation-player-dashboard-app .gms-reputation-heart",
  ".application.gms-reputation-master-panel-app .gms-master-panel__header",
  ".application.gms-reputation-master-panel-app .gms-master-panel__nav",
  ".application.gms-reputation-master-panel-app .gms-master-panel__content",
  ".application.gms-reputation-master-panel-app .gms-master-profile-group"
]) assert.ok(css.includes(selector), `Seletor final ausente: ${selector}`);

assert.match(playerTemplate, /partials\/background-art\.hbs/);
assert.match(masterTemplate, /partials\/background-art\.hbs/);
assert.match(css, /\.application\.gms-reputation-app \.gms-atmosphere \{[\s\S]*?position:\s*absolute\s*!important/);
assert.match(css, /\.application\.gms-reputation-app \.gms-atmosphere \{[\s\S]*?pointer-events:\s*none\s*!important/);

const art = await readFile(new URL("../templates/partials/background-art.hbs", import.meta.url), "utf8");
assert.doesNotMatch(art,/data-gms-petal-field|light-fragment/);
assert.doesNotMatch(css,/\.petal-field\b|\.petal(?:\[|::|\s*\{)/);
assert.match(css,/\.gms-atmosphere \*,[\s\S]*?animation:\s*none\s*!important/);

// Scanner is the only retained ambient background motion and is attached to Application root.
assert.match(css, /\.application\.gms-reputation-app\[data-gms-motion-system="59"\]\s*>\s*\.gms-motion-scanner/);
assert.match(css, /gms599-page-scan/);

assert.match(css, /\.application\.gms-reputation-player-dashboard-app \.gms-reputation-heart-track \{[^}]*grid-auto-columns:27px\s*!important/);
assert.match(css, /width:\s*27px\s*!important/);
assert.match(css, /height:\s*27px\s*!important/);
assert.match(css, /--gms596-heart-color:var\(--gms596-band,#9AA8B3\)\s*!important/);
assert.match(css, /grid-template-columns:72px minmax\(0,1fr\) 90px\s*!important/);

// Blocks are intentionally more opaque than 59.7 while still letting static texture read through.
assert.match(css, /linear-gradient\(180deg,rgba\(8,11,18,\.90\),rgba\(3,6,11,\.94\)\)/);
assert.match(css, /background:linear-gradient\(135deg,rgba\(9,12,20,\.88\),rgba\(4,7,13,\.82\)\)\s*!important/);

console.log("theme-real-dom-59.10: OK");
