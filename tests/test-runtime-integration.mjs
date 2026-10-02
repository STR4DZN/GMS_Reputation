import assert from 'node:assert/strict';

const onceHandlers = new Map();
const onHandlers = new Map();
const emittedHooks = [];

globalThis.Hooks = {
  once(name, fn) { onceHandlers.set(name, fn); },
  on(name, fn) {
    const list = onHandlers.get(name) ?? [];
    list.push(fn);
    onHandlers.set(name, list);
  },
  callAll(name, ...args) { emittedHooks.push([name, ...args]); }
};

globalThis.CONST = {
  USER_ROLES: { NONE: 0, PLAYER: 1, TRUSTED: 2, ASSISTANT: 3, GAMEMASTER: 4 },
  JOURNAL_ENTRY_PAGE_FORMATS: { HTML: 1 }
};

const gm = { id: 'gm-a', role: 4, isGM: true, active: true, name: 'GM A' };
const player = { id: 'player-a', role: 1, isGM: false, active: true, name: 'Player A' };
const userMap = new Map([[gm.id, gm], [player.id, player]]);
Object.defineProperty(userMap, 'contents', { get: () => [...userMap.values()] });

const registeredSettings = new Map();
const settingValues = new Map();
const settingKey = (moduleId, key) => `${moduleId}.${key}`;
const moduleRecord = {};
const holoRecord = { active: true };
const holoApps = new Map();
let holoRegistrationCount = 0;
const socketListeners = new Map();
const socketEmits = [];
let controlsRenderCount = 0;

globalThis.game = {
  user: gm,
  users: userMap,
  version: '13.351',
  release: { version: '13.351' },
  modules: { get: (id) => id === 'gms-reputation' ? moduleRecord : id === 'holosuite-core' ? holoRecord : null },
  settings: {
    register(moduleId, key, config) {
      const sk = settingKey(moduleId, key);
      registeredSettings.set(sk, config);
      if (!settingValues.has(sk)) settingValues.set(sk, structuredClone(config.default));
    },
    get(moduleId, key) { return settingValues.get(settingKey(moduleId, key)); },
    async set(moduleId, key, value) {
      const sk = settingKey(moduleId, key);
      settingValues.set(sk, structuredClone(value));
      const config = registeredSettings.get(sk);
      config?.onChange?.(structuredClone(value), { source: 'runtime-integration-test' });
      return value;
    }
  },
  socket: {
    on(channel, fn) { socketListeners.set(channel, fn); },
    off(channel, fn) { if (socketListeners.get(channel) === fn) socketListeners.delete(channel); },
    emit(channel, payload) { socketEmits.push([channel, payload]); }
  }
};

globalThis.foundry = {
  utils: {
    deepClone: (value) => structuredClone(value),
    randomID: () => `rid-${Math.random().toString(36).slice(2)}`
  }
};

globalThis.ui = {
  controls: { render() { controlsRenderCount += 1; } },
  notifications: { info() {}, warning() {}, error() {} }
};

globalThis.fromUuid = async () => null;
globalThis.requestAnimationFrame = (fn) => { fn(); return 1; };
globalThis.cancelAnimationFrame = () => {};

await import('../scripts/main.js');
const { MODULE_ID, MODULE_VERSION, DATA_SCHEMA_VERSION, SETTINGS } = await import('../scripts/constants.js');
const AuthorityBroker = await import('../scripts/persistence/authority-broker.js');

assert.equal(typeof onceHandlers.get('init'), 'function', 'main.js deve registrar Hooks.once(init)');
assert.equal(typeof onceHandlers.get('ready'), 'function', 'main.js deve registrar Hooks.once(ready)');

await onceHandlers.get('init')();
assert.equal(registeredSettings.size, 5, 'runtime deve registrar exatamente os 5 settings canônicos');
for (const key of Object.values(SETTINGS)) {
  assert.ok(registeredSettings.has(settingKey(MODULE_ID, key)), `setting ausente: ${key}`);
}
assert.equal((onHandlers.get('getSceneControlButtons') ?? []).length, 0, 'Reputação não deve adicionar atalhos aos controles de token');
assert.equal((onHandlers.get('holosuite-core.apiReady') ?? []).length, 1, 'launcher deve escutar a API oficial do HoloSuite');
holoRecord.api = { registerApp(app) { holoRegistrationCount += 1; holoApps.set(app.id, app); return app; } };
for (const fn of onHandlers.get('holosuite-core.apiReady')) fn(holoRecord.api);
assert.equal((onHandlers.get('gmsReputationPermissionsChanged') ?? []).length, 1, 'refresh de permissões deve registrar um hook');

