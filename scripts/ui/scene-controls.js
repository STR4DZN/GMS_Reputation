// Preserve the legacy API entry points while the launcher lives in HoloSuite.
// Reputation no longer adds tools to Foundry's token or scene controls.
import { registerHoloSuiteLauncher, resetHoloSuiteLauncherForTests } from "./holosuite-launcher.js";

export function registerSceneControlLauncher() {
  return registerHoloSuiteLauncher();
}

export function resetSceneControlLauncherForTests() {
  resetHoloSuiteLauncherForTests();
}
