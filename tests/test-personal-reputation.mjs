import assert from 'node:assert/strict';
import { createEmptyWorldState, createProfile, createSubject } from '../scripts/data/schema.js';
import { PERSONAL_REPUTATION_FLAGS as F, PersonalReputationReader, matchingProfileSubject, createPersonalSnapshot, diffPersonalSnapshots, buildPlayerBindingsContext, setUserPersonalBinding } from '../scripts/persistence/personal-reputation.js';
const M = 'gms-reputation';
const binding = {profileId:'mari',subjectId:'s-mari'};
function user(id, bound=binding) {
  return {id,name:id,role:1,flags:{[M]:{[F.BINDING]:structuredClone(bound)}},writes:[],
    getFlag(namespace,key) {return this.flags[namespace]?.[key];},
    async setFlag(namespace,key,value) {this.writes.push(key);this.flags[namespace][key]=structuredClone(value);},
    async update(changes) {this.writes.push(changes);for(const [path,value] of Object.entries(changes))this.flags[M][path.split('.').at(-1)]=structuredClone(value);}
  };
}
const state=createEmptyWorldState();
state.subjects['s-mari']=createSubject({id:'s-mari',alias:'Mari',realName:'Mariana'});
state.subjects['s-other']=createSubject({id:'s-other',alias:'Outra pessoa'});
for(const [id,name,score] of [['mari','Mári',7],['corvo','Corvo',2],['lapso','Lapso',5]]) state.profiles[id]=createProfile({id,name:`Matriz ${name}`,focal:{name},subjectIds:['s-mari','s-other'],relationships:{'s-mari':{score},'s-other':{score:8}}});
const mari=user('Mari');const second=user('Outro jogador');
globalThis.game={user:{id:'gm',role:4,isGM:true},users:[mari,second],settings:{get(){throw new Error('Personal operations must not read world settings when state supplied');},set(){throw new Error('Must not change world settings');}}};
assert.equal(matchingProfileSubject(state,'mari'),'s-mari','Unique name match tolerates accents');
const ambiguous=structuredClone(state);ambiguous.subjects.clone=createSubject({id:'clone',alias:'Mari'});
assert.equal(matchingProfileSubject(ambiguous,'mari'),'','Ambiguous names require explicit choice');
const context=buildPlayerBindingsContext(state);assert.equal(context[0].userName,'Mari');assert.equal(context[0].profiles.find(p=>p.id==='mari').selected,true);
const priorView={schema:1,...createPersonalSnapshot(state,binding),viewedAt:1,lastReport:[]};
mari.flags[M][F.VIEW]=structuredClone(priorView);
await setUserPersonalBinding('Mari',binding,state);
assert.equal(mari.writes.length,0,'Saving the same mapping preserves last visualization');
await setUserPersonalBinding('Mari',{profileId:''},state);
assert.equal(mari.flags[M][F.VIEW],null);assert.equal(mari.flags[M][F.BINDING],null);
await setUserPersonalBinding('Mari',{profileId:'mari'},state);
assert.deepEqual(mari.flags[M][F.BINDING],binding,'Unique subject automatically selected');
assert.equal(mari.writes.length,2,'Atomic user flag updates only');
game.user={role:3,isGM:true};await assert.rejects(setUserPersonalBinding('Mari',binding,state),/Gamemaster/);
game.user={role:1,isGM:false};await assert.rejects(setUserPersonalBinding('Mari',binding,state),/Gamemaster/);
game.user={role:4,isGM:true};await assert.rejects(setUserPersonalBinding('unknown',binding,state),/Usuário/);
await assert.rejects(setUserPersonalBinding('Mari',{profileId:'missing'},state),/Perfil/);
await assert.rejects(setUserPersonalBinding('Mari',{profileId:'mari'},ambiguous),/Escolha/);
const first=createPersonalSnapshot(state,binding);assert.deepEqual(Object.keys(first.relations),['corvo','lapso']);
const irrelevant=structuredClone(state);irrelevant.profiles.mari.relationships['s-mari'].score=0;irrelevant.profiles.corvo.relationships['s-other'].score=0;irrelevant.profiles.corvo.relationships['s-mari'].notes='text';
assert.equal(diffPersonalSnapshots(first,createPersonalSnapshot(irrelevant,binding)).length,0);
const unavailable=structuredClone(state);unavailable.profiles.corvo.archived=true;unavailable.profiles.lapso.subjectIds=['s-other'];assert.deepEqual(createPersonalSnapshot(unavailable,binding).relations,{});
let reports=[];
const reader=new PersonalReputationReader({user:()=>mari,onReport:(changes,meta)=>{reports.push({changes,meta});return true;}});
reader.open(state);await reader.whenSaved();assert.equal(reports.length,0,'First open establishes baseline, no old flood');
reader.close();
const offline=structuredClone(state);offline.profiles.corvo.relationships['s-mari'].score=4.5;offline.profiles.lapso.relationships['s-mari'].score=3;offline.profiles.mari.relationships['s-mari'].score=0;offline.profiles.corvo.relationships['s-other'].score=0;
reader.open(offline,{visible:false});await reader.whenSaved();assert.equal(reports.length,0,'Hidden windows do not acknowledge changes');
reader.refresh(offline);await reader.whenSaved();assert.equal(reports.length,1);assert.equal(reports[0].changes.length,2);
assert.equal(reports[0].changes[0].title,'Sua reputação aumentou com Corvo');assert.equal(reports[0].changes[0].delta,2.5);
assert.equal(reports[0].changes[1].title,'Sua reputação diminuiu com Lapso');assert.equal(reports[0].changes[1].delta,-2);
reader.close();reader.open(offline);await reader.whenSaved();assert.equal(reports.length,1,'Reopening without changes does not duplicate');
assert.equal(reader.replay(offline),true);assert.equal(reports.at(-1).meta.replay,true,'Saved full recap remains replayable');
reader.dismiss();
const live=structuredClone(offline);live.profiles.corvo.relationships['s-mari'].score=5;reader.refresh(live);await reader.whenSaved();
assert.equal(reports.at(-1).changes.length,1);assert.equal(reports.at(-1).changes[0].delta,.5,'Dismiss resets live aggregation, preserving new baseline');
live.profiles.corvo.relationships['s-mari'].score=6;reader.refresh(live);await reader.whenSaved();assert.equal(reports.at(-1).changes[0].delta,1.5,'Rapid changes preserve first value');
live.profiles.corvo.relationships['s-mari'].score=4.5;reader.refresh(live);await reader.whenSaved();assert.equal(reports.at(-1).changes.length,0,'Returning to initial value cancels report');
const otherReports=[];const otherReader=new PersonalReputationReader({user:()=>second,onReport:changes=>{otherReports.push(changes);return true;}});
otherReader.open(state);await otherReader.whenSaved();otherReader.close();otherReader.open(live);await otherReader.whenSaved();
assert.equal(otherReports.at(-1)[0].delta,2.5,'Different user has independent baseline');
assert.notDeepEqual(second.flags[M][F.VIEW],mari.flags[M][F.VIEW]);
const added=structuredClone(live);added.profiles.new=createProfile({id:'new',name:'Novo',focal:{name:'Novo'},subjectIds:['s-mari'],relationships:{'s-mari':{score:9}}});
reader.dismiss();const count=reports.length;reader.refresh(added);await reader.whenSaved();assert.equal(reports.length,count,'New matrix does not produce historical change');
added.profiles.new.relationships['s-mari'].score=10;reader.refresh(added);await reader.whenSaved();assert.equal(reports.at(-1).changes[0].delta,1);
reader.dismiss();added.profiles.new.relationships['s-mari'].bond=true;reader.refresh(added);await reader.whenSaved();assert.equal(reports.at(-1).changes[0].direction,'protocol');
// Presentation failure cannot mark a report as viewed.
const deferredUser=user('deferred');deferredUser.flags[M][F.VIEW]=structuredClone(priorView);
let canShow=false;const deferred=new PersonalReputationReader({user:()=>deferredUser,onReport:()=>canShow});
deferred.open(offline);await deferred.whenSaved();assert.equal(deferredUser.flags[M][F.VIEW].relations.corvo.score,2);
canShow=true;deferred.refresh(offline);await deferred.whenSaved();assert.equal(deferredUser.flags[M][F.VIEW].relations.corvo.score,4.5);
// A failed flag write leaves the stored baseline intact, so a later session catches up again.
const failedUser=user('failed');failedUser.flags[M][F.VIEW]=structuredClone(priorView);let failures=0;
failedUser.setFlag=async()=>{throw new Error('offline write');};
const failed=new PersonalReputationReader({user:()=>failedUser,onReport:()=>true,onError:()=>failures++});
failed.open(offline);await failed.whenSaved();assert.equal(failures,1);assert.equal(failedUser.flags[M][F.VIEW].relations.corvo.score,2);
failed.close();failedUser.setFlag=user('temporary').setFlag;failed.open(offline);await failed.whenSaved();assert.equal(failedUser.flags[M][F.VIEW].relations.corvo.score,4.5);
// Coalesced flag writes execute serially and a quick reopen retains the in-flight latest view.
const slowUser=user('slow');slowUser.flags[M][F.VIEW]=structuredClone(priorView);let release,active=0,maxActive=0;
slowUser.setFlag=async function(namespace,key,value){active++;maxActive=Math.max(active,maxActive);if(!release)await new Promise(resolve=>release=resolve);this.flags[namespace][key]=structuredClone(value);active--;};
let slowReports=0;const slow=new PersonalReputationReader({user:()=>slowUser,onReport:()=>{slowReports++;return true;}});
slow.open(offline);await Promise.resolve();slow.close();slow.open(offline);assert.equal(slowReports,1,'Reopen during save does not repeat recap');
const later=structuredClone(offline);later.profiles.corvo.relationships['s-mari'].score=7;slow.refresh(later);release();await slow.whenSaved();assert.equal(maxActive,1);assert.equal(slowUser.flags[M][F.VIEW].relations.corvo.score,7);
// Archived counterparts disappear from active/replayed recaps without consuming unrelated rows.
const archived=structuredClone(added);archived.profiles.new.archived=true;
reader.refresh(archived);await reader.whenSaved();assert.equal(reports.at(-1).changes.length,0);assert.equal(reader.replay(archived),false);
// Binding changes establish a new baseline instead of comparing unrelated characters.
mari.flags[M][F.BINDING]={profileId:'corvo',subjectId:'s-other'};reader.refresh(added);await reader.whenSaved();assert.equal(mari.flags[M][F.VIEW].subjectId,'s-other');assert.equal(mari.flags[M][F.VIEW].lastReport.length,0);
console.log('personal-reputation: OK | named links, permissions, own row, offline, hidden views, replay, independent users, protocol, errors and serialized writes');
