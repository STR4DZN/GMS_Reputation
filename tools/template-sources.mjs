import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Expand only context-preserving Master includes for source contracts and baseline comparison. */
export async function expandMasterTemplate({ root = PROJECT_ROOT } = {}) {
  const main = await readFile(path.join(root, "templates/apps/master-panel.hbs"), "utf8");
  const pattern = /^\{\{> "modules\/gms-reputation\/templates\/partials\/(master-[a-z-]+\.hbs)"\}\}\n/gm;
  const replacements = await Promise.all([...main.matchAll(pattern)].map(async match => ({
    start: match.index, length: match[0].length,
    content: await readFile(path.join(root, "templates/partials", match[1]), "utf8")
  })));
  let source = main;
  for (const entry of replacements.reverse()) source = source.slice(0, entry.start) + entry.content + source.slice(entry.start + entry.length);
  return source;
}
