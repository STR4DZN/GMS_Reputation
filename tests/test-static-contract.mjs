import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
assert.deepEqual(manifest.esmodules, ["scripts/main.js"]);
assert.deepEqual(manifest.styles, ["styles/gms-reputation-59.10.css"]);
const Visual = await import("../scripts/audit/visual-contract.js");
const visualAudit = Visual.auditVisualManifest(manifest);
assert.equal(Visual.VISUAL_GENERATION, 3);
assert.equal(visualAudit.ok, true);
assert.equal(visualAudit.authorityStyle, "styles/gms-reputation-59.10.css");
assert.deepEqual([...visualAudit.unexpectedStyles], []);


const forbidden = /(?:main-5\d|templates\/v5\d|\?build=|performance-mode|player-preferences|player-favorites|player-toolbar|player-directory)/i;
const visit = async (dir) => {
  const out=[];
  for (const name of await readdir(dir)) {
    const full=path.join(dir,name); const info=await stat(full);
    if (info.isDirectory()) out.push(...await visit(full)); else out.push(full);
  }
  return out;
};
const activeSources = (await visit(path.join(root,"scripts"))).filter((p)=>p.endsWith(".js"));
for (const file of activeSources) {
  const source=await readFile(file,"utf8");
  assert.doesNotMatch(source, forbidden, `${path.relative(root,file)} contém referência histórica ativa`);
}
for (const template of await visit(path.join(root,"templates"))) {
  if (!template.endsWith(".hbs")) continue;
  const source=await readFile(template,"utf8");
  assert.doesNotMatch(source, /templates\/v5\d|favorite|player-density|player-sort|player-toolbar|data-player-search/i, `${path.relative(root,template)} contém UI aposentada`);
}
const settings = await readFile(path.join(root,"scripts/persistence/settings.js"),"utf8");
for (const dead of ["PERFORMANCE_MODE","PLAYER_FAVORITES","PLAYER_SORT_MODE","PLAYER_DENSITY"]) assert.doesNotMatch(settings,new RegExp(dead));

console.log("static-contract: OK");
