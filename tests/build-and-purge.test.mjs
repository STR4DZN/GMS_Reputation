import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCss } from "../tools/build-css.mjs";
import { auditProject } from "../tools/audit-unused.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("Gate 17: CSS build pipeline and size budget (< 160 KB)", () => {
  const result = buildCss();
  assert.ok(result.outputBytes > 0, "Output CSS must not be empty");
  assert.ok(result.outputBytes < 160 * 1024, `CSS size (${result.sizeKb} KB) must be under 160 KB budget`);
  assert.equal(result.filesCount, 13, "Must combine exactly 13 modular CSS files");

  const css = fs.readFileSync(path.join(projectRoot, "styles", "gms-reputation.css"), "utf-8");
  assert.ok(css.includes("--gms-bg-void"), "Must contain token definitions");
  assert.ok(css.includes(".gms-player-dashboard"), "Must contain player styles");
  assert.ok(css.includes(".gms-master-shell"), "Must contain master styles");
  assert.ok(css.includes(".gms-reputation-heart-track"), "Must contain heart-track styles");
});

test("Gate 17: Dead code purge and import integrity audit", () => {
  const audit = auditProject();
  assert.equal(audit.ok, true);
  assert.ok(audit.scriptsCount >= 50);
  assert.ok(audit.templatesCount >= 15);
});
