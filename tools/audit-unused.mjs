import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function findFiles(dir, ext = ".js") {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

export function auditProject() {
  console.log("Iniciando auditoria de arquivos, dead code e integridade...");
  const errors = [];
  const warnings = [];

  // 1. Validar module.json
  const manifestPath = path.join(projectRoot, "module.json");
  if (!fs.existsSync(manifestPath)) {
    errors.push("Manifesto module.json não encontrado na raiz!");
  } else {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (manifest.id !== "gms-reputation") {
        errors.push(`Manifesto id incorreto: ${manifest.id} (esperado: gms-reputation)`);
      }
      if (!manifest.esmodules?.includes("scripts/main.js")) {
        errors.push("Manifesto deve registrar 'scripts/main.js' em esmodules.");
      }
      if (!manifest.styles?.includes("styles/gms-reputation.css")) {
        errors.push("Manifesto deve registrar 'styles/gms-reputation.css' em styles.");
      }

      // Validar existência dos arquivos do manifesto
      for (const es of manifest.esmodules || []) {
        if (!fs.existsSync(path.join(projectRoot, es))) {
          errors.push(`Arquivo referenciado em esmodules não encontrado: ${es}`);
        }
      }
      for (const st of manifest.styles || []) {
        if (!fs.existsSync(path.join(projectRoot, st))) {
          errors.push(`Arquivo referenciado em styles não encontrado: ${st}`);
        }
      }
    } catch (e) {
      errors.push(`Erro de sintaxe JSON em module.json: ${e.message}`);
    }
  }

  // 2. Dead CSS files check
  const stylesDir = path.join(projectRoot, "styles");
  if (fs.existsSync(stylesDir)) {
    const styleEntries = fs.readdirSync(stylesDir);
    for (const name of styleEntries) {
      if (/gms-reputation-60\.\d+\.css/.test(name) || /gms-reputation-59\.\d+\.css/.test(name)) {
        errors.push(`Folha CSS morta/legada encontrada em styles/: ${name}`);
      }
    }
  }

  // 3. Checar todas as referências de templates em scripts/*.js
  const scriptFiles = findFiles(path.join(projectRoot, "scripts"), ".js");
  const templateRegex = /modules\/gms-reputation\/(templates\/[a-zA-Z0-9_\-\/]+\.hbs)/g;
  const hbsTemplateRegex = /modules\/gms-reputation\/(templates\/[a-zA-Z0-9_\-\/]+\.hbs)/g;

  for (const file of scriptFiles) {
    const content = fs.readFileSync(file, "utf-8");
    let match;
    while ((match = templateRegex.exec(content)) !== null) {
      const tplPath = path.join(projectRoot, match[1]);
      if (!fs.existsSync(tplPath)) {
        errors.push(`Template referenciado em ${path.relative(projectRoot, file)} não existe: ${match[1]}`);
      }
    }
  }

  // Checar parciais em templates/*.hbs
  const templateFiles = findFiles(path.join(projectRoot, "templates"), ".hbs");
  for (const file of templateFiles) {
    const content = fs.readFileSync(file, "utf-8");
    let match;
    while ((match = hbsTemplateRegex.exec(content)) !== null) {
      const tplPath = path.join(projectRoot, match[1]);
      if (!fs.existsSync(tplPath)) {
        errors.push(`Template parcial em ${path.relative(projectRoot, file)} não existe: ${match[1]}`);
      }
    }
  }

  // 4. Validar imports em todos os scripts
  const importRegex = /(?:import\s+.*?from\s+['"](.*?)['"]|import\s*\(\s*['"](.*?)['"]\s*\))/g;
  for (const file of scriptFiles) {
    const content = fs.readFileSync(file, "utf-8");
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1] || match[2];
      if (importPath && (importPath.startsWith("./") || importPath.startsWith("../"))) {
        const resolved = path.resolve(path.dirname(file), importPath);
        if (!fs.existsSync(resolved)) {
          errors.push(`Import quebrado em ${path.relative(projectRoot, file)}: ${importPath} -> ${path.relative(projectRoot, resolved)}`);
        }
      }
    }
  }

  console.log(`Scripts auditados: ${scriptFiles.length}`);
  console.log(`Templates auditados: ${templateFiles.length}`);
  if (warnings.length) {
    console.warn(`Avisos (${warnings.length}):`, warnings);
  }

  if (errors.length) {
    console.error(`Falhas encontradas na auditoria (${errors.length}):`);
    for (const err of errors) {
      console.error(` - ✖ ${err}`);
    }
    throw new Error(`Auditoria falhou com ${errors.length} erros.`);
  }

  console.log("✔ Auditoria concluída com 100% de sucesso. Nenhum import quebrado ou arquivo morto encontrado.");
  return { ok: true, scriptsCount: scriptFiles.length, templatesCount: templateFiles.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    auditProject();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
