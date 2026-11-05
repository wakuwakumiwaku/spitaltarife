import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  emptyDraft,
  emptyWorkspace,
  validateWorkspace,
  validateCatalog,
  validatePublicData,
  calculate,
  decimal,
  days,
  money,
  fixed,
  filterEntries,
  StorageGuard,
  STORAGE_KEY,
} from "../src/domain.js";
// Deliberately synthetic validation fixtures, never public tariff data.
const source = {
  url: "https://example.invalid/source",
  sha256: "a".repeat(64),
  rights: "local-only",
};
const local = () => ({
  app: "spitaltarife.catalog",
  version: 1,
  system: "swissdrg",
  edition: "TEST ONLY",
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  source: { ...source },
  coverage: { kind: "subset", scope: "Synthetic test fixture" },
  groups: [
    {
      code: "TEST-1",
      title: "Synthetic <script> text",
      weight: "1.25",
      notes: "fixture",
    },
  ],
});
const scenario = () => ({
  ...emptyDraft(),
  label: "Synthetic calculation",
  base: "10000.00",
  weight: "1.234567",
});
test("exact case multiplication, cents and formatter", () => {
  const r = calculate(scenario());
  assert.equal(r.cents, 1234567n);
  assert.equal(r.weight, 1234567n);
  assert.equal(money(r.cents), "CHF 12’345.67");
  assert.equal(fixed(r.weight), "1.234567");
});
test("round once on total, half-up, not on each day or segment", () => {
  const s = {
    ...scenario(),
    system: "st-reha",
    base: "0.01",
    weight: "",
    segments: [
      { days: "1", weight: "0.25" },
      { days: "1", weight: "0.25" },
    ],
  };
  assert.equal(calculate(s).cents, 1n);
  assert.equal(calculate(s).days, 2n);
  s.segments = [{ days: "3", weight: "0.333333" }];
  s.base = "100.00";
  assert.equal(calculate(s).cents, 10000n);
});
test("three systems, explicit days and base; no defaults or zero assumptions", () => {
  for (const system of ["swissdrg", "tarpsy", "st-reha"])
    assert.throws(() => calculate({ ...emptyDraft(), system }));
  for (const s of [
    "0",
    "-1",
    "1e2",
    "1 000",
    "1.0000001",
    {},
    ["1"],
    null,
    "NaN",
  ])
    assert.throws(() => decimal(s));
  assert.equal(decimal("1,25"), 1250000n);
  for (const s of ["0", "1.5", "10001", 1]) assert.throws(() => days(s));
  assert.throws(() => calculate({ ...scenario(), base: "1.001" }));
});
test("day and segment limits checked", () => {
  assert.throws(() =>
    calculate({
      ...scenario(),
      system: "st-reha",
      segments: [
        { days: "10000", weight: "1" },
        { days: "1", weight: "1" },
      ],
    }),
  );
  assert.throws(() => calculate({ ...scenario(), segments: [] }));
});
test("workspace strict namespaces/types/IDs, no coercion or partial activation", () => {
  const w = {
    ...emptyWorkspace(),
    favorites: ["swissdrg"],
    scenarios: [scenario()],
  };
  assert.deepEqual(validateWorkspace(w), w);
  const b = structuredClone(w);
  b.scenarios[0].system = ["tarpsy"];
  assert.throws(() => validateWorkspace(b));
  for (const bad of [
    { ...w, app: "migel.workspace" },
    { ...w, version: "1" },
    { ...w, extra: true },
    { ...w, favorites: ["swissdrg", "swissdrg"] },
    { ...w, favorites: ["missing"] },
  ])
    assert.throws(() => validateWorkspace(bad));
  assert.equal(w.scenarios[0].system, "swissdrg");
});
test("local catalog full schema, real dates and duplicate checks", () => {
  assert.deepEqual(validateCatalog(local()), local());
  for (const modify of [
    (c) => (c.source.sha256 = { toString: null, valueOf: null }),
    (c) => (c.source.sha256 = null),
    (c) => (c.source.url = "javascript:alert(1)"),
    (c) => (c.source.url = "https://user:pass@example.invalid"),
    (c) => (c.validFrom = "2026-02-30"),
    (c) => (c.validTo = "2025-12-31"),
    (c) => c.groups.push({ ...c.groups[0] }),
    (c) => (c.system = ["swissdrg"]),
    (c) => (c.groups[0].weight = 1.25),
    (c) => (c.groups[0].weight = "-1"),
    (c) => (c.source.rights = "publish"),
    (c) => (c.extra = true),
    (c) => (c.groups[0].title = {}),
    (c) => (c.coverage.kind = "all"),
  ]) {
    const c = local();
    modify(c);
    assert.throws(() => validateCatalog(c));
  }
});
test("daily catalog never imports a scalar stay-dependent tariff as a universal day weight", () => {
  const c = local();
  c.system = "tarpsy";
  assert.throws(() => validateCatalog(c));
  c.groups[0].weight = null;
  assert.equal(validateCatalog(c).groups[0].weight, null);
});
test("search full corpus and filters do not mutate source", () => {
  const entries = Array.from({ length: 125 }, (_, i) => ({
    id: String(i),
    system: i % 2 ? "tarpsy" : "swissdrg",
    title: i === 124 ? "Ökonomie letzter Eintrag" : "Name " + i,
    code: "C" + i,
  }));
  assert.equal(
    filterEntries(entries, { query: "okonomie letzter" })[0].id,
    "124",
  );
  assert.equal(filterEntries(entries, { system: "tarpsy" }).length, 62);
  assert.equal(
    filterEntries(entries, { favoritesOnly: true, favorites: ["tarpsy"] })
      .length,
    62,
  );
  assert.equal(entries.length, 125);
});
function storage(initial = null) {
  const map = new Map(initial === null ? [] : [[STORAGE_KEY, initial]]);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    map,
  };
}
test("storage only its namespace; readback and foreign-change refusal", () => {
  const s = storage(),
    g = new StorageGuard(s);
  const w = { ...emptyWorkspace(), favorites: ["tarpsy"] };
  g.save(w);
  assert.deepEqual(JSON.parse(s.getItem(STORAGE_KEY)), w);
  s.setItem(STORAGE_KEY, "foreign raw");
  assert.throws(() => g.save(emptyWorkspace()));
  assert.equal(s.getItem(STORAGE_KEY), "foreign raw");
  assert.equal(g.blocked, true);
  assert.equal(s.map.size, 1);
});
test("damaged or blocked storage never overwritten; original raw retained", () => {
  const s = storage("{broken"),
    g = new StorageGuard(s);
  assert.equal(g.raw, "{broken");
  assert.throws(() => g.save(emptyWorkspace()));
  assert.equal(s.getItem(STORAGE_KEY), "{broken");
  const blocked = new StorageGuard({
    getItem() {
      throw Error();
    },
  });
  assert.equal(blocked.blocked, true);
  assert.throws(() => blocked.save(emptyWorkspace()));
});
test("quota failure is protected and leaves draft reusable for export", () => {
  const s = storage();
  s.setItem = () => {
    throw Error("quota");
  };
  const g = new StorageGuard(s),
    w = { ...emptyWorkspace(), scenarios: [scenario()] };
  assert.throws(() => g.save(w));
  assert.equal(g.blocked, true);
  assert.equal(w.scenarios[0].weight, "1.234567");
});
test("public inventory counts and provenance agree, corrupted metadata rejected", async () => {
  const data = await Promise.all(
    ["catalog", "provenance", "import-report"].map((n) =>
      readFile(
        new URL("../public/data/" + n + ".json", import.meta.url),
        "utf8",
      ).then(JSON.parse),
    ),
  );
  assert.equal(validatePublicData(...data), true);
  assert.equal(data[0].systems.length, 3);
  assert.equal(data[0].notes.length, 4);
  for (const mutate of [
    (d) => (d[2].official_groups = 1),
    (d) => (d[0].systems[0].summary = null),
    (d) => (d[0].systems[0].limits = [{}]),
    (d) => (d[0].systems[0].url = "javascript:alert(1)"),
    (d) => (d[1].files[0].sha256 = { toString: null }),
    (d) => (d[1].files[0].bytes = "778890"),
    (d) => (d[0].notes[0].text = []),
    (d) => (d[1].files[0].extra = true),
  ]) {
    const bad = structuredClone(data);
    mutate(bad);
    assert.throws(() => validatePublicData(...bad));
  }
});

