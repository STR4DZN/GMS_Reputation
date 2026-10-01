/** Development-only preview; loopback server, no Foundry runtime dependency. */
import http from "node:http";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import Handlebars from "handlebars";
const root = path.resolve(import.meta.dirname, "..");
for (const name of await readdir(path.join(root, "templates/partials"))) {
  if (name.endsWith(".hbs")) Handlebars.registerPartial(`modules/gms-reputation/templates/partials/${name}`, await readFile(path.join(root, "templates/partials", name), "utf8"));
}
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "POST" && url.pathname === "/render") {
      let body = ""; for await (const chunk of req) { body += chunk; if (body.length > 2_000_000) throw new Error("Context too large"); }
      const { template, context } = JSON.parse(body);
      const relative = String(template).replace(/^modules\/gms-reputation\//, "");
      const file = path.resolve(root, relative);
      if (!file.startsWith(path.join(root, "templates") + path.sep) || !file.endsWith(".hbs")) throw new Error("Invalid template");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(Handlebars.compile(await readFile(file, "utf8"))(context)); return;
    }
    const relative = url.pathname === "/" ? "visualizer/live.html" : decodeURIComponent(url.pathname).replace(/^\/modules\/gms-reputation\//, "").replace(/^\//, "");
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) throw new Error("Invalid path");
    res.setHeader("Content-Type", `${types[path.extname(file)] ?? "application/octet-stream"}; charset=utf-8`);
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end("Not found"); }
});
server.listen(Number(process.env.PORT || 8766), "127.0.0.1", () => console.log("Preview: http://127.0.0.1:8766 (Foundry simulation)"));
