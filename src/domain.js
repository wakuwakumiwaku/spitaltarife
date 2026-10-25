export const STORAGE_KEY = "spitaltarife.workspace.v1";
export const SYSTEM_IDS = ["swissdrg", "tarpsy", "st-reha"];
export const SCALE = 1000000n;
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export function keys(v, list) {
  return (
    object(v) &&
    Object.keys(v).length === list.length &&
    list.every((k) => Object.hasOwn(v, k))
  );
}
export function text(v, max = 1000, empty = true) {
  if (
    typeof v !== "string" ||
    v.length > max ||
    (!empty && !v.length) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
  )
    throw Error("Ungültiger Text.");
  return v;
}
export function decimal(value, digits = 6, max = 1000000n, positive = true) {
  if (
    typeof value !== "string" ||
    !new RegExp(`^(?:0|[1-9]\\d{0,8})(?:[.,]\\d{1,${digits}})?$`).test(value)
  )
    throw Error(
      `Dezimalzahl ohne Tausenderzeichen, bis ${digits} Nachkommastellen erforderlich.`,
    );
  const [whole, part = ""] = value.replace(",", ".").split("."),
    scale = 10n ** BigInt(digits),
    n = BigInt(whole) * scale + BigInt(part.padEnd(digits, "0"));
  if (n > max * scale || (positive ? n <= 0n : n < 0n))
    throw Error(
      `Wert muss ${positive ? "grösser als 0" : "nichtnegativ"} und höchstens ${max} sein.`,
    );
  return n;
}
export function days(value) {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d{0,4}$/.test(value) ||
    Number(value) > 10000
  )
    throw Error("Tage: ganze Zahl von 1 bis 10000.");
  return BigInt(value);
}
export function fixed(n, digits = 6) {
  const s = n.toString().padStart(digits + 1, "0");
  return s.slice(0, -digits) + "." + s.slice(-digits);
}
export function money(cents) {
  const s = cents.toString().padStart(3, "0");
  return (
    "CHF " +
    s.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, "’") +
    "." +
    s.slice(-2)
  );
}
export function emptyDraft() {
  return {
    system: "swissdrg",
    label: "",
    edition: "",
    group: "",
    base: "",
    weight: "",
    segments: [{ days: "", weight: "" }],
    reference: "",
  };
}
export function validateDraft(d, complete = false) {
  if (
    !keys(d, [
      "system",
      "label",
      "edition",
      "group",
      "base",
      "weight",
      "segments",
      "reference",
    ]) ||
    typeof d.system !== "string" ||
    !SYSTEM_IDS.includes(d.system)
  )
    throw Error("Ungültiges System oder Szenario.");
  for (const k of ["label", "edition", "group", "reference"])
    text(d[k], k === "reference" ? 2000 : 200);
  if (
    !Array.isArray(d.segments) ||
    d.segments.length < 1 ||
    d.segments.length > 100
  )
    throw Error("1 bis 100 Tagesabschnitte erforderlich.");
  if (d.base !== "" || complete) decimal(d.base, 2, 100000000n);
  if (d.weight !== "" || (complete && d.system === "swissdrg"))
    decimal(d.weight, 6, 1000000n, false);
  if (d.system === "tarpsy" && d.segments.length !== 1)
    throw Error("TARPSY: genau eine Gesamtverweildauer mit dem dafür geltenden Tagesgewicht; keine Phasensumme.");
  let total = 0n;
  for (const s of d.segments) {
    if (!keys(s, ["days", "weight"])) throw Error("Ungültiger Tagesabschnitt.");
    if (s.days !== "" || (complete && d.system !== "swissdrg"))
      total += days(s.days);
    if (s.weight !== "" || (complete && d.system !== "swissdrg"))
      decimal(s.weight, 6, 1000000n, false);
  }
  if (total > 10000n) throw Error("Insgesamt höchstens 10000 Tage.");
  return structuredClone(d);
}
export function calculate(d) {
  validateDraft(d, true);
  const base = decimal(d.base, 2, 100000000n);
  let weight = 0n,
    totalDays = 0n;
  if (d.system === "swissdrg") weight = decimal(d.weight, 6, 1000000n, false);
  else if (d.system === "tarpsy") {
    totalDays = days(d.segments[0].days);
    weight = totalDays * decimal(d.segments[0].weight, 6, 1000000n, false);
  } else
    for (const s of d.segments) {
      const n = days(s.days);
      weight += n * decimal(s.weight, 6, 1000000n, false);
      totalDays += n;
    }
  return {
    weight,
    days: totalDays,
    cents: (weight * base + SCALE / 2n) / SCALE,
  };
}
export function emptyWorkspace() {
  return {
    app: "spitaltarife.workspace",
    version: 1,
    edition: "strukturleitfaden-2026-10-22",
    favorites: [],
    scenarios: [],
  };
}
export function validateWorkspace(v) {
  const e = emptyWorkspace();
  if (
    !keys(v, Object.keys(e)) ||
    v.app !== e.app ||
    v.version !== 1 ||
    v.edition !== e.edition ||
    !Array.isArray(v.favorites) ||
    !Array.isArray(v.scenarios) ||
    v.scenarios.length > 100 ||
    v.favorites.length > 3
  )
    throw Error("Keine passende Spitaltarife-Sicherung (Version 1).");
  if (
    v.favorites.some((x) => typeof x !== "string" || !SYSTEM_IDS.includes(x)) ||
    new Set(v.favorites).size !== v.favorites.length
  )
    throw Error("Unbekannte oder doppelte Merkliste-ID.");
  v.scenarios.forEach((s) => {
    validateDraft(s, true);
    if (!s.label.trim())
      throw Error("Gespeicherte Szenarien brauchen einen Namen.");
  });
  return structuredClone(v);
}
export function normalize(s) {
  return s
    .toLocaleLowerCase("de-CH")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss");
}
export function filterEntries(
  entries,
  { query = "", system = "", favoritesOnly = false, favorites = [] } = {},
) {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return entries.filter(
    (e) =>
      (!system || e.system === system) &&
      (!favoritesOnly || favorites.includes(e.system)) &&
      words.every((w) =>
        normalize(
          [e.title, e.code, e.area, e.summary, e.notes, e.edition]
            .filter(Boolean)
            .join(" "),
        ).includes(w),
      ),
  );
}
export function validateCatalog(v) {
  if (
    !keys(v, [
      "app",
      "version",
      "system",
      "edition",
      "validFrom",
      "validTo",
      "source",
      "coverage",
      "groups",
    ]) ||
    v.app !== "spitaltarife.catalog" ||
    v.version !== 1 ||
    typeof v.system !== "string" ||
    !SYSTEM_IDS.includes(v.system)
  )
    throw Error("Kein unterstützter lokaler Katalog (Schema 1).");
  text(v.edition, 200, false);
  for (const k of ["validFrom", "validTo"]) {
    if (
      typeof v[k] !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(v[k]) ||
      !Number.isFinite(Date.parse(v[k] + "T00:00:00Z")) ||
      new Date(v[k] + "T00:00:00Z").toISOString().slice(0, 10) !== v[k]
    )
      throw Error("Ungültiges Gültigkeitsdatum.");
  }
  if (v.validTo < v.validFrom) throw Error("Umgekehrter Gültigkeitszeitraum.");
  if (
    !keys(v.source, ["url", "sha256", "rights"]) ||
    typeof v.source.url !== "string" ||
    v.source.url.length > 3000 ||
    typeof v.source.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.source.sha256) ||
    v.source.rights !== "local-only"
  )
    throw Error("Ungültige Quellenangabe.");
  let url;
  try {
    url = new URL(v.source.url);
  } catch {
    throw Error("Ungültige Quellen-URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw Error("Quelle muss eine HTTPS-URL ohne Zugangsdaten sein.");
  if (
    !keys(v.coverage, ["kind", "scope"]) ||
    !["full", "subset"].includes(v.coverage.kind)
  )
    throw Error("Umfang muss full oder subset sein.");
  text(v.coverage.scope, 1000, false);
  if (
    !Array.isArray(v.groups) ||
    v.groups.length < 1 ||
    v.groups.length > 30000
  )
    throw Error("Katalog: 1 bis 30000 Gruppen erforderlich.");
  const seen = new Set();
  for (const g of v.groups) {
    if (!keys(g, ["code", "title", "weight", "notes"]))
      throw Error("Unbekannte Gruppenfelder.");
    text(g.code, 80, false);
    text(g.title, 2000, false);
    text(g.notes, 20000);
    if (seen.has(g.code)) throw Error("Doppelter Gruppencode.");
    seen.add(g.code);
    if (g.weight !== null) {
      if (v.system !== "swissdrg")
        throw Error(
          "Tageskataloge müssen weight=null verwenden; aufenthaltsabhängige Gewichte in notes dokumentieren und extern bestimmen.",
        );
      if (typeof g.weight !== "string" || g.weight.includes(","))
        throw Error("Kataloggewicht muss kanonische Dezimalzeichenfolge sein.");
      decimal(g.weight, 6, 1000000n, false);
    }
  }
  return structuredClone(v);
}
export function validatePublicData(c, p, r) {
  const fail = () => {
    throw Error("Öffentliche Daten oder Quellennachweise sind unvollständig.");
  };
  const string = (v, max = 20000) => {
    text(v, max, false);
  };
  if (
    !keys(c, [
      "schema",
      "edition",
      "as_of",
      "coverage",
      "source_id",
      "systems",
      "notes",
    ]) ||
    c.schema !== 1 ||
    c.edition !== emptyWorkspace().edition ||
    c.as_of !== "2026-10-22" ||
    c.source_id !== "bag-stationaer" ||
    !Array.isArray(c.systems) ||
    c.systems.length !== 3
  )
    fail();
  const urls = {
    swissdrg: "https://www.swissdrg.org/de/akutsomatik/swissdrg",
    tarpsy: "https://www.swissdrg.org/de/psychiatrie/tarpsy",
    "st-reha": "https://www.swissdrg.org/de/rehabilitation/st-reha",
  };
  const seen = new Set();
  for (const s of c.systems) {
    if (
      !keys(s, [
        "id",
        "title",
        "area",
        "since",
        "basis",
        "url",
        "summary",
        "method",
        "limits",
      ]) ||
      typeof s.id !== "string" ||
      !SYSTEM_IDS.includes(s.id) ||
      seen.has(s.id) ||
      s.url !== urls[s.id] ||
      s.basis !== (s.id === "swissdrg" ? "Fall" : "Tag") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(s.since) ||
      !Array.isArray(s.limits) ||
      !s.limits.length
    )
      fail();
    seen.add(s.id);
    for (const k of ["title", "area", "since", "summary", "method"])
      string(s[k]);
    s.limits.forEach((v) => string(v));
  }
  if (
    !keys(c.coverage, [
      "profiles",
      "official_groups",
      "baserates",
      "version_status",
    ]) ||
    c.coverage.profiles !== 3 ||
    c.coverage.official_groups !== 0 ||
    c.coverage.baserates !== 0 ||
    !Array.isArray(c.notes) ||
    c.notes.length !== 4
  )
    fail();
  string(c.coverage.version_status);
  for (const n of c.notes) {
    if (
      !keys(n, ["title", "text", "source"]) ||
      !["bag-stationaer", "app-scope"].includes(n.source)
    )
      fail();
    string(n.title);
    string(n.text);
  }
  if (
    !keys(p, [
      "schema",
      "id",
      "title",
      "url",
      "publication_date",
      "publication_note",
      "retrieved_at",
      "files",
      "rights",
      "catalog_gap",
      "recovered",
    ]) ||
    p.schema !== 1 ||
    p.id !== c.source_id ||
    p.url !== "https://www.bag.admin.ch/de/stationaere-tarifstrukturen" ||
    p.publication_date !== null ||
    !Array.isArray(p.files) ||
    p.files.length !== 4
  )
    fail();
  for (const k of [
    "title",
    "publication_note",
    "retrieved_at",
    "rights",
    "catalog_gap",
  ])
    string(p[k]);
  validateRecoveryMetadata(p.recovered);
  const files = [
    "bag-stationaer.html",
    "swissdrg-akut.html",
    "swissdrg-tarpsy.html",
    "swissdrg-reha.html",
  ];
  for (const [i, f] of p.files.entries()) {
    const required = [
        "file",
        "url",
        "retrieved_at",
        "status",
        "bytes",
        "sha256",
      ],
      allowed = [...required, "final_url", "content_type", "timestamp_note"];
    if (
      !object(f) ||
      required.some((k) => !Object.hasOwn(f, k)) ||
      Object.keys(f).some((k) => !allowed.includes(k)) ||
      f.file !== files[i] ||
      f.url !== (i === 0 ? p.url : urls[SYSTEM_IDS[i - 1]]) ||
      f.status !== (i === 0 ? 200 : 500) ||
      typeof f.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(f.sha256) ||
      !Number.isInteger(f.bytes) ||
      f.bytes <= 0
    )
      fail();
    string(f.retrieved_at);
    if (!Number.isFinite(Date.parse(f.retrieved_at))) fail();
    for (const k of ["final_url", "content_type", "timestamp_note"])
      if (Object.hasOwn(f, k)) string(f[k]);
  }
  if (
    !keys(r, [
      "schema",
      "edition",
      "profiles",
      "official_groups",
      "baserates",
      "parser",
      "source_sha256",
    ]) ||
    r.schema !== 1 ||
    r.edition !== c.edition ||
    r.profiles !== 3 ||
    r.official_groups !== 0 ||
    r.baserates !== 0 ||
    r.source_sha256 !== p.files[0].sha256 ||
    r.source_sha256 !==
      "5911499a1e37cb122d3d03b23c409408ee883aacbca451bb2106ba84b2cb4e42"
  )
    fail();
  string(r.parser);
  return true;
}
export function validateRecoveryMetadata(m) {
  const fail = () => { throw Error("Ungültige archivierte Quellenmetadaten."); };
  if (!keys(m, ["schema", "artifacts", "evidence", "settings", "private_main_rows", "hosted_groups", "baserates", "annexes_modeled"]) ||
      m.schema !== 1 || m.private_main_rows !== 1135 || m.hosted_groups !== 0 || m.baserates !== 0 || m.annexes_modeled !== false ||
      !keys(m.settings, ["swissdrg-akut", "swissdrg-geburtshaus", "tarpsy", "st-reha"]) ||
      m.settings["swissdrg-akut"] !== 1081 || m.settings["swissdrg-geburtshaus"] !== 8 || m.settings.tarpsy !== 24 || m.settings["st-reha"] !== 22 ||
      !Array.isArray(m.artifacts) || m.artifacts.length !== 9 || !Array.isArray(m.evidence) || m.evidence.length !== 4) fail();
  const seen = new Set();
  for (const e of [...m.artifacts, ...m.evidence]) {
    const required = ["file","url","acquisition","retrieved_at","final_url","status","content_type","bytes","sha256","raw_saved","public_reuse_authorized","rights_note","provenance","original_url","snapshot_timestamp"];
    if (!object(e) || required.some(k => !Object.hasOwn(e,k)) || Object.keys(e).some(k => ![...required,"validity"].includes(k)) ||
        e.status !== 200 || e.raw_saved !== true || e.public_reuse_authorized !== false || e.provenance !== "archive_snapshot" ||
        !Number.isSafeInteger(e.bytes) || e.bytes < 1 || typeof e.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(e.sha256) ||
        typeof e.snapshot_timestamp !== "string" || !/^\d{14}$/.test(e.snapshot_timestamp) ||
        typeof e.file !== "string" || !/^[A-Za-z0-9_.-]+$/.test(e.file) || seen.has(e.file)) fail();
    seen.add(e.file);
    for (const k of ["url","original_url","final_url"]) {
      text(e[k],3000,false); let u; try { u = new URL(e[k]); } catch { fail(); }
      if (u.protocol !== "https:" || u.username || u.password) fail();
    }
    if (e.url !== `https://web.archive.org/web/${e.snapshot_timestamp}id_/${e.original_url}` || e.final_url !== e.url || !e.original_url.startsWith("https://www.swissdrg.org/")) fail();
    for (const k of ["acquisition","retrieved_at","content_type","rights_note"]) text(e[k],3000,false);
    if (!Number.isFinite(Date.parse(e.retrieved_at))) fail();
    if (!m.artifacts.includes(e)) text(e.validity,2000,false);
    if (m.artifacts.includes(e)) {
      if (!object(e.validity) || !Object.hasOwn(e.validity,"system") || !Object.hasOwn(e.validity,"version")) fail();
      // Validity is descriptive source metadata, never interpreted as automatic tariff logic.
      for (const [k,v] of Object.entries(e.validity)) {
        if (!["system","version","applicable_years","catalog_stand","official_page_stand","caution","billing_year","billing_label","file_title_year","official_2026_unchanged_evidence","kind"].includes(k)) fail();
        if (typeof v === "string") text(v,2000,false);
        else if (Number.isSafeInteger(v)) { if (v < 1) fail(); }
        else if (Array.isArray(v) && v.length > 0 && v.length <= 3 && v.every(x => Number.isSafeInteger(x) && x >= 2000 && x <= 2100)) {} else fail();
      }
    }
  }
  return true;
}
export class StorageGuard {
  constructor(storage) {
    this.storage = storage;
    this.raw = null;
    this.blocked = false;
    try {
      this.raw = storage.getItem(STORAGE_KEY);
      this.value =
        this.raw === null
          ? emptyWorkspace()
          : validateWorkspace(JSON.parse(this.raw));
    } catch {
      this.blocked = true;
      this.value = emptyWorkspace();
    }
  }
  save(value) {
    const valid = validateWorkspace(value);
    if (this.blocked)
      throw Error(
        "Speicher geschützt: zuerst die Originaldaten sichern und Seite neu laden.",
      );
    let now;
    try {
      now = this.storage.getItem(STORAGE_KEY);
    } catch {
      this.blocked = true;
      throw Error("Speicher nicht lesbar. Entwurf bleibt erhalten.");
    }
    if (now !== this.raw) {
      this.blocked = true;
      throw Error(
        "Fremdänderung erkannt. Kein Überschreiben; Entwurf bleibt erhalten.",
      );
    }
    const next = JSON.stringify(valid);
    try {
      this.storage.setItem(STORAGE_KEY, next);
      if (this.storage.getItem(STORAGE_KEY) !== next) throw Error();
    } catch {
      this.blocked = true;
      throw Error(
        "Speichern/Verifizieren fehlgeschlagen. Entwurf bleibt erhalten.",
      );
    }
    this.raw = next;
    this.value = valid;
    return valid;
  }
  external(raw) {
    if (raw !== this.raw) this.blocked = true;
  }
}
