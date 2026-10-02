import assert from "node:assert/strict";
import { playerNavigationPosition, mountPlayerProfileNavigation } from "../scripts/apps/player-profile-navigation.js";

// The companion may change its own width, but must never overlap the dossier
// or modify its dimensions, even after movement or resizing.
for (const rect of [
  { left: 250, top: 40, width: 747, height: 600 },
  { left: 500, top: 80, width: 940, height: 780 },
  { left: 170, top: 20, width: 600, height: 450 },
  { left: 0, top: 0, width: 940, height: 780 }
]) {
  const original = { ...rect };
  for (const open of [true, false]) {
    const position = playerNavigationPosition(rect, open);
    assert.equal(position.left + position.width, rect.left);
    assert.equal(position.top, rect.top);
    assert.equal(position.height, rect.height);
    assert.deepEqual(rect, original);
  }
}
assert.equal(playerNavigationPosition({ left: 250, top: 40, height: 600 }, false).width, 32);
assert.equal(mountPlayerProfileNavigation({}, null), null);
console.log("player-profile-navigation: OK | external bounds + unchanged dossier");
