import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {pathToFileURL} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const output='/tmp/gms-master-window-qa';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-gpu']});
const errors=[],report={windows:[],npcRows:0,groupTitles:0,readOnly:true,playersUnchanged:false,imageCustomization:false};
try{
 for(const structure of ['nested-part','root-part'])for(const [width,zoom] of [[1440,1],[1152,1],[1024,1],[1440,1.25]]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('dist/GMS_Reputation_V2_Preview.html')).href);await page.waitForSelector('body[data-preview-ready=true]');
  await page.evaluate(async zoom=>{
   document.documentElement.style.zoom=zoom;
   const s=game.settings.get('gms-reputation','worldState'),p=structuredClone(s.profiles.nexus);
   s.groups.nexus.name='Aliados dos Players Mais Amados';s.groups.lamina={...s.groups.nexus,id:'lamina',name:'Lamina Negra'};s.groups.zueira={...s.groups.nexus,id:'zueira',name:'ZUEIRAMA'};s.profiles={};
   for(let i=0;i<11;i++){const id='npc-'+i,name=['ORIGIN(INICIO DE TUDO)','Error','Aurelio','Terceiro','Zetherion (Gordo)','Shiagorath','Ihagumh'][i%7];s.profiles[id]={...structuredClone(p),id,name,sortOrder:i,groupId:['nexus','lamina','zueira'][i%3],focal:{...structuredClone(p.focal),name}};}
   await game.settings.set('gms-reputation','worldState',s);previewApp.profileId='npc-0';await previewApp.render({force:true});
   globalThis.worldBeforeLayout=JSON.stringify(game.settings.get('gms-reputation','worldState'));globalThis.layoutWrites=0;const set=game.settings.set.bind(game.settings);game.settings.set=async(ns,key,value)=>{if(key==='worldState')layoutWrites++;return set(ns,key,value);};
  },zoom);
  const frame=async()=>page.evaluate(structure=>{
   const root=document.querySelector('#gms-reputation-master-panel'),content=root.querySelector('.window-content');
   if(!root.querySelector('.window-header')){const header=document.createElement('header');header.className='window-header';header.textContent='GMS // Reputação V2';header.style.cssText='flex:0 0 28px;padding:4px 8px;font:12px Georgia';root.prepend(header);}
   if(structure==='root-part'){const part=content.querySelector('[data-master-panel-root]');if(part)content.replaceChildren(...part.childNodes);}
   content.style.setProperty('height','calc(100% - 28px)','important');
  },structure);
  await frame();
  const rows=page.locator('[data-grid-npc]');assert.equal(await rows.count(),11);
  for(let i=0;i<await rows.count();i++){
   const row=rows.nth(i);await row.scrollIntoViewIfNeeded();
   const box=await row.evaluate(el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('strong,small')].map(t=>{const b=t.getBoundingClientRect();return{text:t.textContent,top:b.top-r.top,bottom:b.bottom-r.top,height:r.height};});});
   for(const b of box)assert.ok(b.top>=-1&&b.bottom<=b.height+1,`${structure}/${width}/${zoom}: NPC text overlaps ${JSON.stringify(b)}`);report.npcRows++;
  }
  const rail=await page.locator('.gms-workbench-npcs').evaluate(el=>el.getBoundingClientRect().width/parseFloat(getComputedStyle(document.documentElement).zoom||1));
  assert.ok(Math.abs(rail-176)<1||Math.abs(rail-154)<1,'dev.14 sidebar width retained');
  await page.locator('[data-master-section-choice=profiles]').click();await frame();
  const workspace=page.locator('.gms-master-panel__content');
  const bounds=await workspace.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));assert.ok(bounds.scroll<=bounds.client+2);
  for(const summary of await page.locator('.gms-master-profile-group__summary-copy').all()){
   const rect=await summary.evaluate(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}));assert.ok(rect.w>=100*zoom&&rect.h<200*zoom,`${structure}/${width}: compressed group ${JSON.stringify(rect)}`);report.groupTitles++;
  }
  const group=page.locator('[data-master-group=lamina] summary');await group.scrollIntoViewIfNeeded();await group.click();
  const choice=page.locator('[data-master-group=lamina] [data-master-profile-choice]').first();await choice.click();await frame();
  assert.equal(await page.evaluate(()=>previewApp.profileId),'npc-1');
  await page.screenshot({path:`${output}/profiles-${structure}-${width}-${zoom}.png`});
  await page.locator('[data-master-section-choice=relationship]').click();await frame();await page.screenshot({path:`${output}/reputation-${structure}-${width}-${zoom}.png`});
  if(structure==='root-part'&&width===1152&&zoom===1){
   await page.locator('[data-master-section-choice=characters]').click();await frame();
   assert.equal(await page.locator('.gms-portrait-preview-grid figure').count(),2);
   const saved=await page.evaluate(()=>structuredClone(previewApp._portraitController.value));
   await page.locator('[data-action=openPortraitOriginal]').click();await page.locator('[data-portrait-original]').waitFor();await page.keyboard.press('Escape');await page.locator('[data-portrait-original]').waitFor({state:'detached'});
   await page.locator('[name=portraitZoom]').fill('143.7');await page.locator('[name=portraitZoom]').dispatchEvent('input');
   assert.equal(await page.evaluate(()=>previewApp._portraitController.value.zoom),143.7);
   await page.locator('[data-action=restoreSavedPortrait]').click();assert.deepEqual(await page.evaluate(()=>previewApp._portraitController.value),saved);report.imageCustomization=true;
  }
  assert.equal(await page.evaluate(()=>layoutWrites),0);assert.equal(await page.evaluate(()=>JSON.stringify(game.settings.get('gms-reputation','worldState'))===worldBeforeLayout),true);
  report.windows.push({structure,width,zoom,rail});console.log('window passed',structure,width,zoom);await page.close();
 }
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(path.resolve('dist/GMS_Reputation_V2_Preview.html')).href);await page.waitForSelector('body[data-preview-ready=true]');await page.locator('[data-preview-mode=player]').click();await page.evaluate(()=>previewApp._motionController.destroy());
 await page.addStyleTag({content:'#gms-reputation-player-dashboard *,#gms-reputation-player-dashboard *::before,#gms-reputation-player-dashboard *::after{animation:none!important;transition:none!important}'});
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-player-card] img[data-gms-media-src]')].every(i=>i.complete));
 const dashboard=page.locator('#gms-reputation-player-dashboard');const measure=el=>[el,...el.querySelectorAll('*')].map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return{css:['display','position','width','height','padding','margin','gap','font-family','font-size','font-weight','line-height','color','background-color','background-image','border','filter','object-fit','object-position','transform','grid-template-columns','grid-template-rows'].map(p=>[p,s.getPropertyValue(p)]),r:[r.x,r.y,r.width,r.height]};});
 const before=await dashboard.evaluate(measure),picture=await dashboard.screenshot({animations:'disabled'});
 const baseCSS=await readFile('styles/player-original.css','utf8')+'\n'+await readFile('styles/visible-portraits.css','utf8');
 const css=await page.evaluate(css=>{for(const [name,url] of Object.entries(GMS_PREVIEW_ASSETS))css=css.replaceAll('../assets/icons/'+name,url);return css;},baseCSS);
 await page.locator('head > style').first().evaluate((e,css)=>e.textContent=css,css);
 assert.deepEqual(await dashboard.evaluate(measure),before);assert.ok(picture.equals(await dashboard.screenshot({animations:'disabled'})));report.playersUnchanged=true;
 await browser.close();assert.deepEqual(errors,[]);await writeFile(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,status:'passed'}));
}finally{await browser.close();}
