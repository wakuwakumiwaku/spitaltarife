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