await onceHandlers.get('ready')();
assert.ok(moduleRecord.api, 'ready deve expor module.api');
assert.equal(moduleRecord.api.version, MODULE_VERSION);
assert.equal(moduleRecord.api.schemaVersion, DATA_SCHEMA_VERSION);
const { LEGACY_PUBLIC_API_NAMESPACES } = await import('../scripts/architecture/contracts.js');
for (const namespace of LEGACY_PUBLIC_API_NAMESPACES) {
  assert.ok(moduleRecord.api[namespace], `namespace ausente em module.api: ${namespace}`);
}
assert.deepEqual(
  Object.keys(moduleRecord.api).filter((key) => !['version', 'schemaVersion'].includes(key)).sort(),
  [...LEGACY_PUBLIC_API_NAMESPACES].sort(),
  'facade da Architecture 60 deve preservar exatamente os namespaces públicos da 59.10'
);
assert.ok(socketListeners.has(`module.${MODULE_ID}`), 'Authority Broker deve escutar o socket do módulo');
const initializedState = moduleRecord.api.store.loadWorldState();
assert.equal(initializedState.schemaVersion, DATA_SCHEMA_VERSION);
assert.equal(initializedState.revision, 0);
assert.ok(initializedState.metadata?.createdAt > 0, 'bootstrap deve criar metadata temporal');

// Separate Player and GM apps; recheck editing access when the user clicks.
assert.equal(holoApps.size, 2);
const tile = holoApps.get(MODULE_ID);
const masterTile = holoApps.get(`${MODULE_ID}-gm`);
assert.equal(tile.title, 'Reputação');
assert.equal(tile.icon, 'fa-solid fa-heart');
assert.equal(tile.playerVisible, true);
assert.equal(tile.premium, false);
assert.equal(tile.featureId, MODULE_ID);
assert.equal(tile.open().constructor.name, 'ReputationPlayerDashboardApplication', 'o coração abre a visão Player também para o GM');
assert.equal(masterTile.title, 'Gerenciar Reputação');
assert.equal(masterTile.icon, 'fa-solid fa-shield-halved');
assert.equal(masterTile.playerVisible, false, 'HoloSuite deve ocultar o escudo dos Players');
assert.equal(masterTile.premium, false);
assert.equal(masterTile.featureId, MODULE_ID);
assert.equal(masterTile.open().constructor.name, 'ReputationMasterPanelApplication');

game.user = player;
assert.equal(tile.open().constructor.name, 'ReputationPlayerDashboardApplication');
assert.equal(masterTile.open(), null, 'Player não pode abrir a edição nem chamando o callback diretamente');
game.user = { ...player, role: 2 };
const permissionKey = settingKey(MODULE_ID, SETTINGS.PERMISSIONS);
const previousPermissions = settingValues.get(permissionKey);
settingValues.set(permissionKey, { ...previousPermissions, trusted: { openMaster: true } });
assert.equal(masterTile.open(), null, 'permissões delegadas não tornam o app de GM acessível a Players');
assert.equal(tile.open().constructor.name, 'ReputationPlayerDashboardApplication');
game.user = { ...gm, role: 3 };
assert.equal(masterTile.open().constructor.name, 'ReputationMasterPanelApplication', 'GM assistente autorizado pode editar');
settingValues.set(permissionKey, { ...previousPermissions, assistant: { openMaster: false } });
assert.equal(masterTile.open(), null, 'conta GM também precisa de permissão para editar');
settingValues.set(permissionKey, previousPermissions);
game.user = null;
assert.equal(tile.open(), null, 'sem usuário não há acesso');
assert.equal(masterTile.open(), null);
game.user = gm;
for (const fn of onHandlers.get('holosuite-core.apiReady')) fn(holoRecord.api);
assert.equal(holoApps.size, 2, 'init/ready repetidos não duplicam os apps');
const countBeforeRefresh = holoRegistrationCount;
(onHandlers.get('gmsReputationPermissionsChanged') ?? [])[0]();
assert.equal(controlsRenderCount, 0, 'permissões não recriam atalhos de token');
assert.equal(holoRegistrationCount, countBeforeRefresh + 2, 'permissões atualizam os dois apps registrados');
(onHandlers.get('hotReload') ?? [])[0]({ packageId: 'another-module' });
assert.equal(holoRegistrationCount, countBeforeRefresh + 2);
(onHandlers.get('hotReload') ?? [])[0]({ packageId: MODULE_ID });
assert.equal(holoRegistrationCount, countBeforeRefresh + 4);
const { registerReputationApp } = await import('../scripts/ui/holosuite-launcher.js');
holoRecord.active = false;
assert.equal(registerReputationApp(), false, 'Core inativo não deve registrar');
holoRecord.active = true;
const host = holoRecord.api;
delete holoRecord.api;
assert.equal(registerReputationApp(), false, 'sem Core, o runtime permanece funcional');
game.holosuite = host;
assert.equal(registerReputationApp(), true, 'suporta o fallback oficial game.holosuite');
delete game.holosuite;
holoRecord.api = host;

