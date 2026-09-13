import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));

assert.equal(manifest.id, "gms-reputation");
assert.equal(manifest.version, "1.2.0-dev.60.6");
assert.equal(manifest.url, "https://github.com/STR4DZN/GMS_Reputation");
assert.equal(manifest.manifest, "https://raw.githubusercontent.com/STR4DZN/GMS_Reputation/main/module.json");
assert.equal(
  manifest.download,
  "https://github.com/STR4DZN/GMS_Reputation/releases/download/v1.2.0-dev.60.6/GMS_Reputation_1.2.0-dev.60.6.zip"
);
assert.match(manifest.manifest, /^https:\/\/raw\.githubusercontent\.com\//);
assert.match(manifest.download, /^https:\/\/github\.com\/STR4DZN\/GMS_Reputation\/releases\/download\//);
assert.ok(manifest.download.includes(`/v${manifest.version}/`), "download deve usar a tag correspondente à versão");
assert.ok(manifest.download.endsWith(`GMS_Reputation_${manifest.version}.zip`), "asset deve acompanhar a versão do manifesto");
assert.ok(manifest.styles.includes("styles/gms-reputation-60.6.css"), "hotfix 60.6 deve estar carregado após a autoridade 59.10");

console.log("foundry-update-manifest: OK");

assert.equal(manifest.relationships?.requires?.[0]?.id, "socketlib");
assert.equal(manifest.relationships?.requires?.[0]?.type, "module");
