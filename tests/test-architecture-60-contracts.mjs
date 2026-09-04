import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ARCHITECTURE_GENERATION,
  FROZEN_DATA_SCHEMA_VERSION,
  FROZEN_HOOKS,
  FROZEN_SETTINGS,
  FROZEN_SOCKET_CHANNEL,
  LEGACY_PUBLIC_API_NAMESPACES,
  assertArchitectureContracts
} from "../scripts/architecture/contracts.js";
import { DATA_SCHEMA_VERSION, MODULE_ID, SETTINGS } from "../scripts/constants.js";

const manifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));
const main = await readFile(new URL("../scripts/main.js", import.meta.url), "utf8");
const facade = await readFile(new URL("../scripts/compatibility/public-api.js", import.meta.url), "utf8");

assert.equal(ARCHITECTURE_GENERATION, "60");
assert.equal(MODULE_ID, "gms-reputation");
assert.equal(manifest.id, MODULE_ID);
assert.equal(DATA_SCHEMA_VERSION, FROZEN_DATA_SCHEMA_VERSION);
assert.equal(DATA_SCHEMA_VERSION, 5);
assert.deepEqual(SETTINGS, FROZEN_SETTINGS);
assert.equal(FROZEN_SOCKET_CHANNEL, "module.gms-reputation");
assert.equal(FROZEN_HOOKS.WORLD_STATE_CHANGED, "gmsReputationWorldStateChanged");
assert.equal(FROZEN_HOOKS.PERMISSIONS_CHANGED, "gmsReputationPermissionsChanged");
assert.equal(assertArchitectureContracts(), true);

assert.match(main, /createLegacyPublicApi/);
assert.doesNotMatch(main, /import \* as Score|import \* as PlayerCard|import \* as PortraitEditor/,
  "main.js não deve voltar a conhecer detalhes de todas as features");
assert.equal(new Set(LEGACY_PUBLIC_API_NAMESPACES).size, LEGACY_PUBLIC_API_NAMESPACES.length);
for (const namespace of LEGACY_PUBLIC_API_NAMESPACES) {
  assert.match(facade, new RegExp(`\\b${namespace}:`), `facade deve preservar namespace ${namespace}`);
}
console.log(`architecture-60-contracts: OK | api=${LEGACY_PUBLIC_API_NAMESPACES.length} | schema=${DATA_SCHEMA_VERSION}`);
