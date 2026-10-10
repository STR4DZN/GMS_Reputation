import { expandMasterTemplate } from "../tools/template-sources.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const css=await readFile(new URL("../styles/gms-reputation-59.10.css",import.meta.url),"utf8");
const art=await readFile(new URL("../templates/partials/background-art.hbs",import.meta.url),"utf8");
const master=await readFile(new URL("../scripts/apps/master-panel.js",import.meta.url),"utf8");
const saveControls=await readFile(new URL("../scripts/apps/master/save-controls.js",import.meta.url),"utf8");
const masterTemplate=await expandMasterTemplate();

assert.doesNotMatch(art,/data-gms-petal-field|light-fragment/);
assert.doesNotMatch(css,/\.petal-field\b|\.petal(?:\[|::|\s*\{)|gms596-petal-fallback/);
assert.match(css,/gms-reputation-player-card__relation[\s\S]*height:19px[\s\S]*text-transform:none/);
assert.match(css,/gms-reputation-player-card__relation::after[\s\S]*content:none/);
assert.match(css,/gms-reputation-player-card:not\(\.is-special-standard\)[\s\S]*grid-template-columns:72px minmax\(0,1fr\) 150px 92px/);
assert.match(css,/gms-reputation-player-card__special[\s\S]*width:138px[\s\S]*height:46px/);
assert.match(css,/@container gms-player-dashboard \(max-width:720px\)[\s\S]*gms-reputation-player-card__special[\s\S]*grid-row:3/);
assert.match(css,/gms-reputation-player-card__score strong[\s\S]*font-size:54px/);
assert.match(css,/gms-reputation-player-card:hover \.gms-reputation-identity__text[\s\S]*animation-name:none/);
assert.match(masterTemplate,/gms-master-panel__protocol-derived/);
assert.match(masterTemplate,/VÍNCULO[\s\S]*COMUNHÃO[\s\S]*DUPLO\/\/SINC/);

// Explicit save captures the current relationship values before flush.
assert.match(saveControls,/data-master-save-now[\s\S]*?queueRelationship\(\)[\s\S]*?flushPending\(\)/);
assert.match(master,/queueRelationship: \(\) => this\._queueRelationshipDraft\(root\)/);
assert.match(master,/flushPending: \(\) => this\._flushPending\(\)/);
assert.match(saveControls,/canCaptureRelationship[\s\S]*?saveNow\.disabled = snapshot\.status === "saving"/);
console.log("player-feedback-59-9: OK");
