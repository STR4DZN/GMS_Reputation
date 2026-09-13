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
const socketListeners = new Map();
const socketEmits = [];
let controlsRenderCount = 0;

globalThis.game = {
  user: gm,
  users: userMap,
  version: '13.351',
  release: { version: '13.351' },
  modules: { get: (id) => id === 'gms-reputation' ? moduleRecord : null },
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
assert.equal((onHandlers.get('getSceneControlButtons') ?? []).length, 1, 'launcher de Scene Controls deve registrar um hook');
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

// Cross-check do SceneControl: instala no host token e respeita a permissão do usuário atual.
const sceneHook = (onHandlers.get('getSceneControlButtons') ?? [])[0];
const gmControls = { tokens: { visible: true, tools: { select: { order: 1 } } } };
sceneHook(gmControls);
assert.ok(gmControls.tokens.tools.gmsReputationPlayer, 'GM deve receber botão Player');
assert.ok(gmControls.tokens.tools.gmsReputationMaster, 'GM deve receber botão Mestre');
assert.equal(gmControls.tokens.tools.gmsReputationPlayer.button, true);
assert.equal(typeof gmControls.tokens.tools.gmsReputationPlayer.onChange, 'function');
assert.ok(gmControls.tokens.tools.gmsReputationMaster.order > gmControls.tokens.tools.gmsReputationPlayer.order);

game.user = player;
const playerControls = { tokens: { visible: true, tools: {} } };
sceneHook(playerControls);
assert.ok(playerControls.tokens.tools.gmsReputationPlayer, 'Player deve receber o botão da Matriz');
assert.equal(playerControls.tokens.tools.gmsReputationMaster, undefined, 'Player não deve receber botão Mestre');

const permissionRefresh = (onHandlers.get('gmsReputationPermissionsChanged') ?? [])[0];
permissionRefresh();
assert.equal(controlsRenderCount, 1, 'mudança de permissões deve redesenhar Scene Controls');

game.user = gm;

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

console.log('OK runtime-integration | lifecycle + SceneControls + FilePicker + accessibility + audit + window recovery');
