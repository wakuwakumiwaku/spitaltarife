import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

// Test-only versioned arm binding; production/check and other suites never read it.
const control = JSON.parse(process.env.SPITAL_SCHEMA_CONTROL || "null");
const arm = control?.root || fileURLToPath(new URL("../", import.meta.url));
const { runtimeFiles, repositoryFiles } = await import(pathToFileURL(path.join(arm, "scripts/files.mjs")));
const { build, validateInputs } = await import(pathToFileURL(path.join(arm, "scripts/build.mjs")));
const schemaPath = "public/data/local-catalog.schema.json";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const original = await readFile(path.join(arm, schemaPath));
const weight = (s) => s.properties.groups.items.properties.weight;
const group = (s) => s.properties.groups.items;
const cases = [
  ["malformed-json", null],
  ["malformed-weight-regex", (s) => { weight(s).pattern = "["; }],
  ["malformed-required-type", (s) => { s.required = 42; }],
  ["nested-required-member", (s) => { group(s).required = ["code", ["title"]]; }],
  ["nested-required-duplicate", (s) => { s.properties.source.required = ["url", "url"]; }],
  ["type-array-unknown", (s) => { weight(s).type = ["string", "nil"]; }],
  ["type-array-nested", (s) => { weight(s).type = ["string", ["null"]]; }],
  ["type-array-empty", (s) => { weight(s).type = []; }],
  ["type-array-duplicate", (s) => { weight(s).type = ["string", "string"]; }],
  ["type-object", (s) => { group(s).type = { toString: "object" }; }],
  ["properties-array", (s) => { s.properties.source.properties = []; }],
  ["property-node-number", (s) => { group(s).properties.title = 7; }],
  ["items-array", (s) => { s.properties.groups.items = [{}]; }],
  ["items-null", (s) => { s.properties.groups.items = null; }],
  ["combinator-object", (s) => { s.allOf = {}; }],
  ["combinator-empty", (s) => { s.anyOf = []; }],
  ["combinator-member-array", (s) => { s.oneOf = [[]]; }],
  ["conditional-node-string", (s) => { s.allOf[0].then = "object"; }],
  ["deep-conditional-pattern", (s) => { s.allOf[0].then.properties.groups.items.properties.weight.pattern = "("; }],
  ["pattern-array-no-coercion", (s) => { weight(s).pattern = ["valid"]; }],
  ["pattern-object-no-coercion", (s) => { weight(s).pattern = {}; }],
  ["enum-not-array", (s) => { s.properties.system.enum = "swissdrg"; }],
  ["enum-object-member", (s) => { s.properties.system.enum = [{ value: "swissdrg" }]; }],
  ["enum-array-member", (s) => { s.properties.system.enum = [["swissdrg"]]; }],
  ["enum-duplicate", (s) => { s.properties.system.enum = ["swissdrg", "swissdrg"]; }],
  ["enum-empty", (s) => { s.properties.system.enum = []; }],
  ["const-object", (s) => { s.properties.app.const = {}; }],
  ["length-bound-string", (s) => { s.properties.edition.minLength = "1"; }],
  ["length-bounds-inverted", (s) => { s.properties.edition.minLength = 201; }],
  ["item-bound-negative", (s) => { s.properties.groups.minItems = -1; }],
  ["item-bound-fraction", (s) => { s.properties.groups.maxItems = 1.5; }],
  ["property-bounds-inverted", (s) => { s.minProperties = 9; s.maxProperties = 8; }],
  ["numeric-bounds-inverted", (s) => { weight(s).minimum = 2; weight(s).maximum = 1; }],
  ["numeric-exclusive-empty", (s) => { weight(s).minimum = 1; weight(s).exclusiveMaximum = 1; }],
  ["numeric-bound-array", (s) => { weight(s).minimum = [0]; }],
  ["multipleof-zero", (s) => { weight(s).multipleOf = 0; }],
  ["additionalproperties-number", (s) => { group(s).additionalProperties = 0; }],
  ["uniqueitems-string", (s) => { s.properties.groups.uniqueItems = "true"; }],
  ["format-object", (s) => { s.properties.validFrom.format = {}; }],
  ["format-unsupported", (s) => { s.properties.validFrom.format = "custom-unknown"; }],
  ["annotation-array", (s) => { weight(s).description = ["text"]; }],
  ["schema-dialect-unsupported", (s) => { s.$schema = "https://example.invalid/schema"; }],
  ["unknown-keyword-deep", (s) => { weight(s).unknownConstraint = true; }],
  ["unsupported-reference", (s) => { s.properties.edition.$ref = "#/missing"; }],
];
async function hashes(root, files) {
  return Object.fromEntries(await Promise.all(files.map(async (f) => [f, sha(await readFile(path.join(root, f)))])));
}
async function names(root) {
  return (await readdir(root)).sort();
}
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "spitaltarife-schema-"));
  for (const f of repositoryFiles) {
    await mkdir(path.dirname(path.join(root, f)), { recursive: true });
    await copyFile(path.join(arm, f), path.join(root, f));
  }
  return root;
}
async function invoke(mode, root, label) {
  const argv = mode === "CLI" ? ["scripts/build.mjs"] : ["build({root})"];
  const record = { mode, label, argv, cwd: root, executable: process.execPath, executableSha256: sha(await readFile(process.execPath)), environment: { ...process.env } };
  if (mode === "API") {
    try { record.files = await build({ root }); record.exit_code = 0; }
    catch (e) { record.exit_code = 1; record.error = e.message; record.stack = e.stack; }
    record.stdout = ""; record.stderr = record.stack || "";
  } else {
    const r = spawnSync(process.execPath, argv, { cwd: root, env: process.env, encoding: "utf8", timeout: 15000 });
    assert.ifError(r.error);
    assert.equal(typeof r.status, "number", "CLI must settle with integer exit");
    record.exit_code = r.status; record.stdout = r.stdout; record.stderr = r.stderr;
  }
  if (control?.receipts) {
    const out = path.join(control.receipts, mode + "-" + label);
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, "stdout.txt"), record.stdout);
    await writeFile(path.join(out, "stderr.txt"), record.stderr);
    await writeFile(path.join(out, "command.json"), JSON.stringify(record, null, 2) + "\n");
  }
  return record;
}
for (const mode of ["API", "CLI"]) {
  for (const [name, mutate] of cases) {
    test(`schema ${mode}: ${name}; all nine last-good files and every input protected`, async () => {
      const root = await fixture();
      try {
        const seed = await invoke(mode, root, name + "-seed");
        assert.equal(seed.exit_code, 0, seed.stderr);
        const before = await hashes(path.join(root, "dist"), Object.keys(runtimeFiles));
        const input = mutate ? JSON.parse(original) : null;
        if (mutate) mutate(input);
        const bad = mutate ? JSON.stringify(input) : "{broken";
        await writeFile(path.join(root, schemaPath), bad);
        const inputsBefore = await hashes(root, repositoryFiles);
        const stageBefore = await names(path.join(root, ".local"));
        // Real central API also used by check.mjs, not a new export missing on OLD.
        let validationError = null;
        try { await validateInputs(root); } catch (e) { validationError = e.message; }
        const invalid = await invoke(mode, root, name + "-invalid");
        const after = await hashes(path.join(root, "dist"), Object.keys(runtimeFiles));
        const inputsAfter = await hashes(root, repositoryFiles);
        const stageAfter = await names(path.join(root, ".local"));
        await writeFile(path.join(root, schemaPath), original);
        const restore = await invoke(mode, root, name + "-restore");
        const restored = await hashes(path.join(root, "dist"), Object.keys(runtimeFiles));
        const observation = { name, mode, invalidExit: invalid.exit_code, invalidError: invalid.error || invalid.stderr, validationError, seedExit: seed.exit_code, restoreExit: restore.exit_code, before, after, restored, inputsBefore, inputsAfter, stageBefore, stageAfter, badSha256: sha(bad), lastgoodPreserved: JSON.stringify(before) === JSON.stringify(after), inputsUnchanged: JSON.stringify(inputsBefore) === JSON.stringify(inputsAfter) };
        console.log("SCHEMA_OBSERVATION " + JSON.stringify(observation));
        if (control?.receipts) await writeFile(path.join(control.receipts, mode + "-" + name + "-observation.json"), JSON.stringify(observation, null, 2) + "\n");
        assert.equal(restore.exit_code, 0, restore.stderr);
        assert.deepEqual(restored, before, "real valid restore must recreate all nine seed bytes");
        assert.deepEqual(inputsAfter, inputsBefore, "builder may not rewrite any input");
        assert.notEqual(invalid.exit_code, 0, "semantically invalid shipped schema must be refused");
        assert.deepEqual(after, before, "all nine last-good runtime bytes must survive");
        assert.deepEqual(stageAfter, stageBefore, "validation may not leave a stage behind");
        if (mutate) {
          assert.match(validationError || "", /^Invalid local schema at /);
          assert.match(invalid.error || invalid.stderr, /Invalid local schema at /);
        } else assert.ok(validationError, "JSON syntax refusal control");
      } finally { await rm(root, { recursive: true, force: true }); }
    });
  }
  for (const variant of ["unchanged", "supported-subset"]) {
    test(`schema ${mode}: valid ${variant} accepted without rewriting inputs`, async () => {
      const root = await fixture();
      try {
        if (variant === "supported-subset") {
          const s = JSON.parse(original);
          s.properties.probe = { type: ["string", "number", "integer", "boolean", "object", "array", "null"], const: null, enum: [null, false, 0, "0"], pattern: "^(?:a|b)+$", format: "uri", minLength: 0, maxLength: 20, minimum: 0, exclusiveMinimum: -1, maximum: 5, exclusiveMaximum: 6, multipleOf: 0.5, minProperties: 0, maxProperties: 2, minItems: 0, maxItems: 3, uniqueItems: true, required: [], properties: {}, items: true, additionalProperties: { type: "string" }, allOf: [true, {}], anyOf: [false, {}], oneOf: [{}], not: false, if: true, then: {}, else: false };
          await writeFile(path.join(root, schemaPath), JSON.stringify(s));
        }
        const inputs = await hashes(root, repositoryFiles);
        const r = await invoke(mode, root, "valid-" + variant);
        assert.equal(r.exit_code, 0, r.stderr);
        assert.equal((await validateInputs(root)).size, 9);
        assert.deepEqual(await hashes(root, repositoryFiles), inputs);
        for (const [dest, src] of Object.entries(runtimeFiles)) assert.deepEqual(await readFile(path.join(root, "dist", dest)), await readFile(path.join(root, src)));
      } finally { await rm(root, { recursive: true, force: true }); }
    });
  }
}
