// Uses real application controllers/templates with isolated, local preview storage.
const storage = new Map(); const configs = new Map();
const params = new URL(location.href).searchParams;
const previewKey = "gms.preview.personal.v1";
if (params.get("reset") === "1") localStorage.removeItem(previewKey);
let cached;
try { cached = JSON.parse(localStorage.getItem(previewKey) || "null"); } catch { cached = null; }
const savePreview = () => localStorage.setItem(previewKey, JSON.stringify({ world: storage.get("gms-reputation.worldState"), users: game.users.map(user => ({id:user.id,flags:user.flags})) }));
const renderTemplate = async (template, context) => {
  const response = await fetch("/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template, context }) });
  if (!response.ok) throw new Error(`Template unavailable: ${template}`);
  return response.text();
};
class PreviewApplication {
  constructor(options = {}) { this.options = options; this.rendered = false; this._renderTail = Promise.resolve(); }
  async _prepareContext() { return {}; }
  render() {
    this._renderTail = this._renderTail.catch(() => {}).then(async () => {
      const context = await this._prepareContext({});
      const html = await renderTemplate(this.constructor.PARTS.main.template, context);
      if (!this.element) { this.element = document.createElement("div"); this.element.className = `application ${this.constructor.DEFAULT_OPTIONS.classes.join(" ")}`; document.querySelector("#preview-stage").append(this.element); }
      this.element.innerHTML = `<div class="window-content">${html}</div>`;
      this.rendered = true; await this._onRender(context, {});
      return this;
    }); return this._renderTail;
  }
  async close() { await this._renderTail; await this._onClose?.({}); this.rendered = false; this.element?.remove(); this.element = null; }
  setPosition() {} // The preview frame adapts to the viewport instead of Foundry window positions.
}
globalThis.foundry = { utils: { deepClone: structuredClone }, applications: { api: { ApplicationV2: PreviewApplication, HandlebarsApplicationMixin: (Base) => Base }, handlebars: { renderTemplate, loadTemplates: async () => [] } } };
const listeners = new Map(); let hookId = 0;
globalThis.Hooks = {
  on(name, callback) { const key = ++hookId; if (!listeners.has(name)) listeners.set(name,new Map()); listeners.get(name).set(key,callback); return key; },
  off(name,key) { listeners.get(name)?.delete(key); },
  callAll(name,...args) { for (const fn of [...(listeners.get(name)?.values() ?? [])]) fn(...args); },
  once(name,callback) { const key=this.on(name,(...args)=>{this.off(name,key);callback(...args);}); return key; }
};
class PreviewUser {
  constructor(id,name,role,binding=null) { this.id=id;this.name=name;this.role=role;this.isGM=role===4;this.active=true;this.flags=structuredClone(cached?.users?.find(user=>user.id===id)?.flags ?? {"gms-reputation":{personalReputationBinding:binding}}); }
  getFlag(namespace,key) { return structuredClone(this.flags[namespace]?.[key]); }
  async update(changes) {
    if (!game.user.isGM && game.user.id !== this.id) throw new Error("User update denied");
    for (const [path,value] of Object.entries(changes)) {
      const [,namespace,key] = path.split(".");
      if (!this.flags[namespace]) this.flags[namespace]={}; this.flags[namespace][key]=structuredClone(value);
    }
    savePreview();Hooks.callAll("updateUser",this,changes);return this;
  }
  async setFlag(namespace,key,value) { await this.update({[`flags.${namespace}.${key}`]:value});return value; }
}
const users=[new PreviewUser("gm","Mestre",4),new PreviewUser("mari","Mari",1,{profileId:"p-self",subjectId:"s1"}),new PreviewUser("joao","João",1,{profileId:"p-fio",subjectId:"s2"})];
globalThis.ui = { notifications: { info: console.info, warn: console.warn, error: console.error } };
globalThis.game = { user: users.find(user=>user.id===params.get("user")) || users[0], users, actors: [], settings: {
  register(namespace,key,config) { const id = `${namespace}.${key}`; configs.set(id,config); if (!storage.has(id)) storage.set(id,structuredClone(config.default)); },
  get(namespace,key) { return structuredClone(storage.get(`${namespace}.${key}`)); },
  async set(namespace,key,value) { const id = `${namespace}.${key}`; storage.set(id,structuredClone(value)); savePreview(); configs.get(id)?.onChange?.(value,{ userId: game.user.id }); return structuredClone(value); }
} };
const { registerPersistenceSettings } = await import("../scripts/persistence/settings.js"); registerPersistenceSettings();
const Schema = await import("../scripts/data/schema.js");
const { primeWorldStateSync } = await import("../scripts/events/world-sync.js");
const state = Schema.createEmptyWorldState({ createdBy: game.user.id });
state.groups.g1 = { id:"g1",name:"Nexus",active:true,archived:false,sortOrder:10 };
const aliases = ["Corvo", "Fio Rubro", "Sentinela", "Espectro", "Lapso"];
const portraits = ["corvo", "fio", "sentinela", "espectro", "lapso"];
for (let i=0;i<aliases.length;i++) state.subjects[`s${i+1}`] = Schema.createSubject({ id:`s${i+1}`,alias:aliases[i],realName:["Daniel Shirako","Agnes","Arthur","Isadora","Ícaro"][i],description:"Um vínculo que evolui a cada escolha da campanha.",portrait:{src:`/visualizer/assets/${portraits[i]}.png`},sortOrder:(i+1)*10 });
for (let i=0;i<2;i++) state.profiles[`p${i+1}`] = Schema.createProfile({id:`p${i+1}`,name:`Reputação com ${i ? "Sentinela" : "Lapso"}`,groupId:"g1",sortOrder:(i+1)*10,focal:{name:i ? "Sentinela" : "Lapso",description:"Toda escolha deixa uma marca. Explore a matriz de vínculos e acompanhe a evolução de cada relação.",portrait:{src:`/visualizer/assets/${i ? "sentinela" : "lapso"}.png`}},subjectIds:Object.keys(state.subjects),relationships:Object.fromEntries(Object.keys(state.subjects).map((id,j)=>[id,{subjectId:id,score:[4,8.5,-2,0,10][j],bond:j===1,communion:j===4}]))});
for (const [id,name,portrait] of [["p-self","Corvo","corvo"],["p-fio","Fio Rubro","fio"]]) state.profiles[id] = Schema.createProfile({id,name:`Reputação com ${name}`,groupId:"g1",sortOrder:id==="p-self"?30:40,focal:{name,portrait:{src:`/visualizer/assets/${portrait}.png`}},subjectIds:Object.keys(state.subjects),relationships:Object.fromEntries(Object.keys(state.subjects).map(subjectId=>[subjectId,{subjectId,score:0}]))});
const canonical = Schema.normalizeWorldState(cached?.world ?? state);
storage.set("gms-reputation.worldState",canonical); primeWorldStateSync(canonical);
const { ReputationMasterPanelApplication: MasterClass } = await import("../scripts/apps/master-panel.js");
const { ReputationPlayerDashboardApplication: PlayerClass } = await import("../scripts/apps/player-dashboard.js");
let current;
async function show(kind) { await current?.close(); if (current?.rendered) return; current = kind === "player" ? new PlayerClass({profileId:"p1"}) : new MasterClass({profileId:"p1",subjectId:"s1",activeSection:"relationship"}); globalThis.previewApp=current; await current.render(); }
async function change(delta) { const next=structuredClone(storage.get("gms-reputation.worldState")); next.revision++; const relation=next.profiles[current.profileId].relationships[current.subjectId || game.user.getFlag("gms-reputation","personalReputationBinding")?.subjectId || "s1"]; relation.score=Math.max(-10,Math.min(10,relation.score+delta)); await game.settings.set("gms-reputation","worldState",next); }
for(const button of document.querySelectorAll("[data-demo]")) button.addEventListener("click",()=>["up","down"].includes(button.dataset.demo) ? change(button.dataset.demo === "up" ? .5 : -.5) : show(button.dataset.demo));
const picker=document.querySelector('[data-preview-user]');picker.value=game.user.id;
picker.addEventListener('change',async()=>{await current?.close();if(current?.rendered){picker.value=game.user.id;return;}const next=new URL(location.href);next.searchParams.delete('reset');next.searchParams.set('user',picker.value);next.searchParams.set('view',picker.value==='gm'?'master':'player');location.href=next;});
await show(new URL(location.href).searchParams.get("view") === "player" ? "player" : "master");
globalThis.previewShow=show;
savePreview();globalThis.previewReady=true;
