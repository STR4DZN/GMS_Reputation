import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { assembleStyles, buildStyles } from "../tools/build-styles.mjs";

// The same check runs in both packaging workflows through tests/run-all.sh.
await buildStyles({ check: true });

const root = await mkdtemp(path.join(os.tmpdir(), "gms-style-build-"));
try {
  const sources = path.join(root, "src/styles");
  const target = path.join(root, "styles/gms-reputation-59.10.css");
  await mkdir(sources, { recursive: true });
  await mkdir(path.dirname(target));
  await writeFile(path.join(sources, "order.json"), JSON.stringify(["base.css", "override.css"]));
  await writeFile(path.join(sources, "base.css"), ".card { color: red !important; }\r\n");
  await writeFile(path.join(sources, "override.css"), ".card { color: blue !important; }\n/* posição */\n");
  await assert.rejects(buildStyles({ root, check: true }), /out of date/);
  const original = (await assembleStyles({ root })).content;
  assert.equal((await buildStyles({ root })).changed, true);
  assert.deepEqual(await readFile(target), original, "Preserve UTF-8, line endings, declaration order and !important");
  assert.equal((await buildStyles({ root, check: true })).changed, false);

  // A source-only change cannot silently ship the old generated bundle.
  await writeFile(path.join(sources, "override.css"), ".card { color: green; }\n");
  await assert.rejects(buildStyles({ root, check: true }), /out of date/);
  assert.deepEqual(await readFile(target), original, "Check mode must never rewrite the bundle");
  await buildStyles({ root });
  assert.match((await readFile(target)).toString(), /color: green/);

  await writeFile(path.join(sources, "order.json"), JSON.stringify(["override.css", "base.css"]));
  await buildStyles({ root });
  assert.match((await readFile(target)).toString(), /^\.card \{ color: green/);
  for (const invalid of [["base.css", "base.css"], ["../outside.css"], [null], []]) {
    await writeFile(path.join(sources, "order.json"), JSON.stringify(invalid));
    await assert.rejects(assembleStyles({ root }), /Invalid stylesheet order/);
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log("styles-build: OK | cascade order, exact bytes, stale bundle rejection and read-only CI checks");
