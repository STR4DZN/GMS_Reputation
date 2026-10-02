import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MODULE_VERSION } from "../scripts/constants.js";

const manifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));
const repository = "STR4DZN/GMS_Reputation";
const branch = "dev70-npc-right-sidebar";

assert.equal(manifest.id, "gms-reputation");
assert.equal(manifest.version, "1.2.0-dev.70.9");
assert.equal(manifest.version, MODULE_VERSION);
assert.equal(manifest.url, `https://github.com/${repository}`);
assert.equal(manifest.manifest, `https://raw.githubusercontent.com/${repository}/${branch}/module.json`);
assert.equal(manifest.download, `https://github.com/${repository}/archive/refs/heads/${branch}.zip`);
assert.match(manifest.manifest, /^https:\/\/raw\.githubusercontent\.com\//);
assert.match(manifest.download, /^https:\/\/github\.com\/STR4DZN\/GMS_Reputation\/archive\/refs\/heads\//);
assert.ok(manifest.download.endsWith(".zip"));

console.log("foundry-update-manifest: OK");
