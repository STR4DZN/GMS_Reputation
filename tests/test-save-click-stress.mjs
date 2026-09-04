import assert from "node:assert/strict";

const storage=new Map(); const registrations=new Map();
globalThis.game={
  user:{id:"gm-save",isGM:true,name:"GM Save"},
  users:new Map([["gm-save",{id:"gm-save",isGM:true,name:"GM Save"}]]),
  settings:{
    register(ns,key,cfg){const id=`${ns}.${key}`;registrations.set(id,cfg);if(!storage.has(id))storage.set(id,structuredClone(cfg.default));},
    get(ns,key){return structuredClone(storage.get(`${ns}.${key}`));},
    async set(ns,key,value){storage.set(`${ns}.${key}`,structuredClone(value));return structuredClone(value);}
  }
};
let rid=0;globalThis.foundry={utils:{deepClone:structuredClone,randomID(n=16){rid++;return (`r${rid}`).padEnd(n,"x").slice(0,n);}}};
globalThis.ui={notifications:{info(){},warn(){},error(){}}};

const {MODULE_ID,SETTINGS,MASTER_SAVE_MODE}=await import("../scripts/constants.js");
const Schema=await import("../scripts/data/schema.js");
const {registerPersistenceSettings}=await import("../scripts/persistence/settings.js");
const Store=await import("../scripts/persistence/world-store.js");
const MasterPrefs=await import("../scripts/persistence/master-preferences.js");
const Master=await import("../scripts/apps/master-panel.js");
registerPersistenceSettings();
await MasterPrefs.setMasterSaveMode(MASTER_SAVE_MODE.MANUAL);
const initial=Schema.createEmptyWorldState({createdBy:"gm-save"});
initial.subjects.s1=Schema.createSubject({id:"s1",realName:"Stress",alias:"Stress",sortOrder:10});
initial.profiles.p1=Schema.createProfile({id:"p1",name:"Perfil",relationships:{s1:{subjectId:"s1",score:0,bond:false,communion:false}}});
storage.set(`${MODULE_ID}.${SETTINGS.WORLD_STATE}`,structuredClone(initial));
storage.set(`${MODULE_ID}.${SETTINGS.WORLD_STATE_BACKUP}`,{});

class FakeNode{
  constructor({value="",checked=false}={}){this.value=value;this.checked=checked;this.disabled=false;this.dataset={};this.listeners=new Map();this.textContent="";}
  addEventListener(type,fn){const list=this.listeners.get(type)??[];list.push(fn);this.listeners.set(type,list);}
  removeEventListener(type,fn){const list=this.listeners.get(type)??[];this.listeners.set(type,list.filter(x=>x!==fn));}
  async emit(type){for(const fn of this.listeners.get(type)??[])await fn({preventDefault(){},stopPropagation(){},target:this});}
}
const score=new FakeNode({value:"0"}),bond=new FakeNode(),communion=new FakeNode(),save=new FakeNode(),discard=new FakeNode(),bar=new FakeNode(),label=new FakeNode(),count=new FakeNode();
const nodes=new Map([["[data-master-score-input]",score],["[data-master-bond]",bond],["[data-master-communion]",communion],["[data-master-save-now]",save],["[data-master-discard-pending]",discard],["[data-master-save-state]",bar],["[data-master-save-label]",label],["[data-master-save-pending-count]",count]]);
const root={dataset:{},querySelector(q){return nodes.get(q)??null;},querySelectorAll(){return [];}};
const app=new Master.ReputationMasterPanelApplication({profileId:"p1",subjectId:"s1",activeSection:"relationship"});
app._wireSaveControls(root,{undoRedo:{undoTarget:null,redoTarget:null}});
assert.equal(save.disabled,false);

let assertions=1;
for(let i=0;i<240;i++){
  const expanded=(i%7===0)||(i%11===0);
  bond.checked=i%7===0; communion.checked=i%11===0;
  const limit=expanded?12:10;
  const raw=-10+((i*7)%((limit+10)*2+1))/2;
  const expected=Math.max(-10,Math.min(limit,raw));
  score.value=String(expected);
  await save.emit("click");
  const world=Store.loadWorldState();
  const rel=world.profiles.p1.relationships.s1;
  assert.equal(rel.score,expected);assertions++;
  assert.equal(rel.bond,bond.checked);assertions++;
  assert.equal(rel.communion,communion.checked);assertions++;
  assert.equal(app._saveController.hasPending,false);assertions++;
  assert.equal(save.disabled,false);assertions++;
}
app._saveController.destroy();
console.log(`save-click-stress: OK | assertions=${assertions}`);
