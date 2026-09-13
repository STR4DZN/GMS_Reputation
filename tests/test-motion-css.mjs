import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as Motion from "../scripts/motion/motion-system.js";

const manifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));
assert.equal(manifest.version, "1.2.0-dev.60.8");
assert.deepEqual(manifest.styles, ["styles/gms-reputation-59.10.css", "styles/gms-reputation-60.8.css"]);
assert.deepEqual(manifest.esmodules, ["scripts/main.js"]);

const css = await readFile(new URL("../styles/gms-reputation-59.10.css", import.meta.url), "utf8");
const layoutCss = await readFile(new URL("../styles/gms-reputation-60.8.css", import.meta.url), "utf8");
assert.doesNotMatch(css, /prefers-reduced-motion|data-gms-performance|performance-mode|figma/i);
assert.doesNotMatch(css, /player-favorite|is-favorite|gms-player-density|density-mode/i);
assert.match(css, /\.gms-motion-scanner/);
assert.match(css, /@keyframes\s+gms57-console-sweep/);
assert.match(css, /data-gms-motion-system="59"/);
assert.match(css, /\.gms-subject-detail\[data-gms-visual-generation="3"\]/);
assert.equal((css.match(/\{/g) ?? []).length, (css.match(/\}/g) ?? []).length, "CSS base com chaves desbalanceadas");
assert.equal((layoutCss.match(/\{/g) ?? []).length, (layoutCss.match(/\}/g) ?? []).length, "CSS 60.8 com chaves desbalanceadas");
assert.match(layoutCss, /\.application\.gms-reputation-player-dashboard-app\.gms-player-dashboard\[data-gms-layout="60\.5"\]/, "layout deve reconhecer o Player quando root:true funde as classes no root da ApplicationV2");
assert.match(layoutCss, /\.gms-player-dashboard__stage\s*\{[^}]*grid-column:\s*2\s*!important;[^}]*grid-row:\s*1\s*!important;/s, "stage principal deve ocupar coluna direita");
assert.match(layoutCss, /\.gms-player-dashboard__scroll\s*\{[^}]*grid-column:\s*1\s*!important;[^}]*grid-row:\s*2\s*!important;/s, "scroll deve ficar abaixo do cabeçalho dentro do stage");
assert.match(layoutCss, /@container\s+gms-player-dashboard/);
assert.match(layoutCss, /\.application\.gms-reputation-master-panel-app\.gms-master-panel\[data-gms-layout="60\.5"\]/, "layout deve reconhecer o Master quando root:true funde as classes no root da ApplicationV2");
assert.match(layoutCss, /repeat\(6,\s*minmax\(92px,\s*1fr\)\)/, "Master deve manter seis abas horizontais");
assert.equal(Motion.shouldRunMotion({ dataset: { gmsPerformance: "performance" } }), true);

const classes = new Set();
const scannerClasses = new Set();
const scanner = {
  dataset: {}, style: { values: new Map(), setProperty(k,v){ this.values.set(k,v); } },
  classList: { add(n){scannerClasses.add(n);}, remove(n){scannerClasses.delete(n);}, contains(n){return scannerClasses.has(n);} },
  remove(){ this.removed = true; }, offsetWidth: 10
};
const root = {
  dataset: {}, clientHeight: 700, offsetWidth: 10,
  classList: { add(n){classes.add(n);}, remove(n){classes.delete(n);}, [Symbol.iterator](){return classes[Symbol.iterator]();} },
  querySelector(selector){ return selector === "[data-motion-scanner='true']" ? scanner : null; },
  querySelectorAll(){ return []; },
  getBoundingClientRect(){ return { height: 700 }; }
};
const controller = Motion.wireMotionSystem(root, { boot: false });
assert.equal(root.dataset.gmsMotionSystem, "59");
assert.equal(root.dataset.gmsRuntimeBuild, "59.10");
assert.equal(controller.scan("sync", { force: true, duration: 900 }), true);
assert.equal(scanner.dataset.variant, "sync");
assert.equal(scannerClasses.has("is-active"), true);
assert.equal(scanner.style.values.get("--gms57-scan-duration"), "900ms");
controller.destroy();
assert.equal(scanner.removed, true);

console.log("motion-css: OK");
