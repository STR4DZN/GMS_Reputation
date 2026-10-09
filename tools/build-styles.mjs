import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUTPUT = "styles/gms-reputation-59.10.css";

/** Preserve the cascade exactly: no minification, rewriting, imports or separators. */
export async function assembleStyles({ root = PROJECT_ROOT } = {}) {
  const directory = path.join(root, "src/styles");
  const sources = JSON.parse(await readFile(path.join(directory, "order.json"), "utf8"));
  if (!Array.isArray(sources) || !sources.length
      || sources.some(name => typeof name !== "string" || !/^[a-z0-9-]+\.css$/.test(name))
      || new Set(sources).size !== sources.length) {
    throw new Error("Invalid stylesheet order: use unique CSS filenames in src/styles/order.json.");
  }
  const parts = await Promise.all(sources.map(name => readFile(path.join(directory, name))));
  return { content: Buffer.concat(parts), sources };
}

/** --check never writes: CI rejects a bundle that differs from its editable sources. */
export async function buildStyles({ root = PROJECT_ROOT, check = false } = {}) {
  const { content, sources } = await assembleStyles({ root });
  const target = path.join(root, OUTPUT);
  const previous = await readFile(target).catch(error => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  const changed = !previous?.equals(content);
  if (check && changed) throw new Error(`${OUTPUT} is out of date. Run npm run styles:build and commit the generated CSS.`);
  if (!check && changed) await writeFile(target, content);
  return { changed, sources: sources.length, bytes: content.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) throw new Error("Usage: node tools/build-styles.mjs [--check]");
    const result = await buildStyles({ check: args[0] === "--check" });
    console.log(`styles: OK | ${result.sources} sources | ${result.bytes} bytes | ${result.changed ? "generated" : "unchanged"}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
