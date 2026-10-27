// Observer-only successor. --list/--selftest never import Playwright or launch a browser.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {appendFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {build} from '../scripts/build.mjs';
import {createAppServer} from '../scripts/serve.mjs';
import {repositoryFiles,runtimeFiles} from '../scripts/files.mjs';
import {validateCatalog,validateWorkspace,emptyWorkspace,STORAGE_KEY,filterEntries} from '../src/domain.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const digest=b=>createHash('sha256').update(b).digest('hex');
const canonical=o=>JSON.stringify(o,Object.keys(o).sort());
const stamp=()=>new Date().toISOString();
const keys=['swissdrg-akut','swissdrg-geburtshaus','tarpsy','st-reha'];
const otherKeys=['dentotar','migel','sl','analysenliste','pflegefinanzierung','arzneimittelliste','arzttarife','physiotherapie'].map(x=>x+'.workspace.v1');
const targets=['dentotar','migel','spezialitaetenliste','analysenliste','pflegefinanzierung','arzneimittelliste','arzttarife','physiotherapie','spitaltarife'].map(x=>`https://wakuwakumiwaku.github.io/${x}/`).sort();
const names=[
 'Öffentlicher Umfang, archivierte Quellen, neun kanonische Navigationen',
 'Vier echte private Hauptsettings: Vorschau/Abbrechen, alle Zeilen/Paginierung/alle Felder, globale Suche/Reset',
 'Vier quellabgeleitete Geldorakel, Methodenunterschiede, unbekannt vs explizit 0',
 'JSON-Download/Preview/Abbruch/Übernahme, Entwurf und privater Katalog bleiben getrennt',
 'Cross-tab/defekter/blockierter/Quota-Speicher: kein Überschreiben, Entwurf erhalten',
 '1440/768/390/320, lange Details, Tastatur, helle Druck-CSS und window.print-API-Grenze',
];
const specs=[
 ['public.scope',1,'Drei echte Profile/vier vollständige Hinweise; null gehostete Gruppen, 1135 private Hauptsettingzeilen'],
 ['public.sources',1,'Alle 13 Original-/Snapshot-URLs/SHA/Bytes/Gültigkeit, Rechte und ST-Reha-PV2/Titel2025/Fortgeltung2026'],
 ['public.links',1,'Exakt 3+6 eindeutige normale Anchors/eigene aria-current/native Enter+Space'],
 ...targets.map((u,i)=>['nav.'+i,1,`Tatsächliches Enter auf ${u}; vor Kontakt abgefangen; keine Remoteverfügbarkeit behauptet`]),
 ...keys.flatMap(k=>[
  [k+'.import',2,'Native Dateiauswahl: Preview/Cancel ohne Mutation, RAM-Übernahme, ganze ungültige Datei abgelehnt'],
  [k+'.rows',2,'Alle tatsächlichen Zeilen nach echter Pagination; jede vollständige Überschrift/notes/Detail-Metadaten/Quell-URL/SHA/Gültigkeit/Gewicht'],
  [k+'.search',2,'Globale Suche jenseits erster DOM-Seite, kein Treffer, Reset, System-/Merkfilter, RAM schliessen'],
 ]),
 ...keys.map(k=>['price.'+k,3,'Unabhängiges Raw-XML/CSV/Decimal-Orakel, native Detailübernahme/exakter CHF-Preis; TARPSY ein Aufenthalt/ST-Reha Phasensumme']),
 ['price.missing-zero',3,'Echtes unbewertetes P60A ≠ manuell deklariertes 0: Nicht berechnet versus CHF 0.00'],
 ['state.download',4,'Echter JSON-Download saveAs/Bytes/SHA; keine Quellzeilen im Workspace'],
 ['state.preview-cancel',4,'Vorschau/Abbrechen erhalten rohen Speicher und Entwurf'],
 ['state.confirm-cancel',4,'Reale confirm-Abweisung nach originalgetreuem Backupdownload; keine Mutation'],
 ['state.apply',4,'Originalbackup vor realer confirm-Zustimmung; validierter Ersatz/Entwurf erhalten'],
 ['state.bad-reload',4,'Ungültiger Workspace ganz abgelehnt; Reload persistiert Workspace, verwirft RAM-Katalog'],
 ['storage.two-tabs',5,'Zwei echte Tabs gleicher Origin; Fremdänderung schützt Original/Entwurf, acht fremde RAW-Werte unverändert'],
 ...['damaged','read-boot','read-save','write','quota'].map(m=>['storage.'+m,5,'Nur eigener Schlüssel: '+m+'; native acht Fremd-RAW-Guardreads, genaue Triggerzähler, Entwurfrettungsdownload']),
 ...[1440,768,390,320].map(w=>['responsive.'+w,6,`${w}px: native 3+6 geschlossen/offen, gescrollte echte Zeilen, gefüllter Rechner/Preis, längstes Detail oben/unten/Quelle; Fonts/Overflow/Hitbox/Overlap/Occlusion; eindeutige Viewport-PNGs`]),
 ['print.boundary',6,'Echter Druckbutton→deklarierter window.print-Adapter mit count/beforeprint/afterprint, reale helle Print-DOM/CSS; kein OS-Druck/Spool'],
];
const mobileSteps=['menu-closed','menu-open','rows','calculator','money','detail-top','detail-bottom','sources','file-form'];
export function makePlan(){return specs.map(([id,area,purpose])=>({id,area,purpose,status:'notrun',attempted:false,executed:false,assertions:[],...(id.startsWith('responsive.')?{checkpoints:mobileSteps.map(id=>({id,status:'notrun'}))}:{})}));}
export function counts(plan){
 const n=s=>plan.filter(x=>x.status===s).length;
 return {registered:plan.length,attempted:plan.filter(x=>x.attempted).length,executed:plan.filter(x=>x.executed).length,settled:n('pass')+n('fail')+n('skip'),pass:n('pass'),fail:n('fail'),skips:n('skip'),notrun:n('notrun'),running:n('running')};
}
export function expectedAbort(r,t){return Boolean(t&&t.routed&&t.requestId===r.requestId&&r.url===t.url&&targets.includes(r.url)&&r.method==='GET'&&r.navigation===true&&r.mainFrame===true&&r.failure==='NS_ERROR_ABORT');}
export async function freshOutput(requested){
 const local=path.join(root,'.local');await mkdir(local,{recursive:true});assert.equal(await realpath(local),local,'Refuse symlinked .local');
 const output=path.resolve(requested||path.join(local,'native-'+stamp().replace(/[:.]/g,'-')+'-'+randomUUID()));
 assert.ok(output.startsWith(local+path.sep),'NATIVE_OUTPUT must be a NEW directory under this candidate .local/');
 assert.equal(await realpath(path.dirname(output)),local,'Output must be directly under .local/; no symlink ancestors');
 await mkdir(output);return output; // nonrecursive + exclusive: never overwrite old evidence
}
// Exact own-key fault injection. Native functions retained for guard readback; other namespaces are never denied.
export function storageObserver({key,sentinels,mode='none',initial=null}){
 if(location.origin==='null')return;
 const storage=window.localStorage,proto=Storage.prototype,nativeGet=proto.getItem,nativeSet=proto.setItem;
 const state={mode,armed:mode==='read-boot',faults:{get:0,set:0},calls:[]};
 for(const [k,v] of Object.entries(sentinels))if(Reflect.apply(nativeGet,storage,[k])===null)Reflect.apply(nativeSet,storage,[k,v]);
 if(initial!==null&&Reflect.apply(nativeGet,storage,[key])===null)Reflect.apply(nativeSet,storage,[key,initial]);
 const get=Object.getOwnPropertyDescriptor(proto,'getItem'),set=Object.getOwnPropertyDescriptor(proto,'setItem');
 Object.defineProperty(proto,'getItem',{...get,value:function(k){
  if(this===storage&&k===key){state.calls.push({op:'get',key:k,armed:state.armed});if(state.armed&&(mode==='read-boot'||mode==='read-save')){state.faults.get++;throw new DOMException('Observer own key read denied','SecurityError');}}
  return Reflect.apply(nativeGet,this,[k]);
 }});
 Object.defineProperty(proto,'setItem',{...set,value:function(k,v){
  if(this===storage&&k===key){state.calls.push({op:'set',key:k,armed:state.armed});if(state.armed&&(mode==='write'||mode==='quota')){state.faults.set++;throw new DOMException('Observer own key write denied',mode==='quota'?'QuotaExceededError':'SecurityError');}}
  return Reflect.apply(nativeSet,this,[k,v]);
 }});
 window.__nativeObserver={state,arm(){state.armed=true;},read(k){return Reflect.apply(nativeGet,storage,[k]);},sentinels(){return Object.fromEntries(Object.keys(sentinels).map(k=>[k,Reflect.apply(nativeGet,storage,[k])]));}};
}
// Reach the real matching card through the application's real pagination, not a narrower data fixture.
export async function revealByPagination(p,card){
 let clicks=0;
 while(await card.count()===0){assert.equal(await p.locator('#more').isVisible(),true,'Matching real row absent and pagination exhausted');await p.getByRole('button',{name:'Mehr anzeigen',exact:true}).click();clicks++;}
 assert.equal(await card.count(),1,'Expected exactly one real target card');return clicks;
}
// Serialized into the page unchanged. Native checkVisibility is the installed Firefox/Playwright
// visibility boundary: closed details descendants may retain boxes but are not painted controls.
export function collectGeometry({target,fonts}){
 const modal=document.querySelector('dialog[open]');
 const visible=[...document.querySelectorAll('a,button,input,select,textarea,summary')].filter(el=>{const r=el.getBoundingClientRect();return el.checkVisibility()&&r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&getComputedStyle(el).visibility!=='hidden'&&(!modal||el.closest('dialog[open]'));});
 const overlap=[];for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){const a=visible[i],b=visible[j];if(a.contains(b)||b.contains(a))continue;const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1)overlap.push([a.id||a.textContent.slice(0,40),b.id||b.textContent.slice(0,40)]);}
 return {overflow:{scroll:document.documentElement.scrollWidth,width:innerWidth},height:innerHeight,targets:[target],overlap,visibleControls:visible.map(el=>el.id||el.textContent.slice(0,40)),fonts:fonts.flatMap(([s,floor])=>[...document.querySelectorAll(s)].filter(el=>el.getClientRects().length).map(el=>({label:s,size:parseFloat(getComputedStyle(el).fontSize),floor,family:getComputedStyle(el).fontFamily})))};
}
export function auditGeometry(g){
 const problems=[];if(g.overflow.scroll>g.overflow.width+1)problems.push('horizontal page overflow');
 for(const t of g.targets){
  if(t.rect.width<t.minWidth||t.rect.height<t.minHeight)problems.push(t.label+': hitbox too small');
  if(t.rect.left<-.5||t.rect.right>g.overflow.width+.5||t.rect.top<-.5||t.rect.bottom>g.height+.5)problems.push(t.label+': target clipped');
  if(!t.hit)problems.push(t.label+': occluded hit samples');
 }
 for(const p of g.overlap)problems.push('overlap: '+p.join(' / '));
 for(const f of g.fonts)if(f.size<f.floor)problems.push(f.label+': font below '+f.floor+'px (actual '+f.size+')');
 return problems;
}
async function sourceBinding(){
 assert.equal(repositoryFiles.length,35);assert.equal(Object.keys(runtimeFiles).length,9);
 const publicFiles={};for(const p of [...repositoryFiles].sort())publicFiles[p]=digest(await readFile(path.join(root,p)));
 const runtime={};for(const [destination,source] of Object.entries(runtimeFiles)){const b=await readFile(path.join(root,source));runtime[destination]={source,bytes:b.length,sha256:digest(b)};}
 const catalogs=[];
 for(const key of keys){const relative='.local/catalogs/'+key+'.json',b=await readFile(path.join(root,relative)),data=validateCatalog(JSON.parse(b));catalogs.push({key,file:path.join(root,relative),relative,data,bytes:b.length,sha256:digest(b)});}
 assert.deepEqual(catalogs.map(f=>f.data.groups.length),[1081,8,24,22]);
 const publicData=JSON.parse(await readFile(path.join(root,'public/data/catalog.json'))),provenance=JSON.parse(await readFile(path.join(root,'public/data/provenance.json'))),rawSources=[];
 for(const e of [...provenance.recovered.artifacts,...provenance.recovered.evidence]){const b=await readFile(path.join(root,'sources',e.file));assert.equal(digest(b),e.sha256);assert.equal(b.length,e.bytes);rawSources.push({relative:'sources/'+e.file,bytes:b.length,sha256:digest(b)});}
 const pinned=JSON.parse(await readFile(path.join(root,'.local/public-file-hashes.json')));
 for(const f of catalogs){const p=pinned.private_fixtures.find(p=>p.relative===f.relative);assert.ok(p);assert.equal(f.sha256,p.sha256);assert.equal(f.bytes,p.bytes);}
 const proc=spawnSync(process.env.PYTHON||'python3',['tests/native_oracle.py'],{cwd:root,encoding:'utf8'});assert.equal(proc.status,0,proc.stderr);
 const oracle=JSON.parse(proc.stdout);assert.equal(oracle.cases.length,4);assert.deepEqual(oracle.cases.map(c=>c.key),keys);
 return {catalogs,oracle,publicData,provenance,binding:{publicFiles,identity:digest(canonical(publicFiles)),identityDefinition:'sha256(UTF-8 JSON sorted keys, compact separators of relative path -> sha256)',runtime,fixtures:catalogs.map(({key,relative,bytes,sha256,data})=>({key,relative,bytes,sha256,rows:data.groups.length})),rawSources,oracle,oracleProcess:{argv:[process.env.PYTHON||'python3','tests/native_oracle.py'],exit:proc.status,stdout:proc.stdout,stderr:proc.stderr},helperSha256:publicFiles['tests/native-firefox.mjs'],oracleSha256:publicFiles['tests/native_oracle.py'],parentIdentity:pinned.identity}};
}
async function offlineSelftests(output,bound){
 const proofs=[],test=async(name,fn)=>{await fn();proofs.push(name);};
 await test('Early setup failure cannot become full PASS',()=>{const p=makePlan();assert.equal(counts(p).notrun,p.length);assert.equal(counts(p).pass,0);});
 await test('First case failure preserves all unreached cases',()=>{const p=makePlan();Object.assign(p[0],{attempted:true,executed:true,status:'fail'});assert.equal(counts(p).fail,1);assert.equal(counts(p).notrun,p.length-1);assert.equal(counts(p).settled,1);});
 await test('Only exact canonical GET/main-frame/routed/known Firefox abort is expected',()=>{const r={requestId:1,url:targets[0],method:'GET',navigation:true,mainFrame:true,failure:'NS_ERROR_ABORT'},t={requestId:1,url:targets[0],routed:true};assert.ok(expectedAbort(r,t));for(const v of [{url:targets[0]+'?x'},{method:'POST'},{failure:'NS_ERROR_FAILURE'},{failure:'NS_BINDING_ABORTED'},{requestId:2},{navigation:false},{mainFrame:false}])assert.equal(expectedAbort({...r,...v},t),false);assert.equal(expectedAbort(r,{...t,routed:false}),false);assert.equal(expectedAbort(r,null),false);});
 await test('Output reuse and escape refused without overwriting evidence',async()=>{await assert.rejects(()=>freshOutput(output));await assert.rejects(()=>freshOutput(path.join(root,'dist','no-write')));});
 await test('Geometry detects overflow/font/clipping/occlusion/overlap',()=>{const g={overflow:{scroll:322,width:320},height:900,targets:[{label:'x',minWidth:24,minHeight:44,rect:{width:20,height:20,left:-2,right:400,top:0,bottom:20},hit:false}],overlap:[['x','y']],fonts:[{label:'input',size:16,floor:17}]};assert.equal(auditGeometry(g).length,6);});
 await test('Exact injected function faults only own key, preserving native foreign reads/writes',async()=>{
  const {runInNewContext}=await import('node:vm');
  for(const mode of ['read-boot','read-save','write','quota']){
   class FakeStorage{constructor(){this.map=new Map();}getItem(k){return this.map.get(k)??null;}setItem(k,v){this.map.set(k,String(v));}}
   const storage=new FakeStorage(),sandbox={location:{origin:'http://offline-harness'},window:{localStorage:storage},Storage:FakeStorage,DOMException,Reflect,Object};
   runInNewContext('('+storageObserver.toString()+')('+JSON.stringify({key:STORAGE_KEY,sentinels:Object.fromEntries(otherKeys.map(k=>[k,'{ RAW '+k+'\n'])),mode,initial:'original'})+')',sandbox);
   sandbox.window.__nativeObserver.arm();for(const k of otherKeys){assert.equal(storage.getItem(k),'{ RAW '+k+'\n');storage.setItem(k,'changed');assert.equal(storage.getItem(k),'changed');}
   if(mode.startsWith('read'))assert.throws(()=>storage.getItem(STORAGE_KEY));else assert.throws(()=>storage.setItem(STORAGE_KEY,'replaced'));assert.equal(sandbox.window.__nativeObserver.read(STORAGE_KEY),'original');
  }
 });
 await test('Real broad P60A search requires pagination; exact helper reaches null-weight row (offline page-boundary model)',async()=>{
  const rows=bound.catalogs[0].data.groups,found=filterEntries(rows,{query:'P60A'}),index=found.findIndex(g=>g.code==='P60A');
  assert.equal(found.length,rows.length);assert.ok(index>=30);assert.equal(found[index].weight,null);assert.equal(found.slice(0,30).some(g=>g.code==='P60A'),false);
  let limit=30;const card={count:async()=>Number(found.slice(0,limit).some(g=>g.code==='P60A'))};
  const page={locator:s=>{assert.equal(s,'#more');return {isVisible:async()=>limit<found.length};},getByRole:(role,options)=>{assert.equal(role,'button');assert.deepEqual(options,{name:'Mehr anzeigen',exact:true});return {click:async()=>{limit+=30;}};}};
  assert.equal(await revealByPagination(page,card),Math.floor(index/30));assert.equal(await card.count(),1);assert.equal(found[index],rows.find(g=>g.code==='P60A'));assert.equal(found[index].weight,null);
  await assert.rejects(()=>revealByPagination({locator:()=>({isVisible:async()=>false})},{count:async()=>0}),/pagination exhausted/);
  await assert.rejects(()=>revealByPagination(page,{count:async()=>2}),/exactly one/);
 });
 await test('Exact census excludes nonpainted closed-details links, includes all six open links, retains overlap and occlusion failures (native API model)',async()=>{
  const {runInNewContext}=await import('node:vm');let open=false,collision=false;
  // Native checkVisibility is modeled only at the external DOM boundary; this is not rendered-browser proof.
  const control=(id,x,y,disclosure=false)=>({id,textContent:id,contains:()=>false,closest:()=>null,checkVisibility:()=>!disclosure||open,getBoundingClientRect:()=>({left:collision&&id==='link5'?0:x,right:(collision&&id==='link5'?0:x)+100,top:collision&&id==='link5'?400:y,bottom:(collision&&id==='link5'?400:y)+44,width:100,height:44})});
  const links=Array.from({length:6},(_,i)=>control('link'+i,i%3*110,120+Math.floor(i/3)*60,true));
  const controls=[...Array.from({length:3},(_,i)=>control('direct'+i,i*110,0)),control('summary',0,60),...links,control('calculator',0,400)];
  const sandbox={innerWidth:768,innerHeight:900,getComputedStyle:()=>({visibility:'visible'}),document:{querySelector:()=>null,querySelectorAll:()=>controls,documentElement:{scrollWidth:768}}};
  const target={label:'calculator',rect:controls.at(-1).getBoundingClientRect(),minWidth:24,minHeight:44,hit:true};
  const collect=()=>runInNewContext('('+collectGeometry.toString()+')',sandbox)({target,fonts:[]});
  let g=collect();assert.equal(g.visibleControls.filter(s=>s.startsWith('link')).length,0);assert.equal(g.visibleControls.length,5);assert.deepEqual(Array.from(auditGeometry(g)),[]);
  open=true;g=collect();assert.equal(g.visibleControls.filter(s=>s.startsWith('link')).length,6);assert.deepEqual(Array.from(auditGeometry(g)),[]);
  collision=true;g=collect();assert.ok(auditGeometry(g).includes('overlap: link5 / calculator'));target.hit=false;assert.ok(auditGeometry(g).includes('calculator: occluded hit samples'));
  open=false;g=collect();assert.equal(g.overlap.length,0);assert.ok(auditGeometry(g).includes('calculator: occluded hit samples'));
 });
 await test('Unexpected warning fails diagnostic barrier',()=>{assert.throws(()=>assert.equal([{caseId:'x',channel:'console',type:'warning'}].filter(i=>i.caseId==='x').length,0));});
 return {kind:'offline-observer-selftests',browserLaunched:false,proofs};
}
async function main(){
 if(process.argv.includes('--list')){console.log(JSON.stringify({areas:names,plan:makePlan(),browserLaunched:false},null,2));return;}
 const output=await freshOutput(process.env.NATIVE_OUTPUT);
 const report={schema:3,kind:process.argv.includes('--selftest')?'offline-preflight':'native-firefox',output,started:stamp(),argv:process.argv,environmentNames:Object.keys(process.env).sort(),node:process.version,platform:{platform:process.platform,arch:process.arch,release:os.release()},browserLaunched:false,areas:names.map((name,i)=>({id:i+1,name})),plan:makePlan(),diagnostics:[],unexpected:[],artifacts:[],cleanup:[],limits:{navigation:'Nine actual canonical anchor activations intercepted before remote contact. Remote response/content availability NOT verified.',print:'Real application button to declared window.print boundary adapter + dispatched beforeprint/afterprint and native print-media DOM/CSS. NO native OS print dialog/spool claim.',authorization:'Authoring is not independent SPEC/QUALITY/Pages approval.'}};
 let seq=0,active=null,browser,server,setupOK=false,origin,url,bound;const contexts=new Set(),pending=new Set();
 const error=e=>({name:e?.name||'Error',message:String(e?.message||e),stack:e?.stack||null});
 const raw=(channel,data={})=>{const r={sequence:++seq,time:stamp(),caseId:active?.id||null,channel,...data};report.diagnostics.push(r);appendFileSync(path.join(output,'events.jsonl'),JSON.stringify(r)+'\n');return r;};
 const issue=(channel,data)=>{const r=raw(channel,data);report.unexpected.push(r);return r;};
 const onRejection=reason=>issue('node.unhandledRejection',{error:error(reason)});
 const onWarning=warning=>issue('node.warning',{error:error(warning)});
 const onUncaught=(e,origin)=>{issue('node.uncaughtException',{origin,error:error(e)});writeFileSync(path.join(output,'emergency-report.json'),JSON.stringify({...report,status:'native-fail-uncaught',counts:counts(report.plan)},null,2)+'\n');};
 process.on('unhandledRejection',onRejection);process.on('warning',onWarning);process.on('uncaughtExceptionMonitor',onUncaught);
 const track=(promise,label)=>{pending.add(promise);promise.catch(e=>issue('observer.async-error',{label,error:error(e)})).finally(()=>pending.delete(promise));return promise;};
 const flush=async()=>{while(pending.size)await Promise.allSettled([...pending]);};
 const artifact=async(file,kind,extra={})=>{const b=await readFile(file);const a={kind,file:path.relative(output,file),bytes:b.length,sha256:digest(b),...extra};report.artifacts.push(a);return a;};
 const unique=(name,ext)=>path.join(output,String(++seq).padStart(6,'0')+'-'+name.replace(/[^\w.-]+/g,'-')+'.'+ext);
 const capture=async(p,label)=>{if(p&&!p.isClosed())try{const file=unique(label,'png');await p.screenshot({path:file,fullPage:false});return await artifact(file,'viewport-screenshot',{caseId:active?.id,viewport:p.viewportSize(),url:p.url()});}catch(e){issue('screenshot.failure',{label,error:error(e)});}};
 const proof=(label,fn,evidence={})=>{assert.ok(active,'Assertions require declared case');const a={label,time:stamp(),status:'running',...evidence};active.assertions.push(a);try{fn();a.status='pass';}catch(e){a.status='fail';a.error=error(e);throw e;}};
 const eq=(label,a,b)=>proof(label,()=>assert.deepEqual(a,b),{actual:a,expected:b});
 const ok=(label,v)=>proof(label,()=>assert.ok(v),{actual:v});
 const match=(label,a,re)=>proof(label,()=>assert.match(a,re),{actual:a,pattern:String(re)});
 const checkpoint=async(id,fn)=>{const point=active.checkpoints?.find(p=>p.id===id);assert.ok(point,'Undeclared checkpoint '+id);Object.assign(point,{attempted:true,executed:true,status:'running',started:stamp()});raw('checkpoint.begin',{id});try{await fn();point.status='pass';}catch(e){point.status='fail';point.error=error(e);throw e;}finally{point.ended=stamp();raw('checkpoint.end',{id,status:point.status});}};
 const run=async(id,fn,deps=[])=>{
  const c=report.plan.find(c=>c.id===id);assert.ok(c,'Unknown case '+id);assert.equal(c.status,'notrun');
  if(deps.some(d=>report.plan.find(c=>c.id===d)?.status!=='pass')){c.reason='Dependency not passed: '+deps.join(', ');return;}
  active=c;Object.assign(c,{attempted:true,status:'running',started:stamp()});raw('case.begin',{id});
  try{c.executed=true;await fn();await flush();if(c.checkpoints)proof('Every predeclared checkpoint passed',()=>assert.ok(c.checkpoints.every(p=>p.status==='pass')));proof('No unexpected case diagnostic surfaces',()=>assert.equal(report.unexpected.filter(x=>x.caseId===id).length,0));c.status='pass';}
  catch(e){c.status='fail';c.error=error(e);for(const ctx of contexts)for(const p of ctx.pages())await capture(p,'FAIL-'+id);raw('case.failure',{id,error:error(e)});}
  finally{c.ended=stamp();raw('case.end',{id,status:c.status});active=null;}
 };
 let pageCounter=0,contextCounter=0,requestCounter=0;
 const pageIDs=new WeakMap(),requestIDs=new WeakMap(),navTokens=new WeakMap(),downloadTokens=new WeakMap(),dialogTokens=new WeakMap(),downloads=new WeakMap(),closingPages=new WeakSet();
 const closePage=async p=>{closingPages.add(p);await p.close();};
 const requestInfo=req=>{let id=requestIDs.get(req);if(!id){id=++requestCounter;requestIDs.set(req,id);}let p=null,mainFrame=false;try{p=req.frame().page();mainFrame=req.frame()===p.mainFrame();}catch{}return {requestId:id,pageId:pageIDs.get(p)||null,url:req.url(),method:req.method(),resourceType:req.resourceType(),navigation:req.isNavigationRequest(),mainFrame,postData:req.postData(),headers:req.headers()};};
 const monitorPage=(p,contextId)=>{
  if(pageIDs.has(p))return;const pageId=++pageCounter;pageIDs.set(p,pageId);raw('page.created',{contextId,pageId});
  p.on('console',m=>issue('console',{contextId,pageId,type:m.type(),text:m.text(),location:m.location()}));
  p.on('pageerror',e=>issue('pageerror',{contextId,pageId,error:error(e)}));
  p.on('crash',()=>issue('page.crash',{contextId,pageId}));p.on('close',()=>{const expected=closingPages.has(p);(expected?raw:issue)('page.close',{contextId,pageId,expected});});
  p.on('websocket',w=>issue('websocket',{contextId,pageId,url:w.url()}));p.on('worker',w=>issue('worker',{contextId,pageId,url:w.url()}));
  p.on('dialog',d=>{const token=dialogTokens.get(p);const r=raw('dialog',{contextId,pageId,type:d.type(),message:d.message(),defaultValue:d.defaultValue(),expected:Boolean(token)});track((async()=>{
   if(!token||d.type()!=='confirm'||!d.message().startsWith('Aktuelle lokale Zusammenstellung ersetzen?')){issue('dialog.unexpected',{record:r});await d.dismiss();return;}
   dialogTokens.delete(p);r.action=token.accept?'accept':'dismiss';await (token.accept?d.accept():d.dismiss());token.seen=r;raw('dialog.handled',{record:r});
  })(),'dialog');});
  p.on('download',d=>{const token=downloadTokens.get(p);downloadTokens.delete(p);const r=raw('download',{contextId,pageId,url:d.url(),suggestedFilename:d.suggestedFilename(),expected:Boolean(token)});
   const saved=(async()=>{try{const file=unique('download-'+d.suggestedFilename(),'bin');await d.saveAs(file);r.failure=await d.failure();r.artifact=await artifact(file,'native-download',{suggestedFilename:d.suggestedFilename(),url:d.url()});if(r.failure)throw Error(r.failure);if(!token)issue('download.unexpected',{record:r});raw('download.saved',{record:r});return {text:await readFile(file,'utf8'),record:r};}catch(e){r.error=error(e);issue('download.failure',{record:r});throw e;}})();downloads.set(d,saved);track(saved,'download');
  });
 };
 const checkSentinels=async ctx=>{for(const p of ctx.pages())if(!p.isClosed()&&p.url().startsWith(origin+'/')){const actual=await p.evaluate(()=>window.__nativeObserver.sentinels());raw('storage.foreign-native-readback',{pageId:pageIDs.get(p),expected:ctx.__sentinels,actual});try{assert.deepEqual(actual,ctx.__sentinels);}catch(e){issue('storage.foreign-mutation',{pageId:pageIDs.get(p),error:error(e)});throw e;}}};
 const closeContext=async ctx=>{
  if(!contexts.has(ctx))return;let status='pass';
  try{await checkSentinels(ctx);await flush();}catch(e){status='fail';issue('context.guard-cleanup-error',{contextId:ctx.__id,error:error(e)});}
  try{await ctx.tracing.stop({path:ctx.__trace});await artifact(ctx.__trace,'playwright-trace',{contextId:ctx.__id});}catch(e){status='fail';issue('context.trace-cleanup-error',{contextId:ctx.__id,error:error(e)});}
  try{ctx.__closing=true;for(const p of ctx.pages())closingPages.add(p);await ctx.close();await artifact(ctx.__har,'network-har',{contextId:ctx.__id});}catch(e){status='fail';issue('context.close-error',{contextId:ctx.__id,error:error(e)});}
  await flush();contexts.delete(ctx);report.cleanup.push({target:'context',contextId:ctx.__id,status,time:stamp()});
 };
 const newContext=async(options={})=>{
  const contextId=++contextCounter,har=unique('context-'+contextId,'har'),trace=unique('context-'+contextId,'zip');
  const ctx=await browser.newContext({viewport:{width:options.width||1440,height:900},acceptDownloads:true,serviceWorkers:'block',recordHar:{path:har,content:'embed',mode:'full'}});
  Object.assign(ctx,{__id:contextId,__har:har,__trace:trace,__sentinels:Object.fromEntries(otherKeys.map((k,i)=>[k,'RAW\u0000 '+i+' '+randomUUID()+'\n {not JSON}\r\n Ω '+k]))});contexts.add(ctx);
  ctx.on('page',p=>{monitorPage(p,contextId);if(!ctx.__creating)issue('page.unexpected-created',{contextId,pageId:pageIDs.get(p)});});ctx.on('close',()=>{(ctx.__closing?raw:issue)('context.close',{contextId,expected:Boolean(ctx.__closing)});});ctx.on('weberror',e=>issue('context.weberror',{contextId,error:error(e.error())}));ctx.on('serviceworker',w=>issue('context.serviceworker',{contextId,url:w.url()}));
  await ctx.exposeBinding('__observerEvent',({page},event)=>(event.type==='storage'?raw:issue)('window.event',{contextId,pageId:pageIDs.get(page),...event}));
  await ctx.addInitScript(()=>{addEventListener('storage',e=>window.__observerEvent({type:'storage',key:e.key,oldValue:e.oldValue,newValue:e.newValue,url:e.url}));addEventListener('error',e=>window.__observerEvent({type:'error',message:e.message,filename:e.filename,line:e.lineno,column:e.colno}));addEventListener('unhandledrejection',e=>window.__observerEvent({type:'unhandledrejection',reason:String(e.reason),stack:e.reason?.stack}));});
  await ctx.addInitScript(storageObserver,{key:STORAGE_KEY,sentinels:ctx.__sentinels,mode:options.mode||'none',initial:options.mode==='damaged'?'{broken RAW':null});
  ctx.on('request',r=>raw('request',{contextId,...requestInfo(r)}));ctx.on('requestfinished',r=>raw('requestfinished',{contextId,...requestInfo(r)}));
  ctx.on('response',res=>track((async()=>{const r=raw('response',{contextId,...requestInfo(res.request()),status:res.status(),statusText:res.statusText(),headers:await res.allHeaders(),fromServiceWorker:res.fromServiceWorker()});if(res.status()>=300)issue('http.unexpected-status',{record:r});})(),'response'));
  ctx.on('requestfailed',req=>{const r=requestInfo(req);let p;try{p=req.frame().page();}catch{}const token=navTokens.get(p);r.failure=req.failure()?.errorText||null;const expected=expectedAbort(r,token);raw('requestfailed',{contextId,...r,expectedNavigationAbort:expected});if(expected){token.failure=r;token.settle?.();}else issue('network.unexpected-failure',{contextId,...r});});
  await ctx.route('**/*',route=>track((async()=>{
   const req=route.request(),r=requestInfo(req);let p;try{p=req.frame().page();}catch{}const token=navTokens.get(p);
   if(token&&r.url===token.url&&r.method==='GET'&&r.navigation&&r.mainFrame&&!token.routed){token.routed=true;token.requestId=r.requestId;raw('navigation.intercept-before-contact',{contextId,...r,action:'abort(aborted)',remoteContact:false});await route.abort('aborted');return;}
   const allowed=new Set(Object.keys(runtimeFiles).map(p=>origin+'/spitaltarife/'+p));allowed.add(url);
   if(r.method==='GET'&&allowed.has(r.url)){raw('route.local-allow',{contextId,...r});await route.continue();return;}
   issue('route.unexpected-blocked-before-contact',{contextId,...r,remoteContact:false});await route.abort('blockedbyclient');
  })(),'route'));
  await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});return ctx;
 };
 const newPage=async ctx=>{ctx.__creating=(ctx.__creating||0)+1;try{const p=await ctx.newPage();monitorPage(p,ctx.__id);return p;}finally{ctx.__creating--;}};
 const ready=async p=>{
  await p.goto(url,{waitUntil:'load'});await p.waitForFunction(()=>document.body.dataset.ready==='true'||(!document.querySelector('#fatal').hidden&&!document.querySelector('#fatal').textContent.includes('wird geladen')));
  assert.equal(await p.locator('body').getAttribute('data-ready'),'true','Application did not activate');assert.equal(await p.locator('#fatal').isVisible(),false);
  const observed=await p.evaluate(async files=>{const out={};for(const destination of files){const r=await fetch('./'+destination);if(!r.ok)throw Error('Runtime HTTP '+r.status);const bytes=await r.arrayBuffer();out[destination]={bytes:bytes.byteLength,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')};}return out;},Object.keys(runtimeFiles));
  for(const [file,v] of Object.entries(observed)){assert.equal(v.sha256,bound.binding.runtime[file].sha256,'Served source identity differs: '+file);assert.equal(v.bytes,bound.binding.runtime[file].bytes);}
  raw('application.ready-source-bound',{pageId:pageIDs.get(p),runtime:observed,coverage:await p.locator('#coverage').innerText()});await checkSentinels(p.context());await flush();
 };
 const rawOwn=p=>p.evaluate(k=>window.__nativeObserver.read(k),STORAGE_KEY);
 const card=(p,code)=>p.locator('#results > article').filter({has:p.locator('h3').filter({hasText:new RegExp('^'+code+' ·')})});
 const inputJSON=async(p,input,data)=>{await p.locator(input).setInputFiles({name:'local.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await p.locator('#import-dialog').waitFor({state:'visible'});};
 const importCatalog=async(p,f)=>{await p.locator('#catalog-file').setInputFiles(f.file);await p.locator('#import-dialog').waitFor({state:'visible'});await p.getByRole('button',{name:'Übernehmen',exact:true}).click();await p.locator('#import-dialog').waitFor({state:'hidden'});};
 const fillDraft=async(p,d)=>{
  await p.selectOption('#calc-system',d.system);for(const f of ['label','edition','group','base','reference'])await p.fill('#calc-'+f,d[f]);
  if(d.system==='swissdrg')await p.fill('#calc-weight',d.weight);
  else{while(await p.locator('#segments > div').count()>1)await p.locator('#segments > div').last().getByRole('button',{name:'Abschnitt entfernen',exact:true}).click();while(await p.locator('#segments > div').count()<d.segments.length)await p.getByRole('button',{name:'ST-Reha-Phase ergänzen',exact:true}).click();for(let i=0;i<d.segments.length;i++)for(const f of ['days','weight'])await p.locator('#segments > div').nth(i).locator(`[data-field="${f}"]`).fill(d.segments[i][f]);}
 };
 const calculate=p=>p.getByRole('button',{name:'Szenario berechnen',exact:true}).click();
 const download=async(p,click)=>{assert.ok(!downloadTokens.has(p));downloadTokens.set(p,{});const awaited=p.waitForEvent('download');await click();const d=await awaited;const result=await downloads.get(d);assert.ok(result,'Download observer not attached');eq('Native download.failure',await d.failure(),null);return result.text;};
 const confirm=async(p,accept,click)=>{const token={accept};dialogTokens.set(p,token);const text=await download(p,click);await flush();ok('Actual confirm observed',Boolean(token.seen));eq('Actual confirm disposition',token.seen.action,accept?'accept':'dismiss');return text;};
 const inContext=async(fn,options={})=>{const ctx=await newContext(options);try{const p=await newPage(ctx);await ready(p);await fn(p,ctx);}catch(e){for(const p of ctx.pages())await capture(p,'FAIL-before-context-close');throw e;}finally{await closeContext(ctx);}};
 try{
  const helper=unique('observer-source','mjs');await writeFile(helper,await readFile(fileURLToPath(import.meta.url)));await artifact(helper,'observer-source');
  bound=await sourceBinding();report.source=bound.binding;
  // Predeclare every REAL detail row before any native work, not just a total after success.
  for(const f of bound.catalogs)report.plan.find(c=>c.id===f.key+'.rows').checkpoints=f.data.groups.map(g=>({id:g.code,fixture:f.key,status:'notrun',attempted:false,executed:false}));
  await writeFile(path.join(output,'plan.json'),JSON.stringify({areas:report.areas,plan:report.plan,sourceIdentity:report.source.identity},null,2)+'\n');await artifact(path.join(output,'plan.json'),'predeclared-plan');
  if(process.argv.includes('--selftest')){report.offlineSelftests=await offlineSelftests(output,bound);report.status='offline-pass-native-notrun';return;}
  assert.ok(process.env.PLAYWRIGHT_MODULE,'PLAYWRIGHT_MODULE must name an external Playwright ESM entrypoint');assert.ok(process.env.BROWSER_EXECUTABLE,'BROWSER_EXECUTABLE must name the parent-approved native Firefox/Camoufox executable');
  await build();for(const [d,b] of Object.entries(bound.binding.runtime))assert.equal(digest(await readFile(path.join(root,'dist',d))),b.sha256);
  server=createAppServer({root:path.join(root,'dist'),basePath:'/spitaltarife/'});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin=`http://127.0.0.1:${server.address().port}`;url=origin+'/spitaltarife/';report.localURL=url;
  const mod=await import(path.isAbsolute(process.env.PLAYWRIGHT_MODULE)?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:process.env.PLAYWRIGHT_MODULE);
  browser=await mod.firefox.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});report.browserLaunched=true;report.browser={version:browser.version(),executable:process.env.BROWSER_EXECUTABLE,module:process.env.PLAYWRIGHT_MODULE};browser.on('disconnected',()=>{if(report.closingBrowser)raw('browser.disconnected',{cleanup:true});else issue('browser.unexpected-disconnected',{});});setupOK=true;
  await inContext(async(p,ctx)=>{
   await run('public.scope',async()=>{eq('Three public profiles',await p.locator('#results > article').count(),3);eq('Four own notes',await p.locator('#notes-content details').count(),4);match('Hosted/private scope',await p.locator('#coverage').innerText(),/0 öffentlich gehostete.*1135/);for(const n of bound.publicData.notes){const d=p.locator('#notes-content details').filter({has:p.locator('summary').filter({hasText:n.title})});await d.locator('summary').click();eq('Whole public note '+n.title,await d.locator('p').textContent(),n.text);await d.locator('summary').click();}});
   await run('public.sources',async()=>{for(const e of [...bound.provenance.recovered.artifacts,...bound.provenance.recovered.evidence]){const d=p.locator('#source-content details').filter({has:p.locator('summary').filter({hasText:e.file})});await d.locator('summary').click();eq(e.file+' original URL',await d.locator('a').nth(0).getAttribute('href'),e.original_url);eq(e.file+' snapshot URL',await d.locator('a').nth(1).getAttribute('href'),e.url);const text=await d.innerText();for(const token of [e.sha256,String(e.bytes),e.snapshot_timestamp,e.retrieved_at])ok(e.file+' source metadata '+token,text.includes(token));if(e.validity)ok(e.file+' complete validity declaration',text.includes(typeof e.validity==='object'?JSON.stringify(e.validity):e.validity));await d.locator('summary').click();}const text=await p.locator('#source-content').innerText();match('Rights permission unresolved',text,/Genehmigung/);match('Actual PV2 title retained',text,/PV2.*2025.*2026/);});
   await run('public.links',async()=>{const links=await p.locator('.catalog-switch a,.catalog-directory a').evaluateAll(a=>a.map(a=>({href:a.href,target:a.getAttribute('target'),download:a.hasAttribute('download'),onclick:a.getAttribute('onclick')})));eq('Nine canonical unique targets',links.map(x=>x.href).sort(),targets);ok('Normal same-window anchors',links.every(x=>!x.target&&!x.download&&!x.onclick));eq('Three direct',await p.locator('.catalog-switch a').count(),3);eq('Six disclosure',await p.locator('.catalog-directory a').count(),6);eq('One current',await p.locator('[aria-current="page"]').count(),1);eq('Own current href',await p.locator('[aria-current="page"]').getAttribute('href'),'https://wakuwakumiwaku.github.io/spitaltarife/');const s=p.locator('.catalog-directory summary');await s.focus();await p.keyboard.press('Enter');eq('Native disclosure Enter opens',await p.locator('.catalog-directory').getAttribute('open'),'');await p.keyboard.press('Space');eq('Native disclosure Space closes',await p.locator('.catalog-directory').getAttribute('open'),null);});
   for(const [i,target] of targets.entries())await run('nav.'+i,async()=>{const q=await newPage(ctx);let timer;try{await ready(q);await q.locator('.catalog-directory summary').click();const a=q.locator(`a[href="${target}"]`);await a.focus();eq('Focused actual anchor',await q.evaluate(()=>document.activeElement.href),target);const token={url:target,routed:false};const settled=new Promise(resolve=>token.settle=resolve);navTokens.set(q,token);await a.press('Enter',{noWaitAfter:true});await Promise.race([settled,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Expected exact native navigation abort absent')),10000);})]);ok('Intercepted before remote contact',token.routed);ok('Known exact native abort settled',Boolean(token.failure));raw('navigation.intent-verified',{target,token:{...token,settle:undefined},remoteContentVerified:false});}finally{clearTimeout(timer);navTokens.delete(q);await closePage(q);}});
  });
  for(const f of bound.catalogs)await inContext(async p=>{
   await run(f.key+'.import',async()=>{const before=await rawOwn(p);await p.locator('#catalog-file').setInputFiles(f.file);await p.locator('#import-dialog').waitFor({state:'visible'});ok('Complete actual preview count',(await p.locator('#import-content').innerText()).includes(String(f.data.groups.length)));eq('Preview no persist',await rawOwn(p),before);await p.getByRole('button',{name:'Abbrechen',exact:true}).click();eq('Catalog cancel keeps own raw',await rawOwn(p),before);eq('Cancel no RAM install',await p.locator('#results > article').count(),3);await importCatalog(p,f);eq('Import RAM only',await rawOwn(p),before);const bad=structuredClone(f.data);bad.groups[0].weight={invalid:true};await p.locator('#catalog-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await p.waitForFunction(()=>document.querySelector('#storage-status').textContent.includes('Datei nicht übernommen'));eq('Bad catalog whole rejection/no write',await rawOwn(p),before);ok('Previous complete catalog retained',(await p.locator('#local-status').innerText()).includes(f.data.edition));});
   await run(f.key+'.rows',async()=>{while(await p.locator('#more').isVisible())await p.getByRole('button',{name:'Mehr anzeigen',exact:true}).click();eq('All real groups plus profiles',await p.locator('#results > article').count(),f.data.groups.length+3);
    for(const g of f.data.groups)await checkpoint(g.code,async()=>{const c=card(p,g.code);eq(f.key+'/'+g.code+' unique row',await c.count(),1);eq(g.code+' whole row title',await c.locator('h3').innerText(),g.code+' · '+g.title);try{await c.getByRole('button',{name:'Details öffnen',exact:true}).click();eq(g.code+' whole detail title',await p.locator('#detail-title').innerText(),g.code+' · '+g.title);ok(g.code+' complete untruncated notes',(await p.locator('#detail-content p').allTextContents()).includes(g.notes));eq(g.code+' all detail fields',await p.locator('#detail-content dd').allTextContents(),[bound.publicData.systems.find(s=>s.id===f.data.system).title,f.data.edition,f.data.validFrom+' bis '+f.data.validTo,g.weight??'Nicht hinterlegt / Tageslogik extern bestimmen',f.data.coverage.kind+' · '+f.data.coverage.scope,f.data.source.sha256]);eq(g.code+' original source URL',await p.locator('#detail-content a').getAttribute('href'),f.data.source.url);}catch(e){await capture(p,'FAIL-row-'+g.code);throw e;}finally{if(await p.locator('#detail-dialog').getAttribute('open')!==null)await p.getByRole('button',{name:'Details schliessen',exact:true}).click();}});
   },[f.key+'.import']);
   await run(f.key+'.search',async()=>{const last=f.data.groups.at(-1);await p.click('#reset');await p.fill('#search',last.code);eq('Global final row beyond first page',await card(p,last.code).count(),1);await p.fill('#search','no-match-impossible-xyz');eq('No match',await p.locator('#results > article').count(),0);await p.click('#reset');eq('Reset pagination',await p.locator('#results > article').count(),Math.min(30,f.data.groups.length+3));await p.selectOption('#system-filter',f.data.system);match('System filters complete loaded rows',await p.locator('#result-count').innerText(),new RegExp('^'+(f.data.groups.length+1)+' von'));await p.check('#favorites-filter');eq('Ungemerkte system filter',await p.locator('#results > article').count(),0);await p.click('#reset');await p.click('#catalog-clear');eq('Close RAM catalog',await p.locator('#results > article').count(),3);},[f.key+'.import']);
  });
  for(const c of bound.oracle.cases)await run('price.'+c.key,()=>inContext(async p=>{const f=bound.catalogs.find(f=>f.key===c.key);await importCatalog(p,f);await p.fill('#search',c.draft.group);await card(p,c.draft.group).getByRole('button',{name:'Details öffnen',exact:true}).click();await p.getByRole('button',{name:'In Rechner übernehmen',exact:true}).click();if(c.draft.system==='swissdrg')eq('Actual source weight transferred',await p.inputValue('#calc-weight'),String(Number(c.draft.weight)));await fillDraft(p,c.draft);await calculate(p);eq('Raw-source Decimal exact price',await p.locator('#calc-result strong').innerText(),c.money);if(c.draft.system==='tarpsy'){eq('No TARPSY phase add',await p.locator('#segment-add').isVisible(),false);eq('Exactly one TARPSY duration row',await p.locator('#segments > div').count(),1);match('TARPSY not phase sum',await p.locator('#daily-method').innerText(),/keine Phasensumme/);}if(c.draft.system==='st-reha'){eq('Three ST Reha phases',await p.locator('#segments > div').count(),3);match('Reha phase sum',await p.locator('#calc-result').innerText(),/Summe \(Tage je Phase/);}}));
  await run('price.missing-zero',()=>inContext(async p=>{await fillDraft(p,bound.oracle.cases[0].draft);await importCatalog(p,bound.catalogs[0]);eq('Pinned real P60A has unknown weight',bound.catalogs[0].data.groups.find(g=>g.code==='P60A').weight,null);await p.fill('#search','P60A');const paginationClicks=await revealByPagination(p,card(p,'P60A'));raw('price.real-target-pagination',{code:'P60A',paginationClicks});await card(p,'P60A').getByRole('button',{name:'Details öffnen',exact:true}).click();match('Real unweighted row',await p.locator('#detail-content').innerText(),/nicht abrechenbar/);await p.getByRole('button',{name:'In Rechner übernehmen',exact:true}).click();eq('Missing weight remains blank',await p.inputValue('#calc-weight'),'');await calculate(p);match('Missing refuses price',await p.locator('#calc-result').innerText(),/Nicht berechnet/);await p.fill('#calc-weight','0');await calculate(p);eq('Explicit manual zero',await p.locator('#calc-result strong').innerText(),'CHF 0.00');}));
  await inContext(async p=>{
   let before;
   await run('state.download',async()=>{await importCatalog(p,bound.catalogs[0]);await fillDraft(p,bound.oracle.cases[0].draft);await p.click('#scenario-save');before=await rawOwn(p);eq('One saved scenario',JSON.parse(before).scenarios.length,1);const exported=await download(p,()=>p.click('#workspace-export'));eq('Downloaded workspace matches storage',validateWorkspace(JSON.parse(exported)),JSON.parse(before));ok('Private notes excluded',!exported.includes('Alle Quellfelder'));});
   await run('state.preview-cancel',async()=>{await p.fill('#calc-label','Unstored draft preserved');await inputJSON(p,'#workspace-file',emptyWorkspace());eq('Workspace preview no mutation',await rawOwn(p),before);await p.click('#import-cancel');eq('Workspace cancel no mutation',await rawOwn(p),before);eq('Draft retained',await p.inputValue('#calc-label'),'Unstored draft preserved');},['state.download']);
   await run('state.confirm-cancel',async()=>{await inputJSON(p,'#workspace-file',emptyWorkspace());const original=await confirm(p,false,()=>p.click('#import-apply'));eq('Rejected-confirm backup exact raw',original,before);eq('Confirm cancel retains raw',await rawOwn(p),before);eq('Preview remains after confirm rejection',await p.locator('#import-dialog').isVisible(),true);await p.click('#import-cancel');},['state.preview-cancel']);
   await run('state.apply',async()=>{await inputJSON(p,'#workspace-file',emptyWorkspace());const original=await confirm(p,true,()=>p.click('#import-apply'));eq('Accepted-confirm backup exact raw',original,before);eq('Confirmed replacement',JSON.parse(await rawOwn(p)),emptyWorkspace());eq('Unstored draft survives replacement',await p.inputValue('#calc-label'),'Unstored draft preserved');},['state.confirm-cancel']);
   await run('state.bad-reload',async()=>{const own=await rawOwn(p);await p.locator('#workspace-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...emptyWorkspace(),extra:'reject'}))});await p.waitForFunction(()=>document.querySelector('#storage-status').textContent.includes('nicht übernommen'));eq('Bad workspace whole rejection',await rawOwn(p),own);await ready(p);eq('Reload actual persisted workspace',await rawOwn(p),own);eq('RAM groups absent after reload',await p.locator('#results > article').count(),3);eq('RAM status reset',await p.locator('#local-status').innerText(),'Kein lokaler Katalog geladen.');},['state.apply']);
  });
  await run('storage.two-tabs',()=>inContext(async(p,ctx)=>{await fillDraft(p,bound.oracle.cases[0].draft);await p.fill('#calc-label','Cross-tab draft');const foreign=await newPage(ctx);try{await ready(foreign);const foreignRaw=JSON.stringify({...emptyWorkspace(),favorites:['tarpsy']});await foreign.evaluate(([k,v])=>localStorage.setItem(k,v),[STORAGE_KEY,foreignRaw]);await p.waitForFunction(()=>document.querySelector('#storage-status').textContent.includes('geschützt'));await p.click('#scenario-save');eq('Foreign own change not overwritten',await rawOwn(p),foreignRaw);eq('Two-tab draft retained',await p.inputValue('#calc-label'),'Cross-tab draft');await checkSentinels(ctx);}finally{await closePage(foreign);}}));
  for(const mode of ['damaged','read-boot','read-save','write','quota'])await run('storage.'+mode,()=>inContext(async(p,ctx)=>{
   const original=await rawOwn(p);await fillDraft(p,bound.oracle.cases[0].draft);await p.fill('#calc-label','Retained draft');if(mode!=='damaged'&&mode!=='read-boot')await p.evaluate(()=>window.__nativeObserver.arm());await p.click('#scenario-save');match('Fault protects original/reports failure',await p.locator('#storage-status').innerText(),/geschützt|fehlgeschlagen|nicht lesbar/);eq('Fault retains exact original raw',await rawOwn(p),original);eq('Fault retains draft',await p.inputValue('#calc-label'),'Retained draft');const state=await p.evaluate(()=>window.__nativeObserver.state);raw('storage.exact-own-key-fault-counters',{mode,state});if(mode==='damaged'){eq('Malformed original retained',original,'{broken RAW');eq('Corruption is not injected accessor fault',state.faults,{get:0,set:0});}else eq('Exact own fault count',state.faults,mode.startsWith('read')?{get:1,set:0}:{get:0,set:1});await checkSentinels(ctx);const draft=await download(p,()=>p.click('#draft-export'));eq('Draft rescue download',validateWorkspace(JSON.parse(draft)).scenarios[0].label,'Retained draft');if(original!==null){const rescued=await download(p,()=>p.click('#raw-export'));eq('Corrupt original rescue bytes',rescued,original);}
  },{mode}));
  const geometry=async(p,label,selectors,fontSelectors=[])=>{
   let measured=0;
   for(const selector of selectors){const loc=p.locator(selector).first();if(!await loc.isVisible())continue;await loc.scrollIntoViewIfNeeded();await capture(p,label+'-target');const target=await loc.evaluate((el,label)=>{const r=el.getBoundingClientRect();return {label,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},minHeight:el.matches('a,button,summary,input:not([type="checkbox"]),select,textarea')?44:24,minWidth:24,hit:[[.5,.5],[.2,.2],[.8,.2],[.2,.8],[.8,.8]].every(([x,y])=>{const h=document.elementFromPoint(r.left+r.width*x,r.top+r.height*y);return h&&(h===el||el.contains(h)||h.closest('label')?.contains(el));})};},selector);measured++;
    const g=await p.evaluate(collectGeometry,{target,fonts:fontSelectors});raw('responsive.geometry',{label,pageId:pageIDs.get(p),geometry:g});report.maxOverflowPx=Math.max(report.maxOverflowPx||0,g.overflow.scroll-g.overflow.width);eq(label+' geometry/fonts/overflow '+selector,auditGeometry(g),[]);
   }ok(label+' actual targets measured',measured>0);return measured;
  };
  for(const width of [1440,768,390,320])await run('responsive.'+width,()=>inContext(async p=>{
   await importCatalog(p,bound.catalogs[0]);await fillDraft(p,bound.oracle.cases[0].draft);await calculate(p);
   const summary=p.locator('.catalog-directory summary');
   await checkpoint('menu-closed',async()=>{await summary.scrollIntoViewIfNeeded();await capture(p,width+'-menu-closed');eq('Native menu initially closed',await p.locator('.catalog-directory').getAttribute('open'),null);eq('Closed disclosure has no rendered anchors',await p.locator('.catalog-directory a:visible').count(),0);eq('Three direct anchors and closed summary measured',await geometry(p,width+'-menu-closed',['.catalog-switch a:nth-child(1)','.catalog-switch a:nth-child(2)','.catalog-switch a:nth-child(3)','.catalog-directory summary']),4);});
   await checkpoint('menu-open',async()=>{await summary.focus();await p.keyboard.press('Enter');await capture(p,width+'-menu-open');eq('Keyboard native menu open',await p.locator('.catalog-directory').getAttribute('open'),'');eq('Open disclosure has six rendered anchors',await p.locator('.catalog-directory a:visible').count(),6);eq('All six actual open anchors measured',await geometry(p,width+'-menu-open',Array.from({length:6},(_,i)=>`.catalog-directory nav a:nth-child(${i+1})`)),6);await summary.focus();await p.keyboard.press('Space');});
   await checkpoint('rows',async()=>{await p.locator('#results > article').nth(3).scrollIntoViewIfNeeded();await capture(p,width+'-actual-catalog-rows');await geometry(p,width+'-rows',['#results > article:nth-child(4) button'],[['#results h3',18]]);});
   await checkpoint('calculator',async()=>{await p.locator('#calc-base').scrollIntoViewIfNeeded();await capture(p,width+'-populated-calculator-fields');await geometry(p,width+'-calculator',['#calc-base','#calc-weight','#calc-reference','#calc-form button[type="submit"]'],[['#calc-form input:not([type="file"]),#calc-form select,#calc-form textarea',17]]);});
   await checkpoint('money',async()=>{await p.locator('#calc-result').scrollIntoViewIfNeeded();await capture(p,width+'-actual-money');eq('Responsive actual source price',await p.locator('#calc-result strong').innerText(),bound.oracle.cases[0].money);const fonts=await p.locator('#calc-result,#calc-result strong').evaluateAll(els=>els.map(el=>({id:el.id||el.tagName,size:parseFloat(getComputedStyle(el).fontSize),family:getComputedStyle(el).fontFamily})));raw('responsive.money-fonts',{width,fonts});ok('Money output and strong at least 18px',fonts.every(f=>f.size>=18));});
   const longest=bound.catalogs[0].data.groups.reduce((a,b)=>b.notes.length+b.title.length>a.notes.length+a.title.length?b:a);
   await checkpoint('detail-top',async()=>{await p.fill('#search',longest.code);const b=card(p,longest.code).getByRole('button',{name:'Details öffnen',exact:true});await b.focus();await p.keyboard.press('Enter');await p.locator('#detail-title').scrollIntoViewIfNeeded();await capture(p,width+'-long-detail-top');eq('Long real source detail title',await p.locator('#detail-title').innerText(),longest.code+' · '+longest.title);ok('Long full real notes',(await p.locator('#detail-content p').allTextContents()).includes(longest.notes));await geometry(p,width+'-detail-top',['#detail-close'],[['#detail-title',17]]);});
   await checkpoint('detail-bottom',async()=>{await p.locator('#detail-content a').scrollIntoViewIfNeeded();await capture(p,width+'-long-detail-source-bottom');eq('Long detail source',await p.locator('#detail-content a').getAttribute('href'),bound.catalogs[0].data.source.url);await p.getByRole('button',{name:'In Rechner übernehmen',exact:true}).scrollIntoViewIfNeeded();await capture(p,width+'-detail-bottom-action');await geometry(p,width+'-detail-bottom',['#detail-content button']);await p.keyboard.press('Escape');await p.locator('#detail-dialog').waitFor({state:'hidden'});});
   await checkpoint('sources',async()=>{await p.locator('#sources').scrollIntoViewIfNeeded();await capture(p,width+'-sources');});
   await checkpoint('file-form',async()=>{await p.locator('#catalog-file').scrollIntoViewIfNeeded();await capture(p,width+'-native-file-input');await geometry(p,width+'-file-form',['#catalog-file'],[['input[type="file"]',17]]);});
  },{width}));
  await run('print.boundary',()=>inContext(async p=>{
   await fillDraft(p,bound.oracle.cases[0].draft);await calculate(p);
   // Deliberate boundary adapter. NO native OS print invocation; no product method/renderer replacement.
   await p.evaluate(()=>{window.__printBoundary={calls:0,events:[]};addEventListener('beforeprint',()=>window.__printBoundary.events.push('beforeprint'));addEventListener('afterprint',()=>window.__printBoundary.events.push('afterprint'));window.print=()=>{window.__printBoundary.calls++;dispatchEvent(new Event('beforeprint'));dispatchEvent(new Event('afterprint'));};});raw('print.boundary-adapter-installed',{beforeprint:'adapter dispatch into actual app listener',afterprint:'adapter dispatch',osSpool:false});await p.getByRole('button',{name:'Drucken',exact:true}).click();eq('Actual print button call/events',await p.evaluate(()=>window.__printBoundary),{calls:1,events:['beforeprint','afterprint']});eq('Beforeprint independent source price',await p.locator('#calc-result strong').innerText(),bound.oracle.cases[0].money);await p.emulateMedia({media:'print'});await p.locator('#calc-result').scrollIntoViewIfNeeded();await capture(p,'print-css-populated-calculator');eq('Native print media white body',await p.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(255, 255, 255)');eq('Print hides nav',await p.locator('.catalog-switch').evaluate(el=>getComputedStyle(el).display),'none');eq('Print DOM retains price',await p.locator('#calc-result strong').innerText(),bound.oracle.cases[0].money);eq('Native print matchMedia',await p.evaluate(()=>matchMedia('print').matches),true);await p.emulateMedia({media:'screen'});
  }));
 }catch(e){report.setupOrFatalError=error(e);issue(setupOK?'suite.fatal':'setup.failure',{error:error(e)});for(const ctx of contexts)for(const p of ctx.pages())await capture(p,'FATAL');}
 finally{
  for(const ctx of [...contexts])await closeContext(ctx);await flush();
  if(browser){report.closingBrowser=true;try{await browser.close();report.cleanup.push({target:'browser',status:'pass'});}catch(e){report.cleanup.push({target:'browser',status:'fail',error:error(e)});issue('browser.close-failure',{error:error(e)});}}
  if(server)try{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));report.cleanup.push({target:'server',status:'pass'});}catch(e){report.cleanup.push({target:'server',status:'fail',error:error(e)});issue('server.close-failure',{error:error(e)});}
  for(const c of report.plan){if(c.status==='notrun'&&!c.reason)c.reason=report.kind==='offline-preflight'?'Native execution explicitly not requested (--selftest)':'Setup/fatal failure or unreached dependency; not executed';if(c.checkpoints){for(const point of c.checkpoints)if(point.status==='notrun')point.reason=c.reason||'Unreached after case failure';c.checkpointCounts=counts(c.checkpoints);}}
  report.checkpointCounts=counts(report.plan.flatMap(c=>c.checkpoints||[]));report.realRowCounts=counts(report.plan.filter(c=>c.id.endsWith('.rows')).flatMap(c=>c.checkpoints||[]));
  report.counts=counts(report.plan);report.areaCounts=names.map((_,i)=>({area:i+1,...counts(report.plan.filter(c=>c.area===i+1))}));report.assertionCounts={pass:report.plan.flatMap(c=>c.assertions).filter(a=>a.status==='pass').length,fail:report.plan.flatMap(c=>c.assertions).filter(a=>a.status==='fail').length};report.ended=stamp();
  process.off('unhandledRejection',onRejection);process.off('warning',onWarning);process.off('uncaughtExceptionMonitor',onUncaught);
  if(report.kind!=='offline-preflight')report.status=setupOK&&!report.setupOrFatalError&&report.counts.pass===report.counts.registered&&report.unexpected.length===0&&report.cleanup.every(c=>c.status==='pass')?'native-pass':'native-fail';else if(report.setupOrFatalError)report.status='offline-fail-native-notrun';
  if(report.kind==='offline-preflight'&&report.unexpected.length)report.status='offline-fail-native-notrun';
  const eventFile=path.join(output,'events.jsonl');try{await artifact(eventFile,'raw-events');}catch(e){if(e.code!=='ENOENT')throw e;}
  const file=path.join(output,'report.json');await writeFile(file,JSON.stringify(report,null,2)+'\n');const sha256=digest(await readFile(file));await writeFile(path.join(output,'report.sha256'),sha256+'  report.json\n');console.log(JSON.stringify({status:report.status,report:file,sha256,counts:report.counts,browserLaunched:report.browserLaunched},null,2));if(report.status.includes('fail'))process.exitCode=1;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
