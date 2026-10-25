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
