import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../styles/gms-reputation-59.10.css", import.meta.url), "utf8");
const motion = await readFile(new URL("../scripts/motion/motion-system.js", import.meta.url), "utf8");
const art = await readFile(new URL("../templates/partials/background-art.hbs", import.meta.url), "utf8");
const masterTemplate = await readFile(new URL("../templates/apps/master-panel.hbs", import.meta.url), "utf8");
const dualIcon = await readFile(new URL("../assets/icons/dual-sync-sigil.svg", import.meta.url), "utf8");

// Semantic propagation remains explicit.
for (const [band,color] of Object.entries({
  hostile:"#FF304F", caution:"#FFB51B", neutral:"#9AA8B3", contact:"#4BC7FF",
  trusted:"#7DFF9B", ally:"#28F0D0", extreme:"#FF375F"
})) assert.match(css,new RegExp(`data-relation-band="${band}"[^\\{]*\\{[^}]*--gms596-band:${color.replace('#','\\#')}`));
assert.match(css,/--gms596-heart-color:var\(--gms596-band/);
assert.match(css,/data-heart-state="full"\]\s*>\s*i\s*\{[\s\S]*?var\(--gms596-heart-color\)/);

// 59.10 geometry: special protocol owns a larger real column and never floats over score.
assert.match(css,/grid-template-columns:72px minmax\(0,1fr\) 90px\s*!important/);
assert.match(css,/not\(\.is-special-standard\)[^{]*\{[\s\S]*?grid-template-columns:72px minmax\(0,1fr\) 150px 92px/);
assert.match(css,/\.gms-reputation-player-card__special\s*\{[\s\S]*?width:138px[\s\S]*?height:46px/);
assert.match(css,/\.gms-reputation-player-card__score strong\s*\{[\s\S]*?font-size:54px/);
assert.match(css,/\.gms-reputation-player-card__relation\s*\{[\s\S]*?height:19px[\s\S]*?font-size:10px/);
assert.match(css,/\.gms-reputation-player-card__relation::after\s*\{[\s\S]*?content:none/);

// Background assets remain, but are static textures and particle system stays retired.
assert.doesNotMatch(art,/data-gms-petal-field|light-fragment/);
assert.doesNotMatch(css,/\.petal-field\b|\.petal(?:\[|::|\s*\{)|gms59[56]-petal-(?:fall|fallback)|light-fragment/);
assert.match(art,/class="botanical tl"/);
assert.match(art,/class="vector-ribbon top"/);
assert.match(art,/class="concept-seal"/);
assert.match(css,/\.gms-atmosphere \*,[\s\S]*?animation:\s*none\s*!important/);
assert.match(css,/\.gms-atmosphere \.vector-ribbon path\s*\{[\s\S]*?stroke-dashoffset:\s*0\s*!important/);

// Functional sci-fi UI motion remains; background-specific motion is overridden static.
assert.match(css,/gms-reputation-player-card__trace[\s\S]*animation:gms595-trace-flow/);
assert.match(css,/gms-player-dashboard__title strong[\s\S]*gms599-title-signal/);
assert.match(css,/@keyframes\s+gms599-title-signal/);

// Scanner is the retained ambient motion and traverses the full application height.
assert.match(motion,/DEFAULT_SCANNER_MS = 3200/);
assert.match(motion,/AMBIENT_SCANNER_MS = 5000/);
assert.match(motion,/AMBIENT_FIRST_DELAY_MS = 900/);
assert.match(motion,/AMBIENT_INTERVAL_MS = 9000/);
assert.match(css,/gms599-page-scan/);
assert.match(css,/var\(--gms57-scan-distance,900px\) \+ 114px/);
assert.match(css,/>\s*\.gms-motion-scanner/);

// Pink base accent has become cyan; Dual//Sync keeps cyan+violet distinction.
assert.match(css,/--gms599-cyan:\s*#45E7F3/);
assert.match(css,/--gms595-petal:\s*var\(--gms599-cyan\)/);
assert.doesNotMatch(dualIcon,/#FF2BD6/i);
assert.match(dualIcon,/#8D78FF/i);

// Master protocol console exposes all three concepts clearly.
assert.match(masterTemplate,/gms-master-panel__protocol-derived/);
assert.match(masterTemplate,/DUPLO\/\/SINC/);
assert.match(masterTemplate,/data-active="\{\{selection\.special\.dualSyncActive\}\}"/);
console.log("maximum-detail-fidelity-59.10: OK");
