import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {emptyDraft,calculate,validateCatalog,validateWorkspace,emptyWorkspace,validatePublicData} from "../src/domain.js";
test("TARPSY accepts exactly one stay-wide applicable weight, rejects phase sum including saved imports",()=>{
 const d={...emptyDraft(),system:"tarpsy",base:"1000",segments:[{days:"43",weight:"1.065"}]};
 assert.equal(calculate(d).weight,45795000n);
 d.segments.push({days:"1",weight:"1"}); assert.throws(()=>calculate(d),/TARPSY/);
 assert.throws(()=>validateWorkspace({...emptyWorkspace(),scenarios:[{...d,label:"Invalid phase sum"}]}),/TARPSY/);
});
test("explicit zero remains zero, missing remains unknown; canonical JSON-schema decimal pattern",async()=>{
 const schema=JSON.parse(await readFile(new URL('../public/data/local-catalog.schema.json',import.meta.url)));
 const pattern=new RegExp(schema.properties.groups.items.properties.weight.pattern);
 for (const value of ["0","0.000001","1.25"]) assert.ok(pattern.test(value));
 for (const value of ["1x25","1e2","1,25"]) assert.ok(!pattern.test(value));
 const c={app:"spitaltarife.catalog",version:1,system:"swissdrg",edition:"SYNTHETIC VALIDATOR ONLY",validFrom:"2026-01-01",validTo:"2026-12-31",source:{url:"https://example.invalid/",sha256:"a".repeat(64),rights:"local-only"},coverage:{kind:"subset",scope:"Validation only"},groups:[{code:"TEST",title:"Test",weight:"0",notes:"Not a tariff"}]};
 assert.equal(validateCatalog(c).groups[0].weight,"0");
 assert.equal(calculate({...emptyDraft(),base:"1000",weight:"0"}).cents,0n);
 c.groups[0].weight=null;assert.equal(validateCatalog(c).groups[0].weight,null);
 assert.throws(()=>calculate({...emptyDraft(),base:"1000"}));
});
test("recovered metadata corrupted count, rights, URL, bytes, source and fields fail closed",async()=>{
 const values=await Promise.all(["catalog","provenance","import-report"].map(n=>readFile(new URL('../public/data/'+n+'.json',import.meta.url)).then(JSON.parse)));
 for(const fn of [m=>m.private_main_rows=1134,m=>m.hosted_groups=1,m=>m.settings.tarpsy=23,m=>m.artifacts[0].public_reuse_authorized=true,m=>m.artifacts[0].url="https://example.invalid/",m=>m.artifacts[0].bytes="1",m=>m.artifacts[0].sha256="wrong",m=>m.artifacts[0].extra=true]){
  const d=structuredClone(values);fn(d[1].recovered);assert.throws(()=>validatePublicData(...d));
 }
});
// Literal source contract, not computed CSS or a rendered pixel proof.
async function dialogTitleDeclarations(){
 const css=(await readFile(new URL('../src/styles.css',import.meta.url),'utf8')).replace(/\/\*[\s\S]*?\*\//g,'');
 const body=css.match(/(?:^|\})\s*\.dialog-top\s*>\s*h2\s*\{([^{}]*)\}/)?.[1]||'';
 return new Map(body.split(';').filter(s=>s.trim()).map(s=>s.split(':').map(v=>v.trim())));
}
for(const [property,value,reason] of [
 ['min-width','0','release the flex-item automatic minimum'],
 ['max-width','100%','bound the title to the inner dialog width'],
 ['overflow-wrap','anywhere','wrap original long source words without shortening'],
]) test(`PIX-001 dialog title: ${reason}`,async()=>{
 assert.equal((await dialogTitleDeclarations()).get(property),value,`PIX-001: .dialog-top > h2 needs ${property}: ${value}`);
});
test("PIX-001 dialog title rule changes only shrink/wrap, not font or visibility",async()=>{
 assert.deepEqual([...(await dialogTitleDeclarations()).keys()].sort(),['max-width','min-width','overflow-wrap']);
});