// Execute the real app through synthetic DOM/storage boundaries; not native rendering.
import {createContext, runInContext} from 'node:vm';
// A synthetic DOM boundary, not rendered-browser evidence. Application handlers
// and domain exports execute unchanged; no product function is stubbed.
class TestElement {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.value = ''; this.textContent = ''; this.hidden = false; this.open = false; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; this.textContent = ''; }
  add(option) { this.children.push(option); }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  showModal() { this.open = true; }
  close() { this.open = false; for (const fn of this.listeners.close ?? []) fn({target: this}); }
  focus() {}
  scrollIntoView() {}
  querySelector(selector) { return this.children.flatMap(c => [c, ...(c.children ?? [])]).find(c => selector === '[data-field="days"]' ? c.dataset?.field === 'days' : selector === '[data-field="weight"]' && c.dataset?.field === 'weight'); }
}
async function appFixture({storage, data} = {}) {
  const elements = new Map(), windowListeners = {};
  const document = {getElementById(id) { if (!elements.has(id)) elements.set(id, new TestElement()); return elements.get(id); }, createElement: tag => new TestElement(tag), createDocumentFragment: () => new TestElement(), querySelectorAll: () => [], body: new TestElement('body')};
  const domain = await import('../src/domain.js');
  const sandbox = {...domain, document, localStorage: storage, structuredClone, console, URL, setTimeout, clearTimeout, Option: class extends TestElement { constructor(text, value) { super('option'); this.textContent = text; this.value = value; } }, fetch: async url => ({ok: true, json: async () => data[String(url).match(/([^/]+)\.json$/)?.[1]] ?? data.catalog})};
  sandbox.window = {localStorage: storage, addEventListener(type, fn) { (windowListeners[type] ??= []).push(fn); }};
  const context = createContext(sandbox);
  const appURL = new URL('../src/app.js', import.meta.url);
  let source = await readFile(appURL, 'utf8');
  assert.match(source, /^import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/domain\.js['"];?/);
  source = source.replace(/^import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/domain\.js['"];?/, '').replaceAll('import.meta.url', JSON.stringify(appURL.href));
  assert.match(source, /boot\(\);\s*$/);
  source = source.replace(/boot\(\);\s*$/, 'globalThis.__boot = boot();');
  runInContext(source, context, {filename: appURL.pathname});
  await context.__boot;
  return {context, elements, run: code => runInContext(code, context), emit: async (id, type, event) => { for (const fn of elements.get(id).listeners[type] ?? []) await fn(event ?? {target: elements.get(id)}); }};
}

for (const olderFailure of ['reject', 'invalid-json']) test(`superseded file failure cannot replace the current import diagnosis: ${olderFailure}`, async () => {
  const data = Object.fromEntries(await Promise.all(['catalog','provenance','import-report'].map(async name => [name, JSON.parse(await readFile(new URL('../public/data/'+name+'.json', import.meta.url)))])));
  const app = await appFixture({storage: {getItem: () => null, setItem() {}}, data});
  assert.equal(app.elements.get('fatal').hidden, true, 'boot must activate before racing file reads');
  let rejectOlder, resolveOlder;
  const olderText = new Promise((resolve, reject) => { resolveOlder = resolve; rejectOlder = reject; });
  const older = app.run('openFile')({target: {files: [{size: 100, text: () => olderText}], value: 'old.json'}}, 'workspace');
  const current = {...emptyWorkspace(), favorites: ['tarpsy']};
  await app.run('openFile')({target: {files: [{size: 100, text: async () => JSON.stringify(current)}], value: 'current.json'}}, 'workspace');
  const currentStatus = app.elements.get('storage-status').textContent;
  assert.match(currentStatus, /Importvorschau geöffnet/);
  if (olderFailure === 'reject') rejectOlder(Error('Synthetic old file read failure')); else resolveOlder('{old malformed JSON');
  await older;
  assert.equal(app.elements.get('storage-status').textContent, currentStatus, 'late failure belongs to superseded selection, not the current preview');
  assert.deepEqual(JSON.parse(app.run('JSON.stringify(pending.value)')), current);
  assert.equal(app.elements.get('import-dialog').open, true);
});
test('current failed file read still reports rejection without preview or storage writes', async () => {
  const data = Object.fromEntries(await Promise.all(['catalog','provenance','import-report'].map(async name => [name, JSON.parse(await readFile(new URL('../public/data/'+name+'.json', import.meta.url)))])));
  let writes = 0;
  const app = await appFixture({storage: {getItem: () => null, setItem() { writes++; }}, data});
  await app.run('openFile')({target: {files: [{size: 100, text: async () => { throw Error('Synthetic current failure'); }}], value: 'current.json'}}, 'workspace');
  assert.match(app.elements.get('storage-status').textContent, /Datei nicht übernommen: Synthetic current failure/);
  assert.equal(app.run('pending'), null); assert.equal(writes, 0);
});
