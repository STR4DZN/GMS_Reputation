import assert from "node:assert/strict";
import { getPortraitFitMode, resetPortraitFrame } from "../scripts/core/portrait.js";
import { buildPortraitFrameModel, renderPortraitFrameHTML } from "../scripts/components/portrait-frame.js";
import { buildPortraitEditorContext } from "../scripts/components/portrait-editor.js";

for (const src of ["portraits/tall.png", "portraits/wide.gif", "https://example.test/npc.gif"]) {
  const portrait = { src, zoom: 100, x: 50, y: 50 };
  assert.equal(getPortraitFitMode(portrait), "contain", "default framing must show the entire source");
  for (const kind of ["subject", "focal"]) {
    const model = buildPortraitFrameModel(portrait, { kind });
    assert.equal(model.fit, "contain");
    assert.equal(buildPortraitEditorContext(portrait, { kind }).fit, model.fit);
    assert.ok(renderPortraitFrameHTML(model).includes(`src="${src}"`), "keep the original animated source");
  }
  const zoomed = { ...portrait, zoom: 160, x: 20, y: 30 };
  assert.equal(getPortraitFitMode(zoomed), "cover", "manual zoom may intentionally crop");
  assert.equal(getPortraitFitMode(resetPortraitFrame(zoomed)), "contain", "reset restores the complete image");
  assert.equal(resetPortraitFrame(zoomed).src, src);
}

console.log("portrait-fit: OK — complete default images/GIFs, consistent editor, manual zoom and reset");