// API de auditoria deve reconhecer o estado bootstrap como íntegro no Foundry v13 alvo.
const audit = moduleRecord.api.systemAudit.runSystemAudit({ state: initializedState, foundryVersion: '13.351' });
assert.equal(audit.ok, true, JSON.stringify(audit.findings ?? audit, null, 2));
assert.equal(audit.data.moduleVersion, MODULE_VERSION);
assert.equal(audit.runtime.findings.length, 0);

// FilePicker resolve dinamicamente a implementação v13 e valida o retorno antes de persistir.
let selected = null;
let pickerRenderCalls = 0;
let broughtToFront = 0;
class FakeFilePicker {
  constructor(options) { this.options = options; }
  render(options) { pickerRenderCalls += 1; assert.deepEqual(options, { force: true }); return this; }
  bringToFront() { broughtToFront += 1; }
}
globalThis.foundry.applications = { apps: { FilePicker: FakeFilePicker } };
const picker = await moduleRecord.api.filePicker.openPortraitFilePicker({
  current: 'portraits/current.webp',
  onSelect: (value) => { selected = value; }
});
assert.equal(picker.options.type, 'image');
assert.equal(picker.options.current, 'portraits/current.webp');
assert.equal(picker.options.callback('portraits/new.webp'), true);
assert.equal(selected, 'portraits/new.webp');
assert.equal(picker.options.callback('javascript:alert(1)'), false, 'fonte perigosa deve ser rejeitada');
assert.equal(pickerRenderCalls, 1);
assert.ok(broughtToFront >= 1);

// Fallback de assinatura render(true) deve continuar funcional para implementações compatíveis antigas.
let fallbackRendered = false;
class FallbackPicker {
  constructor(options) { this.options = options; }
  render(arg) {
    if (typeof arg === 'object') throw new Error('old signature');
    fallbackRendered = arg === true;
    return this;
  }
}
globalThis.foundry.applications.apps.FilePicker = FallbackPicker;
await moduleRecord.api.filePicker.openPortraitFilePicker({ current: 'https://example.test/a.webp' });
assert.equal(fallbackRendered, true);

// Acessibilidade: navegação de tabs, Home/End e Escape fora de dialogs.
const { wireApplicationAccessibility } = await import('../scripts/utils/accessibility.js');
function fakeNode() {
  const listeners = new Map();
  return {
    listeners,
    focused: 0,
    clicked: 0,
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
    focus() { this.focused += 1; },
    click() { this.clicked += 1; }
  };
}
const tabs = [fakeNode(), fakeNode(), fakeNode()];
const root = fakeNode();
root.querySelectorAll = () => tabs;
let escaped = 0;
globalThis.document = { activeElement: { closest: () => null } };
const a11y = wireApplicationAccessibility(root, { onEscape: () => { escaped += 1; } });
const keyEvent = (key) => ({ key, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });
tabs[0].listeners.get('keydown')(keyEvent('ArrowRight'));
assert.equal(tabs[1].focused, 1);
assert.equal(tabs[1].clicked, 1);
tabs[1].listeners.get('keydown')(keyEvent('End'));
assert.equal(tabs[2].focused, 1);
tabs[2].listeners.get('keydown')(keyEvent('Home'));
assert.equal(tabs[0].focused, 1);
root.listeners.get('keydown')(keyEvent('Escape'));
assert.equal(escaped, 1);
a11y.destroy();
assert.equal(root.listeners.size, 0);
assert.ok(tabs.every((tab) => tab.listeners.size === 0), 'destroy deve remover todos listeners de acessibilidade');

// Contrato de recuperação de janela, incluindo fallback inline quando setPosition falha.
const { ensureApplicationOnScreen } = await import('../scripts/apps/application-compat.js');
const element = {
  dataset: {}, style: {}, ownerDocument: { documentElement: { clientWidth: 1280, clientHeight: 720 } },
  getBoundingClientRect: () => ({ left: 1400, top: -200, width: 900, height: 900, right: 2300, bottom: 700 }),
  querySelector() {}
};
const app = { element, setPosition() { throw new Error('legacy adapter'); } };
assert.equal(ensureApplicationOnScreen(app, { viewport: { width: 1280, height: 720 } }), true);
assert.equal(element.dataset.gmsWindowRecovered, 'fallback');
assert.ok(parseInt(element.style.left, 10) >= 0);
assert.ok(parseInt(element.style.top, 10) >= 0);
assert.ok(parseInt(element.style.width, 10) <= 1280);
assert.ok(parseInt(element.style.height, 10) <= 720);

AuthorityBroker.shutdownAuthorityBroker();
assert.equal(socketListeners.size, 0, 'shutdown deve soltar listener do socket');

console.log('OK runtime-integration | lifecycle + separate HoloSuite Player/GM apps + guarded editing + no token controls + FilePicker + accessibility + audit + window recovery');