// SP8-CLOSE: limited source cascade, not computed layout, hit testing or native proof.
function sp8ScreenRules(css, width) {
 const rules=[];
 function walk(text, active) {
  let start=0;
  while(start<text.length) {
   const open=text.indexOf('{',start);
   if(open<0){assert.equal(text.slice(start).trim(),'');break;}
   const prelude=text.slice(start,open).trim();
   let depth=1,end=open+1;
   while(end<text.length&&depth){if(text[end]==='{')depth++;if(text[end]==='}')depth--;end++;}
   assert.equal(depth,0,'balanced source CSS');
   const body=text.slice(open+1,end-1);
   if(prelude.startsWith('@')) {
    const max=prelude.match(/^@media\s*\(max-width:\s*(\d+)px\)$/);
    assert.ok(max||prelude==='@media print',`unsupported source at-rule: ${prelude}`);
    walk(body,active&&!!max&&width<=Number(max?.[1]));
   } else if(active) {
    const declarations=body.split(';').filter(v=>v.trim()).map(v=>{
     const colon=v.indexOf(':');assert.ok(colon>0,'source declaration');
     return [v.slice(0,colon).trim(),v.slice(colon+1).trim()];
    });
    for(const selector of prelude.split(','))rules.push({selector:selector.trim(),declarations});
   }
   start=end;
  }
 }
 walk(css.replace(/\/\*[\s\S]*?\*\//g,''),true);
 return rules;
}
function sp8Matches(selector, node) {
 const parts=selector.replace(/\s*>\s*/g,' > ').trim().split(/\s+/);
 function simple(part,n) {
  if(!n)return false;
  if(part==='*')return true;
  if(part===':root')return n.tag==='html';
  if(!/^(?:[a-z][a-z0-9-]*)?(?:[.#][a-zA-Z0-9_-]+)*$/.test(part))return false;
  const tag=part.match(/^[a-z][a-z0-9-]*/)?.[0];
  if(tag&&tag!==n.tag)return false;
  for(const m of part.matchAll(/([.#])([a-zA-Z0-9_-]+)/g))
   if(m[1]==='#'?n.id!==m[2]:!n.classes?.includes(m[2]))return false;
  return true;
 }
 function match(i,n) {
  if(i<0)return true;
  if(!simple(parts[i],n))return false;
  if(i===0)return true;
  if(parts[i-1]==='>')return match(i-2,n.parent);
  for(let p=n.parent;p;p=p.parent)if(match(i-1,p))return true;
  return false;
 }
 return match(parts.length-1,node);
}
function sp8SourceStyle(rules,node) {
 const winners=new Map();
 for(const [order,{selector,declarations}] of rules.entries()) {
  if(!sp8Matches(selector,node))continue;
  const ids=(selector.match(/#[\w-]+/g)||[]).length;
  const classes=(selector.match(/\.[\w-]+|:root/g)||[]).length;
  const tags=selector.replace(/#[\w-]+|\.[\w-]+|:root/g,'').split(/[\s>]+/).filter(s=>s&&s!=='*').length;
  for(const [property,raw] of declarations) {
   const important=/\s*!important$/.test(raw);
   const value=raw.replace(/\s*!important$/,'');
   const rank=[Number(important),ids,classes,tags,order];
   const old=winners.get(property);
   const comparison=old?rank.map((v,i)=>v-old.rank[i]).find(v=>v!==0):1;
   if(!old||comparison>=0)winners.set(property,{rank,value});
  }
 }
 return Object.fromEntries([...winners].map(([k,v])=>[k,v.value]));
}
async function sp8SourceHeader(width) {
 const css=await readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const root={tag:'html'},body={tag:'body',parent:root};
 const dialog={tag:'dialog',id:'detail-dialog',parent:body};
 const header={tag:'div',classes:['dialog-top'],parent:dialog};
 const title={tag:'h2',id:'detail-title',parent:header};
 const close={tag:'button',id:'detail-close',parent:header};
 const rules=sp8ScreenRules(css,width);
 return {css,html,root:sp8SourceStyle(rules,root),dialog:sp8SourceStyle(rules,dialog),header:sp8SourceStyle(rules,header),title:sp8SourceStyle(rules,title),close:sp8SourceStyle(rules,close)};
}
for(const width of [320,390])test(`SP8-CLOSE source cascade ${width}: close precedes full-width heading`,async()=>{
 const {header,title,close}=await sp8SourceHeader(width);
 assert.equal(header.display,'flex');assert.equal(header['flex-wrap'],'wrap');
 assert.ok(Number(title.order||0)>Number(close.order||0),'SP8-CLOSE: close must precede the long heading in the narrow flex layout');
 assert.equal(title['flex-basis'],'100%','SP8-CLOSE: heading occupies its own flex line');
});
test('SP8-CLOSE source cascade: wider headers retain V7 ordering',async()=>{
 for(const width of [431,768,1440]) {
  const {title,close}=await sp8SourceHeader(width);
  assert.equal(title.order,undefined);assert.equal(title['flex-basis'],undefined);
  assert.equal(close.order,undefined);
 }
});
test('SP8-CLOSE source DOM: only detail header; original accessible title and control order retained',async()=>{
 const {html}=await sp8SourceHeader(320);
 assert.equal((html.match(/class="dialog-top"/g)||[]).length,1);
 assert.match(html,/<dialog id="detail-dialog" aria-labelledby="detail-title">\s*<div class="dialog-top">\s*<h2 id="detail-title"><\/h2>\s*<button id="detail-close" type="button" aria-label="Details schliessen">\s*Schliessen\s*<\/button>/);
 const importDialog=html.match(/<dialog id="import-dialog"[\s\S]*?<\/dialog>/)?.[0];
 assert.ok(importDialog);assert.ok(!importDialog.includes('dialog-top'));
 assert.match(importDialog,/<h2 id="import-title">Importvorschau<\/h2>/);
});
test('SP8-CLOSE source cascade: original font, full wrapping and normal scrolling; no covering control',async()=>{
 for(const width of [320,390,1440]) {
  const {root,dialog,title,close}=await sp8SourceHeader(width);
  assert.match(root.font,/^17px\/1\.55\s+system-ui/);
  assert.equal(title['font-size'],'1.25rem');assert.equal(title['line-height'],'1.35');
  assert.equal(title['min-width'],'0');assert.equal(title['max-width'],'100%');
  assert.equal(title['overflow-wrap'],'anywhere');
  assert.equal(dialog.overflow,'auto');assert.equal(dialog['max-height'],'calc(100dvh - 1.5rem)');
  assert.equal(close['min-height'],'44px');
  for(const style of [title,close]) {
   assert.ok(!['none'].includes(style.display));assert.ok(!['hidden','collapse'].includes(style.visibility));
   assert.notEqual(style['text-overflow'],'ellipsis');assert.notEqual(style.overflow,'hidden');
   assert.ok(!['absolute','fixed','sticky'].includes(style.position));
  }
 }
});
