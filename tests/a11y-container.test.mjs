import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("Gate 15: Container queries defined in styles", () => {
  const shellCss = fs.readFileSync(path.join(projectRoot, "styles", "shell.css"), "utf-8");
  assert.ok(
    shellCss.includes("container-type: inline-size;"),
    "shell.css must declare container-type: inline-size"
  );
  assert.ok(
    shellCss.includes("container-name: gms-shell;"),
    "shell.css must declare container-name: gms-shell"
  );

  const masterCss = fs.readFileSync(path.join(projectRoot, "styles", "master", "master.css"), "utf-8");
  const masterContainerMatches = masterCss.match(/@container\s*\([^)]+\)/g) || [];
  assert.ok(
    masterContainerMatches.length >= 4,
    `master.css must have at least 4 @container queries, found ${masterContainerMatches.length}`
  );

  const playerCss = fs.readFileSync(path.join(projectRoot, "styles", "player", "player.css"), "utf-8");
  const playerContainerMatches = playerCss.match(/@container\s*\([^)]+\)/g) || [];
  assert.ok(
    playerContainerMatches.length >= 2,
    `player.css must have at least 2 @container queries, found ${playerContainerMatches.length}`
  );
});

test("Gate 15: Focus indicators and reduced motion in reset.css", () => {
  const resetCss = fs.readFileSync(path.join(projectRoot, "styles", "reset.css"), "utf-8");
  assert.ok(
    resetCss.includes(":focus-visible"),
    "reset.css must define :focus-visible rules"
  );
  assert.ok(
    resetCss.includes("outline: 2px solid"),
    "reset.css must define visible outline for focus-visible"
  );
  assert.ok(
    resetCss.includes("@media (prefers-reduced-motion: reduce)"),
    "reset.css must support prefers-reduced-motion"
  );
});

test("Gate 15: ARIA semantics in templates", () => {
  // Player card
  const cardHbs = fs.readFileSync(path.join(projectRoot, "templates", "player", "card.hbs"), "utf-8");
  assert.ok(cardHbs.includes('tabindex="0"'), "Card must have tabindex='0' for keyboard navigation");
  assert.ok(cardHbs.includes('role="button"'), "Card must have role='button'");
  assert.ok(cardHbs.includes("aria-label="), "Card must have aria-label");

  // Master shell tabs
  const shellHbs = fs.readFileSync(path.join(projectRoot, "templates", "master", "shell.hbs"), "utf-8");
  assert.ok(shellHbs.includes('role="tablist"'), "Master shell nav must have role='tablist'");
  assert.ok(shellHbs.includes('role="tab"'), "Master navigation buttons must have role='tab'");
  assert.ok(shellHbs.includes("aria-selected="), "Master tabs must have aria-selected");

  // Smart selector
  const selectorHbs = fs.readFileSync(path.join(projectRoot, "templates", "components", "smart-selector.hbs"), "utf-8");
  assert.ok(selectorHbs.includes('role="listbox"'), "Smart selector options container must have role='listbox'");
  assert.ok(selectorHbs.includes('role="option"'), "Smart selector items must have role='option'");
  assert.ok(selectorHbs.includes('aria-haspopup="listbox"'), "Smart selector trigger must have aria-haspopup='listbox'");

  // Heart track
  const trackHbs = fs.readFileSync(path.join(projectRoot, "templates", "components", "reputation-track.hbs"), "utf-8");
  assert.ok(trackHbs.includes('role="img"'), "Heart track must have role='img'");
  assert.ok(trackHbs.includes("aria-label="), "Heart track must have aria-label");
});
