import assert from "node:assert/strict";
import { readFile, readdir, lstat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { validateInputs, project } from "./build.mjs";
import {repositoryFiles} from "./files.mjs";
export async function check() {
  for (const file of repositoryFiles) {
    const stat=await lstat(path.join(project,file));
    assert.ok(stat.isFile() && !stat.isSymbolicLink(),file);
    assert.ok((await readFile(path.join(project,file))).length,file);
  }
  async function inventory(dir) {
    const out=[];
    for (const e of await readdir(path.join(project,dir),{withFileTypes:true})) {
      if (e.name === "__pycache__") continue;
      const f=dir+"/"+e.name;
      if(e.isDirectory())out.push(...await inventory(f));else out.push(f);
    }
    return out;
  }
  for(const dir of ["src","scripts","tests","public","docs",".github"])
    assert.deepEqual((await inventory(dir)).sort(),repositoryFiles.filter(f=>f.startsWith(dir+"/")).sort(),"Unexpected public source inventory: "+dir);
  const metadata=JSON.parse(await readFile(path.join(project,"scripts/source_metadata.json")));
  const provenance=JSON.parse(await readFile(path.join(project,"public/data/provenance.json")));
  assert.deepEqual(metadata,provenance.recovered,"Source metadata and public provenance must agree");
  const buffers = await validateInputs();
  const html = buffers.get("index.html").toString();
  const repos = [
    "dentotar",
    "migel",
    "spezialitaetenliste",
    "analysenliste",
    "pflegefinanzierung",
    "arzneimittelliste",
    "arzttarife",
    "physiotherapie",
    "spitaltarife",
  ];
  for (const name of repos)
    assert.equal(
      html.split(`href="https://wakuwakumiwaku.github.io/${name}/"`).length - 1,
      1,
      name,
    );
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  const direct = html.match(
    /<nav\b[^>]*class="catalog-switch"[^>]*>([\s\S]*?)<\/nav\s*>/,
  )?.[1];
  assert.ok(direct, "Direct catalog navigation missing");
  const directLinks = [
    ...direct.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g),
  ].map((m) => m[1]);
  assert.deepEqual(
    directLinks,
    ["spitaltarife", "arzttarife", "pflegefinanzierung"].map(
      (name) => `https://wakuwakumiwaku.github.io/${name}/`,
    ),
  );
  assert.match(html, /<details class="catalog-directory">/);
  for (const dir of ["src", "scripts", "tests"])
    for (const f of await readdir(path.join(project, dir)))
      if (/\.(?:m?js)$/.test(f)) {
        const result = spawnSync(
          process.execPath,
          ["--check", path.join(project, dir, f)],
          { encoding: "utf8" },
        );
        assert.equal(result.status, 0, result.stderr);
      }
  for (const file of [
    "README.md",
    "DATA.md",
    "docs/CODEBASE.md",
    ".github/workflows/pages.yml",
    "package-lock.json",
  ])
    assert.ok((await readFile(path.join(project, file))).length, file);
  assert.ok(!/<script(?![^>]*src=)/i.test(html), "No inline scripts");
  assert.ok(
    !/innerHTML\s*=/.test(buffers.get("src/app.js").toString()),
    "No HTML string rendering",
  );
  console.log(
    `Check OK: ${buffers.size} Runtime-Dateien, neun eindeutige Kataloglinks, Daten-/Quellenschema und Syntax.`,
  );
}
await check();
