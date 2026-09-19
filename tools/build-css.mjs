import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const CSS_FILES = [
  "styles/tokens.css",
  "styles/reset.css",
  "styles/typography.css",
  "styles/shell.css",
  "styles/components/reputation-track.css",
  "styles/components/smart-selector.css",
  "styles/components/portrait.css",
  "styles/components/identity.css",
  "styles/components/special-protocol.css",
  "styles/components/toast.css",
  "styles/components/modal.css",
  "styles/player/player.css",
  "styles/master/master.css"
];

const MAX_SIZE_BYTES = 160 * 1024; // 160 KB budget

export function buildCss() {
  console.log("Compilando CSS do GMS Reputation...");
  const chunks = [];
  chunks.push("/**\n * GMS // MATRIZ DE REPUTAÇÃO\n * Arquitetura de Refatoração Visual e Runtime\n * Bundle CSS Unificado e Otimizado\n */\n");

  let totalRawBytes = 0;
  for (const relPath of CSS_FILES) {
    const fullPath = path.join(projectRoot, relPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Arquivo CSS obrigatório não encontrado: ${relPath}`);
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    totalRawBytes += Buffer.byteLength(content, "utf-8");
    chunks.push(`/* --- Begin: ${relPath} --- */\n` + content + `\n/* --- End: ${relPath} --- */\n`);
  }

  const combined = chunks.join("\n");

  // Audit !important
  const lines = combined.split("\n");
  let importantCount = 0;
  let allowedImportantCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("!important")) {
      importantCount++;
      // Allowed in prefers-reduced-motion and responsive drawer overrides
      if (line.includes("animation-") || line.includes("transition-") || line.includes("scroll-behavior") || line.includes("width: 100%")) {
        allowedImportantCount++;
      } else {
        console.warn(`[CSS Audit Warning] !important inesperado na linha ${i + 1}: ${line.trim()}`);
      }
    }
  }

  const outputPath = path.join(projectRoot, "styles", "gms-reputation.css");
  fs.writeFileSync(outputPath, combined, "utf-8");

  const outputBytes = Buffer.byteLength(combined, "utf-8");
  const sizeKb = (outputBytes / 1024).toFixed(2);

  console.log(`CSS compilado com sucesso em: styles/gms-reputation.css`);
  console.log(`Arquivos concatenados: ${CSS_FILES.length}`);
  console.log(`Tamanho final: ${sizeKb} KB (Orçamento máximo: 160 KB)`);
  console.log(`!important encontrados: ${importantCount} (${allowedImportantCount} permitidos por acessibilidade/responsividade)`);

  if (outputBytes > MAX_SIZE_BYTES) {
    throw new Error(`Orçamento de CSS estourado! Tamanho: ${sizeKb} KB > 160 KB.`);
  }

  return { outputPath, outputBytes, sizeKb, filesCount: CSS_FILES.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    buildCss();
  } catch (err) {
    console.error("Erro na compilação do CSS:", err.message);
    process.exit(1);
  }
}
