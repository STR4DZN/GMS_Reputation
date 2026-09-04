import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

const art = await readFile(new URL("../templates/partials/background-art.hbs", import.meta.url), "utf8");
const player = await readFile(new URL("../scripts/apps/player-dashboard.js", import.meta.url), "utf8");
const master = await readFile(new URL("../scripts/apps/master-panel.js", import.meta.url), "utf8");
const css = await readFile(new URL("../styles/gms-reputation-59.10.css", import.meta.url), "utf8");

assert.match(art,/class="botanical tl"/);
assert.match(art,/class="vector-ribbon top"/);
assert.match(art,/class="concept-seal"/);
assert.doesNotMatch(art,/data-gms-petal-field|class="petal-field"|light-fragment/);
assert.doesNotMatch(player,/background-atmosphere|wireBackgroundAtmosphere|atmosphereController/);
assert.doesNotMatch(master,/background-atmosphere|wireBackgroundAtmosphere|atmosphereController/);
assert.doesNotMatch(css,/\.petal-field\b|\.petal(?:\[|::|\s*\{)|gms59[56]-petal-(?:fall|fallback)|light-fragment/);

// Final 59.10 authority freezes every descendant of the decorative atmosphere.
assert.match(css,/\.gms-atmosphere \*,[\s\S]*?\.gms-atmosphere \*::after[\s\S]*?animation:\s*none\s*!important/);
assert.match(css,/\.gms-player-dashboard__header-circuit,[\s\S]*?\.gms-player-dashboard__vector-field[\s\S]*?animation:\s*none\s*!important/);
assert.match(css,/\.gms-atmosphere \.vector-ribbon path[\s\S]*?stroke-dashoffset:\s*0\s*!important/);
assert.match(css,/\.gms-atmosphere \.art-stage \.botanical,[\s\S]*?animation:none\s*!important/);
assert.match(css,/\.gms-atmosphere \.art-stage \.vector-ribbon path,[\s\S]*?\.concept-seal \.pulse[\s\S]*?animation:none\s*!important/);

let runtimeExists=true;
try { await access(new URL("../scripts/motion/background-atmosphere.js", import.meta.url), fsConstants.F_OK); } catch { runtimeExists=false; }
assert.equal(runtimeExists,false,"petal runtime must be physically absent");
console.log("atmosphere-static-no-petals: OK");
