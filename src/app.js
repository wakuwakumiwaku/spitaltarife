import {
  STORAGE_KEY,
  SYSTEM_IDS,
  emptyDraft,
  emptyWorkspace,
  validateWorkspace,
  validateCatalog,
  validatePublicData,
  validateDraft,
  calculate,
  fixed,
  money,
  filterEntries,
  StorageGuard,
} from "./domain.js";
const $ = (id) => document.getElementById(id);
function el(tag, value, cls) {
  const n = document.createElement(tag);
  if (value !== undefined) n.textContent = value;
  if (cls) n.className = cls;
  return n;
}
function button(label, fn) {
  const b = el("button", label);
  b.type = "button";
  b.addEventListener("click", fn);
  return b;
}
function link(label, url) {
  const n = el("a", label);
  n.href = url;
  return n;
}
function download(name, data, type = "application/json") {
  const blob = new Blob([data], { type }),
    url = URL.createObjectURL(blob),
    a = el("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let catalog,
  provenance,
  guard,
  workspace,
  localCatalog = null,
  entries = [],
  limit = 30,
  pending = null,
  revision = 0;
function status(message) {
  $("storage-status").textContent =
    message ||
    (guard.blocked
      ? "Speicher geschützt: beschädigt, blockiert oder extern geändert. Kein Überschreiben. Aktueller Entwurf bleibt sichtbar; Originalspeicher und Entwurf lassen sich sichern."
      : "Speicher lesbar. Merkliste und Szenarien bleiben lokal.");
}
function mutate(fn) {
  if (pending) {
    status("Importvorschau offen: Speichern pausiert.");
    return;
  }
  try {
    const next = structuredClone(workspace);
    fn(next);
    workspace = guard.save(next);
    status("Lokal gespeichert und zurückgelesen.");
    renderScenarios();
    renderResults();
  } catch (e) {
    status(e.message);
  }
}
function getDraft() {
  return {
    system: $("calc-system").value,
    label: $("calc-label").value,
    edition: $("calc-edition").value,
    group: $("calc-group").value,
    base: $("calc-base").value,
    weight: $("calc-weight").value,
    reference: $("calc-reference").value,
    segments: [...$("segments").children].map((n) => ({
      days: n.querySelector('[data-field="days"]').value,
      weight: n.querySelector('[data-field="weight"]').value,
    })),
  };
}
function renderSegments(segments) {
  $("segments").replaceChildren();
  segments.forEach((s, i) => {
    const row = el("div", undefined, "segment");
    for (const [key, title] of [
      ["days", "Verrechnete Tage"],
      ["weight", "Gewicht je Tag"],
    ]) {
      const l = el("label", `${$("calc-system").value === "tarpsy" && key === "days" ? "Gesamtverweildauer" : title} · Abschnitt ${i + 1}`),
        input = el("input");
      input.dataset.field = key;
      input.inputMode = key === "days" ? "numeric" : "decimal";
      input.value = s[key];
      input.autocomplete = "off";
      input.setAttribute("aria-label", `${title} Abschnitt ${i + 1}`);
      l.append(input);
      row.append(l);
    }
    const remove = button("Abschnitt entfernen", () => {
      const current = getDraft().segments;
      current.splice(i, 1);
      renderSegments(current);
      markEdited();
    });
    remove.disabled = segments.length === 1;
    row.append(remove);
    $("segments").append(row);
  });
}
function mode() {
  const id = $("calc-system").value;
  $("case-input").hidden = id !== "swissdrg";
  $("daily-input").hidden = id === "swissdrg";
  $("segment-add").hidden = id !== "st-reha";
  $("daily-method").textContent = id === "tarpsy"
    ? "TARPSY: Gesamtverweildauer × das dafür geltende Tagesgewicht. Genau ein Abschnitt; keine Phasensumme. Tagesgewicht aus ptN und letzter ab-Dauer im Original extern prüfen."
    : "ST Reha: Tage je Phase × deren Tagesgewicht, dann summieren. OGV sind kumulative Grenzen, nicht die Länge jeder Phase. Phasen/Tage extern bestimmen; keine automatische Fallberechnung.";
  $("calc-limit").textContent = catalog.systems
    .find((s) => s.id === id)
    .limits.join(" ");
}
function setDraft(d) {
  for (const [k, id] of Object.entries({
    system: "calc-system",
    label: "calc-label",
    edition: "calc-edition",
    group: "calc-group",
    base: "calc-base",
    weight: "calc-weight",
    reference: "calc-reference",
  }))
    $(id).value = d[k];
  renderSegments(d.segments);
  mode();
  markEdited();
}
function markEdited() {
  $("calc-result").textContent =
    "Eingaben geändert – noch nicht neu berechnet.";
  $("calc-message").textContent = "";
}
function doCalculate() {
  try {
    const d = getDraft();
    if (d.system === "swissdrg") d.segments = [{ days: "", weight: "" }];
    else d.weight = "";
    const r = calculate(d);
    $("calc-result").replaceChildren(
      el("span", "Deklariertes Strukturszenario · keine vollständige Rechnung"),
      el("strong", money(r.cents)),
      el(
        "p",
        `${d.system === "swissdrg" ? "Fall-Kostengewicht" : d.system === "tarpsy" ? "Gesamtverweildauer × zugehöriges Tagesgewicht" : "Summe (Tage je Phase × Phasengewicht)"}: ${fixed(r.weight)}${r.days ? ` über ${r.days} Tage` : ""} × Baserate CHF ${d.base.replace(",", ".")}.`,
      ),
      el(
        "p",
        d.edition
          ? `Deklarierter Stand: ${d.edition}. Nicht amtlich verifiziert.`
          : "Abrechnungsjahr / Strukturversion nicht angegeben.",
      ),
      el("p", "Nicht erfasste Zu-/Abschläge und Zusatzentgelte: offen."),
    );
    $("calc-message").textContent = d.reference
      ? "Quellenangabe ist eine eigene Deklaration, nicht durch die App geprüft."
      : "Keine Preis-/Gewichtsquelle angegeben. Ergebnis ist nur eine freie Rechenannahme.";
    return d;
  } catch (e) {
    $("calc-result").textContent = "Nicht berechnet: " + e.message;
    $("calc-message").textContent = "Fehlende Werte sind nicht null CHF.";
    return null;
  }
}
function rebuildEntries() {
  entries = catalog.systems.map((s) => ({
    ...s,
    system: s.id,
    id: "profile:" + s.id,
    type: "profile",
    code: "",
    edition: "Strukturleitfaden",
    notes: s.limits.join(" "),
  }));
  if (localCatalog)
    entries.push(
      ...localCatalog.groups.map((g) => ({
        ...g,
        id: "local:" + localCatalog.system + ":" + localCatalog.edition + ":" + g.code,
        system: localCatalog.system,
        type: "group",
        edition: localCatalog.edition,
        area: catalog.systems.find((s) => s.id === localCatalog.system).area,
      })),
    );
}
function renderResults() {
  const found = filterEntries(entries, {
    query: $("search").value,
    system: $("system-filter").value,
    favoritesOnly: $("favorites-filter").checked,
    favorites: workspace.favorites,
  });
  $("result-count").textContent =
    `${found.length} von ${entries.length} geladenen Einträgen · ${catalog.systems.length} Strukturprofile, ${localCatalog?.groups.length || 0} lokale Gruppen. Sichtbar: ${Math.min(limit, found.length)}.`;
  $("results").replaceChildren();
  if (!found.length)
    $("results").append(
      el(
        "p",
        "Keine Treffer. Die Suche umfasst alle geladenen Einträge; nicht geladene Jahreskataloge sind nicht durchsucht.",
      ),
    );
  for (const e of found.slice(0, limit)) {
    const card = el("article", undefined, "entry");
    card.dataset.id = e.id;
    const top = el("header");
    top.append(el("h3", (e.code ? e.code + " · " : "") + e.title));
    if (e.type === "profile") {
      const star = button(
        workspace.favorites.includes(e.system) ? "★ Gemerkt" : "☆ Merken",
        () =>
          mutate((w) => {
            w.favorites = w.favorites.includes(e.system)
              ? w.favorites.filter((x) => x !== e.system)
              : [...w.favorites, e.system];
          }),
      );
      star.setAttribute("aria-pressed", workspace.favorites.includes(e.system));
      star.setAttribute(
        "aria-label",
        `${e.title} ${workspace.favorites.includes(e.system) ? "nicht mehr merken" : "merken"}`,
      );
      top.append(star);
    }
    card.append(
      top,
      el(
        "span",
        e.type === "profile"
          ? e.area + " · Strukturprofil"
          : e.area + " · nur lokal · " + e.edition,
        "badge",
      ),
      el(
        "p",
        e.type === "profile"
          ? e.summary
          : e.weight === null
            ? "Kein automatisch anwendbares Kostengewicht. Hinweise und Quelle prüfen."
            : `Deklariertes Katalog-Fallgewicht: ${e.weight} · nicht automatisch effektives Fallgewicht.`,
      ),
      button("Details öffnen", () => showDetails(e)),
    );
    $("results").append(card);
  }
  $("more").hidden = found.length <= limit;
}
function useEntry(e) {
  const d = getDraft();
  d.system = e.system;
  d.group = e.code || "";
  d.edition = e.type === "group" ? localCatalog.edition : "";
  d.weight = e.type === "group" && e.weight !== null ? e.weight : "";
  d.reference =
    e.type === "group"
      ? `${localCatalog.source.url} · ${localCatalog.validFrom} bis ${localCatalog.validTo} · SHA-256 ${localCatalog.source.sha256}`
      : "";
  setDraft(d);
  $("detail-dialog").close();
  $("calculator").scrollIntoView({ behavior: "smooth", block: "start" });
  $("calc-base").focus();
}
function showDetails(e) {
  $("detail-title").textContent = (e.code ? e.code + " · " : "") + e.title;
  const box = $("detail-content");
  box.replaceChildren();
  if (e.type === "profile") {
    box.append(
      el("p", e.summary),
      el("p", e.method),
      el(
        "p",
        `Einführung gemäss BAG: ${e.since}. Archivierte Versionen und Downloadnachweise siehe Quellenabschnitt; keine gehosteten Gruppentabellen.`,
      ),
    );
    const ul = el("ul");
    e.limits.forEach((s) => ul.append(el("li", s)));
    box.append(
      ul,
      link("Offizielle Systemseite (historischer Erstabruf HTTP 500)", e.url),
      el(
        "p",
        "Quelle der Strukturinformationen: BAG, Stationäre Tarifstrukturen.",
      ),
      link("BAG-Strukturübersicht", provenance.url),
    );
  } else {
    const dl = el("dl");
    for (const [k, v] of [
      ["System", catalog.systems.find((s) => s.id === e.system).title],
      ["Deklarierte Edition", localCatalog.edition],
      [
        "Gültigkeit laut lokaler Datei",
        localCatalog.validFrom + " bis " + localCatalog.validTo,
      ],
      [
        "Fallgewicht",
        e.weight ?? "Nicht hinterlegt / Tageslogik extern bestimmen",
      ],
      [
        "Umfang",
        localCatalog.coverage.kind + " · " + localCatalog.coverage.scope,
      ],
      ["Quellen-SHA-256", localCatalog.source.sha256],
    ])
      dl.append(el("dt", k), el("dd", v));
    box.append(
      dl,
      el("h3", "Vollständige lokale Hinweise"),
      el("p", e.notes || "Keine Hinweise in der lokalen Datei."),
      link("Deklarierte Originalquelle", localCatalog.source.url),
      el(
        "p",
        "Lokale Angaben wurden typ- und formatgeprüft, nicht gegen den amtlichen Katalog abgeglichen.",
      ),
    );
  }
  box.append(
    el(
      "p",
      "Beim Übernehmen bleiben Ihre Baserate und Tagesabschnitte erhalten. Gewichte und anwendbare Regeln vor Berechnung prüfen.",
    ),
    button("In Rechner übernehmen", () => useEntry(e)),
  );
  $("detail-dialog").showModal();
}
function renderScenarios() {
  const box = $("scenarios");
  box.replaceChildren();
  if (!workspace.scenarios.length) {
    box.append(el("p", "Noch keine Szenarien gemerkt."));
    return;
  }
  workspace.scenarios.forEach((s, i) => {
    const card = el("article", undefined, "entry"),
      r = calculate(s);
    card.append(
      el("h3", s.label),
      el(
        "p",
        `${catalog.systems.find((x) => x.id === s.system).title} · ${s.edition || "Version offen"} · ${money(r.cents)} (Strukturszenario)`,
      ),
      el("p", s.reference || "Quelle offen"),
    );
    const actions = el("div", undefined, "actions");
    actions.append(
      button("Im Rechner öffnen", () => {
        setDraft(s);
        doCalculate();
        $("calculator").scrollIntoView({ block: "start" });
      }),
      button("Szenario entfernen", () => {
        if (confirm(`Szenario «${s.label}» lokal entfernen?`))
          mutate((w) => w.scenarios.splice(i, 1));
      }),
    );
    card.append(actions);
    box.append(card);
  });
}
function saveScenario() {
  const d = doCalculate();
  if (!d) return;
  if (!d.label.trim()) {
    $("calc-message").textContent =
      "Zum Merken einen Szenarionamen ohne Personendaten angeben.";
    return;
  }
  mutate((w) => {
    const i = w.scenarios.findIndex(
      (s) => s.label === d.label && s.system === d.system,
    );
    if (i < 0) w.scenarios.push(d);
    else w.scenarios[i] = d;
  });
}
async function openFile(event, type) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const token = ++revision;
  if (file.size > (type === "workspace" ? 2 : 20) * 1024 * 1024) {
    status("Datei zu gross; nichts geändert.");
    return;
  }
  try {
    if (pending) throw Error("Zuerst die offene Vorschau schliessen.");
    const data = JSON.parse(await file.text());
    if (token !== revision) return;
    const value =
      type === "workspace" ? validateWorkspace(data) : validateCatalog(data);
    pending = { type, value, before: guard.raw };
    $("import-content").replaceChildren();
    $("import-message").textContent = "";
    if (type === "workspace") {
      $("import-content").append(
        el(
          "p",
          `${value.scenarios.length} Szenarien und ${value.favorites.length} gemerkte Systeme. Bestehende Zusammenstellung wird erst nach Ihrer Bestätigung ersetzt.`,
        ),
        el(
          "p",
          "Vor der Bestätigung wird eine unveränderte Sicherung des aktuellen Originalspeichers heruntergeladen. Vorschau und Abbrechen ändern den Speicher nicht.",
        ),
      );
    } else {
      $("import-content").append(
        el(
          "p",
          `${value.groups.length} lokale Gruppen · ${value.system} · ${value.edition}`,
        ),
        el(
          "p",
          `${value.validFrom} bis ${value.validTo}. Umfang laut Datei: ${value.coverage.kind} · ${value.coverage.scope}`,
        ),
        el("p", `Quelle: ${value.source.url}`),
        el(
          "p",
          "Nur lokal im Arbeitsspeicher. Ein als full deklarierter Umfang ist keine unabhängige Vollständigkeitsbestätigung. Ein vorhandener lokaler Katalog wird ersetzt.",
        ),
      );
    }
    $("import-dialog").showModal();
    status("Importvorschau geöffnet: Speichern pausiert.");
  } catch (e) {
    status("Datei nicht übernommen: " + e.message);
  }
}
function closeImport() {
  pending = null;
  $("import-dialog").close();
  status();
}
function applyImport() {
  if (!pending) return;
  try {
    if (pending.type === "workspace") {
      if (guard.blocked)
        throw Error(
          "Geschützter Speicher: Import wird nicht geschrieben. Originalspeicher sichern und Ursache klären.",
        );
      if (guard.storage.getItem(STORAGE_KEY) !== pending.before) {
        guard.blocked = true;
        throw Error("Speicher seit Vorschau geändert. Kein Überschreiben.");
      }
      download(
        "spitaltarife-vor-import.json",
        pending.before ?? JSON.stringify(emptyWorkspace(), null, 2),
      );
      if (
        !confirm(
          "Aktuelle lokale Zusammenstellung ersetzen? Vorherige Originaldaten wurden zum Download angeboten.",
        )
      )
        return;
      workspace = guard.save(pending.value);
      renderScenarios();
      renderResults();
    } else {
      localCatalog = pending.value;
      rebuildEntries();
      limit = 30;
      renderResults();
      $("local-status").textContent =
        `${localCatalog.groups.length} lokale Gruppen · ${localCatalog.system} · ${localCatalog.edition} · ${localCatalog.coverage.kind} laut Datei, nicht unabhängig bestätigt. Nicht dauerhaft gespeichert.`;
      $("catalog-clear").hidden = false;
    }
    closeImport();
  } catch (e) {
    $("import-message").textContent = e.message;
    status();
  }
}
function renderSources() {
  const box = $("source-content");
  box.replaceChildren(
    el(
      "p",
      `Abruf: ${provenance.retrieved_at}. Veröffentlichungsdatum: nicht sichtbar ausgewiesen. Kein Jahreskatalog.`,
    ),
    link(provenance.title, provenance.url),
    el("p", provenance.rights),
    el("p", provenance.catalog_gap),
  );
  const ul = el("ul");
  for (const f of provenance.files) {
    const li = el("li");
    li.append(
      link(
        f.file.startsWith("bag")
          ? "BAG-Strukturübersicht"
          : catalog.systems.find((s) => s.url === f.url)?.title ||
              "Systemseite",
        f.url,
      ),
      el(
        "span",
        ` · HTTP ${f.status} · ${f.bytes} Bytes · Abruf ${f.retrieved_at}`,
      ),
    );
    const d = el("details");
    d.append(el("summary", "SHA-256 & Nachweis"), el("code", f.sha256));
    li.append(d);
    ul.append(li);
  }
  box.append(
    ul,
    el("p", catalog.coverage.version_status),
    el(
      "p",
      "Öffentlich gehostet: 0 amtliche Gruppen und 0 Baserates. Privat beschafft: 1135 Hauptsettingzeilen (1081 Akutspital + 8 Geburtshaus + 24 PCG + 22 RCG). Zusatzentgeltquellen separat, nicht modelliert; ST-Reha-ZE 2026 fehlen. Rechte ungeklärt, keine Nachnutzungsgenehmigung durch dieses Werkzeug.",
    ),
    link("Maschinenlesbare Herkunft", "./data/provenance.json"),
  );
  box.append(el("h3", "Verifizierte archivierte Originalquellen · 2026"));
  for (const e of [...provenance.recovered.artifacts, ...provenance.recovered.evidence]) {
    const d = el("details");
    d.append(el("summary", e.file), link("Offizielles Original", e.original_url), el("span", " · "), link("Tatsächlich beschaffter Archivsnapshot", e.url),
      el("p", `Snapshot ${e.snapshot_timestamp} · Abruf ${e.retrieved_at} · HTTP ${e.status} · ${e.bytes} Bytes`), el("code", e.sha256));
    if (e.validity) d.append(el("p", JSON.stringify(e.validity)));
    box.append(d);
  }
  box.append(el("p", "Rechte: Nutzungsbedingungen-Snapshot 17.04.2026 verlangt vorherige schriftliche Genehmigung insbesondere für Kopieren/Veröffentlichen. Aktuelle Live-Bedingungen HTTP 500, keine offene Lizenz nachgewiesen. Keine Vereinbarung wird für Sie angenommen; lokale Konvertierung ist keine Erlaubnis. ST Reha: physischer PV2-Katalog Titeljahr 2025/Stand 21.05.2024, amtlicher Seiten-Snapshot 17.04.2026 bestätigt unveränderte Fortgeltung 2026. Neue AV2-PDF nicht beschafft. Spätere Oktober-2026-Änderungen nicht vollständig geprüft."));
  for (const n of catalog.notes) {
    const d = el("details");
    d.append(el("summary", n.title), el("p", n.text));
    $("notes-content").append(d);
  }
}
async function boot() {
  try {
    const values = await Promise.all(
      ["catalog", "provenance", "import-report"].map(async (n) => {
        const r = await fetch(new URL(`../data/${n}.json`, import.meta.url));
        if (!r.ok) throw Error(`Datendatei ${n}: HTTP ${r.status}`);
        return r.json();
      }),
    );
    validatePublicData(...values);
    [catalog, provenance] = values;
    try {
      guard = new StorageGuard(window.localStorage);
    } catch {
      guard = new StorageGuard({
        getItem() {
          throw Error("blocked");
        },
      });
    }
    workspace = guard.value;
    $("coverage").textContent =
      `Stand ${catalog.as_of}: 3 eigene Strukturprofile; 0 öffentlich gehostete amtliche Gruppen, 0 Baserates. 1135 private Hauptsettingzeilen aus archivierten Originalen verifiziert. Lokal geöffnete Gruppen separat; kein öffentlicher Katalog-Mirror.`;
    rebuildEntries();
    renderResults();
    renderSources();
    setDraft(emptyDraft());
    renderScenarios();
    status();
    for (const id of ["search", "system-filter", "favorites-filter"])
      $(id).addEventListener(id === "search" ? "input" : "change", () => {
        limit = 30;
        renderResults();
      });
    $("reset").onclick = () => {
      $("search").value = "";
      $("system-filter").value = "";
      $("favorites-filter").checked = false;
      limit = 30;
      renderResults();
    };
    $("more").onclick = () => {
      limit += 30;
      renderResults();
    };
    $("calc-form").addEventListener("submit", (e) => {
      e.preventDefault();
      doCalculate();
    });
    $("calc-form").addEventListener("input", markEdited);
    $("calc-system").addEventListener("change", () => {
      const segments = getDraft().segments;
      renderSegments(segments);
      mode();
      markEdited();
    });
    $("segment-add").onclick = () => {
      if ($("calc-system").value !== "st-reha") return;
      const s = getDraft().segments;
      if (s.length >= 100) {
        $("calc-message").textContent = "Höchstens 100 Tagesabschnitte.";
        return;
      }
      s.push({ days: "", weight: "" });
      renderSegments(s);
      markEdited();
    };
    $("scenario-save").onclick = saveScenario;
    $("calc-clear").onclick = () => {
      if (confirm("Ungespeicherte Eingaben leeren?")) setDraft(emptyDraft());
    };
    $("workspace-export").onclick = () =>
      download(
        "spitaltarife-sicherung.json",
        JSON.stringify(validateWorkspace(workspace), null, 2),
      );
    $("raw-export").onclick = () => {
      if (guard.raw === null) {
        status(
          "Kein lesbarer vorhandener Originalspeicher. Aktuelle Zusammenstellung kann über JSON sichern exportiert werden.",
        );
        return;
      }
      download("spitaltarife-originalspeicher.txt", guard.raw, "text/plain");
    };
    $("draft-export").onclick = () => {
      const d = doCalculate();
      if (d) {
        if (!d.label.trim()) d.label = "Ungespeichertes Szenario";
        download(
          "spitaltarife-entwurf.json",
          JSON.stringify({ ...emptyWorkspace(), scenarios: [d] }, null, 2),
        );
      }
    };
    $("workspace-file").addEventListener("change", (e) =>
      openFile(e, "workspace"),
    );
    $("catalog-file").addEventListener("change", (e) => openFile(e, "catalog"));
    $("import-apply").onclick = applyImport;
    $("import-cancel").onclick = closeImport;
    $("import-dialog").addEventListener("cancel", () => {
      pending = null;
      status();
    });
    $("import-dialog").addEventListener("close", () => {
      pending = null;
      status();
    });
    $("detail-close").onclick = () => $("detail-dialog").close();
    $("catalog-clear").onclick = () => {
      localCatalog = null;
      rebuildEntries();
      limit = 30;
      renderResults();
      $("local-status").textContent = "Kein lokaler Katalog geladen.";
      $("catalog-clear").hidden = true;
    };
    $("print").onclick = () => {
      doCalculate();
      window.print();
    };
    window.addEventListener("beforeprint", doCalculate);
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        guard.external(e.newValue);
        status();
      }
    });
    $("fatal").hidden = true;
    document.body.dataset.ready = "true";
  } catch (e) {
    $("fatal").hidden = false;
    $("fatal").textContent =
      "Leitfaden konnte nicht aktiviert werden: " +
      e.message +
      " Keine Ersatz- oder Beispieldaten geladen.";
  }
}
boot();
