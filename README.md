# Spitaltarife

Eigene quellenbelegte Referenz für SwissDRG, TARPSY und ST Reha mit exaktem, begrenztem Szenariorechner. Deutsch, dunkles Violett, Systemfonts und helle Druckansicht; Vanilla ESM ohne Frontend-Abhängigkeiten, Tracker oder Konten.

## Öffentlicher und privater Umfang

**Öffentlich: drei eigene Strukturprofile, vier Hinweise, verifizierte Quellen-/Versionsmetadaten; null gehostete amtliche Gruppen, Gewichtstabellen, Zusatzentgeltkataloge oder Baserates.** Die frühere technische Kataloglücke ist durch echte archivierte Originale widerlegt:

| Privates Hauptsetting | Verifizierter Quellenstand | Zeilen |
| --- | --- | ---: |
| SwissDRG Akutspitäler | 15.0 Abrechnungsversion 2026/2026, 28.11.2025 | 1081 |
| SwissDRG Geburtshäuser | dieselbe XLSX, separates Setting | 8 |
| TARPSY | 6.0 für 2026/2027, Katalog 14.03.2025, Webseite 18.03.2025 | 24 |
| ST Reha | 3.0, physische PV2-Datei mit Titeljahr 2025, Stand 21.05.2024; offizielle Archivseite bestätigt unveränderte Gültigkeit 2026 | 22 |

Das sind **1135 Hauptsettingzeilen**, keine Vollständigkeitszusage aller Anlagen oder Änderungen bis Oktober 2026. Die acht Geburtshauscodes bleiben unabhängig von identischen Akutspitalcodes. SwissDRG-Anlagen 2/3, TARPSY-ZE und Verbrennungs-ZE sind privat beschafft, aber nicht modelliert. ST-Reha-ZE 2026 und neu beschriftete AV2-PDF wurden nicht beschafft; die vorhandene PV2 wird nicht umbenannt.

Die archivierten Nutzungsbedingungen vom 17.04.2026 verlangen insbesondere für Kopieren/Veröffentlichen vorherige schriftliche Genehmigung. Keine offene Lizenz nachgewiesen; aktuelle Live-Bedingungen HTTP 500. Dies ist keine abschliessende juristische Feststellung über einzelne Werte und keine pauschale private Nutzungslizenz. **Kein öffentlicher Vollkatalog-Mirror, keine Lizenzannahme für Nutzer. Ein Konverter ist keine Nachnutzungserlaubnis.** Details, echte Download-/Archivziele und ursprüngliche Fehlerhistorie: [DATA.md](DATA.md), sichtbarer Quellenabschnitt und [Provenienz](public/data/provenance.json).

## Lokal starten und prüfen

Node >=22, Python >=3.11; Standardbibliotheken. Nur für Quellenkonvertierung zusätzlich das vorhandene `pdftotext`. Keine globalen Installationen.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
npm run build
npm run serve
```

Der Server bindet an `127.0.0.1`, standardmässig Port 3019. `BASE_PATH=/spitaltarife/ npm run serve` bedient den Repository-Unterpfad. `file://` wird wegen ESM/Fetch nicht unterstützt. Build/Server verwenden ausschliesslich neun explizite Runtime-Dateien aus `scripts/files.mjs`; das öffentliche Repository-Inventar ist separat dort deklariert. Kein rekursives Publizieren privater Bäume. Der Pages-Workflow ist vorbereitet, Veröffentlichung wird nicht behauptet.

### Buildschutz SP5-I1 (V6)

Der Builder und `check` prüfen das ausgelieferte Importschema semantisch über denselben `validateInputs`-Pfad, bevor ein Stage oder Disttausch beginnt. Rekursive Keyword-/Membertypen, gültige Typnamen, erforderliche Felder, Properties/Items/Combinators, Bounds und kompilierbare Patternstrings werden geprüft; unbekannte Keywords und nicht unterstützte Konstrukte werden ausdrücklich abgelehnt. Dies ist ein dokumentiertes **Projekt-Subset**, kein vollständiger JSON-Schema-Draft-Metavalidator. Exakter Umfang und Grenzen: [CODEBASE](docs/CODEBASE.md#v6-sp5-i1--ausgelieferte-schemadefinition-vor-buildtausch-prüfen). Validierungsfehler müssen alle neun letzten gültigen Runtimebytes erhalten; spätere beliebige I/O-/Crash-/Parallelitätsfehler werden damit nicht als vollständig transaktional behauptet. Registrierte API- und echte CLI-Tests prüfen gültigen Seed, Refusal und gültigen Originalschema-Restore durch den Builder.

V6 ändert keine Runtime-, Katalog-, Geld-, UI- oder Speicherbytes; öffentliche Allowlist jetzt 35 statt 33 Dateien. Native45-Runner/Orakel bleiben unverändert, hier keine erneute Native-Ausführung oder Freigabeübertragung. Die unten stehenden Native-Angaben beschreiben den eingefrorenen V5-Observer mit historischem 33-Datei-Inventar. Optional **SP5-M1 bleibt offen** (verspäteter Lesefehler kann neueren Importstatus überschreiben, nicht Rohspeicher/RAM-Katalog/Entwurf). SPEC und anschliessend QUALITY müssen diese neue Identität unabhängig prüfen.

## Vier vollständige Hauptkataloge privat konvertieren

Nur für eine vom Nutzer selbst geklärte Berechtigung. Zuerst die exakten Originalbytes aus den belegten Snapshots nach `sources/` sichern. Alle neun Artefakte und vier ausgewählte Belegseiten müssen Dateiname, Bytes und SHA-256 aus `scripts/source_metadata.json` erfüllen. Kein automatischer Netzabruf durch Konverter oder App; vorhandene gepinnte Originale niemals durch einen Neuabruf ersetzen.

```sh
npm run convert:private
npm run convert:check
npm run import:check
```

Ausgabe ausschliesslich ignoriert unter `.local/catalogs/`: `swissdrg-akut.json`, `swissdrg-geburtshaus.json`, `tarpsy.json`, `st-reha.json`. Erstkonvertierung verweigert Überschreiben; `convert:check` vergleicht die vollständigen Ergebnisbytes. Python liest XLSX mit zipfile/ElementTree und CSV strikt cp1252/Semikolon. Originale Excel-Zahlenformate werden ausgewertet; numerische Binärartefakte werden nur innerhalb 1e-12 und maximal sechs Dezimalstellen bereinigt. Sämtliche D:J-Haupttabellenwerte werden unabhängig gegen die tatsächliche 162-seitige Abrechnungs-PDF geprüft. Rohlexeme/Stile bleiben als Audit in den lokalen Hinweisen. Keine Planungsversion statt Abrechnungsversion.

[Schema 1](public/data/local-catalog.schema.json) bleibt kompatibel: eine Datei = ein System/Setting/Versionsstand. Alle 12 SwissDRG-, 87 TARPSY- und 9 ST-Reha-Spalten, vollständige Erläuterungen, Quelle, Hash und Gültigkeitsgrenzen stehen ungekürzt in `notes`. Nicht ausgewiesene Werte bleiben leer bzw. Fallgewicht `null`; ein ausdrücklich vorhandener Nullwert bleibt `0`. Unbewertete Gruppen werden nicht zu Nullvergütung umgedeutet. Bei Tageskatalogen bleibt das skalare `weight` stets `null`, die vollständigen Tabellenwerte stehen in den Hinweisen.

In der Seite «Eigenen Gruppenkatalog lokal öffnen» wählen: nichtmutierende Vorschau, bewusst bestätigen oder abbrechen. Höchstens 20 MiB, nur im Arbeitsspeicher; ein weiterer Katalog ersetzt den vorigen. Volltextsuche über alle geladenen Zeilen, 30er-DOM-Paginierung, vollständige Details. Nach Neuladen erneut öffnen. Nur SwissDRG-Fallgewichte werden in den manuellen Rechner übernommen; bei TARPSY/ST Reha keine automatische Tabellenwahl. Weder Upload noch Katalogfetch noch Katalogpersistenz oder Einbettung ganzer Gruppen in Plan-JSON. `normalize_local.py` bleibt ein zusätzliches Werkzeug für selbst vorbereitetes Vier-Spalten-UTF-8-CSV, nicht Ersatz für den Originalkonverter; Ausgaben ebenfalls nur `.local/`.

## Unterschiedliche manuelle Rechenmethoden

- **SwissDRG:** deklariertes effektives Fallgewicht × eingegebene Baserate. Kataloggewicht ist nicht automatisch effektives Fallgewicht; keine Inlier-/Outlier-Korrektur.
- **TARPSY:** genau eine Gesamtverweildauer × das für diese Dauer geltende Tagesgewicht × Baserate. `ptN` bezeichnet das Tagesgewicht für die Gesamtverweildauer N, nicht das marginale Gewicht von Tag N. **Keine Phasensumme.** Falsche Mehrabschnitt-Szenarien werden auch beim Sicherungsimport zurückgewiesen, nicht still migriert; Rohspeicher bleibt geschützt/exportierbar.
- **ST Reha:** Tage je Phase × deren Tageskostengewicht, danach Phasen summieren und mit Baserate multiplizieren. OGV sind kumulative Grenzen, nicht einzelne Phasenlängen. Phasen und abrechenbare Tage extern klären.
- Baserate bis zwei, Gewichte bis sechs Dezimalstellen; BigInt-Skalierung. Erst gesamtes Gewicht bilden, dann Gesamtbetrag einmal kaufmännisch auf CHF 0.01 runden, nicht CHF 0.05.
- **Offen, nicht null:** medizinische Gruppierung/Kodierung, Verlegung, Fallzusammenführung, Unterbrechungen, Zu-/Abschläge, Zusatzentgelte, Kostenträgeraufteilung und weitere Anwendungsregeln. Kein Grouper, keine amtliche automatische Fallberechnung oder Abrechnungs-/Erstattungsfreigabe, keine erfundene Baserate.

## Lokale Sicherheit

Nur `spitaltarife.workspace.v1`. Szenarien/Merksterne speichern nach bewusster Aktion. Entwürfe bleiben bei fremden Änderungen, Quota-Fehlern und defektem/blockiertem Speicher im Formular. Sicherungsimport: vollständige Schema-/Namespace-/Versions-/ID-Prüfung, Vorschau/Abbrechen ohne Mutation; vor bestätigtem Ersatz unveränderte Originalbytes zum Download anbieten, Vorwert erneut prüfen und Speicherung zurücklesen. Browser-Storage hat kein atomisches Cross-tab-Compare-and-swap. Bei Konflikt Original und Entwurf sichern, Ursache klären, erst dann neu laden. Keine Patientendaten, kein CSV-Export; Text ausschliesslich via DOM/textContent.

## Native Abnahme separat ausführen

Registriert: `npm run test:native`. Hier nur Authoring und browserfreie Vorprüfung, **kein nativer PASS**:

```sh
npm run test:native -- --list
npm run test:native -- --selftest
# Erst nach separater Freigabe, absolute vorhandene Pfade einsetzen:
PLAYWRIGHT_MODULE=/absoluter/pfad/playwright/index.mjs \
BROWSER_EXECUTABLE=/absoluter/pfad/camoufox-bin \
npm run test:native
```

Die Suite importiert externes Playwright, startet nur nach separater Parent-Freigabe `firefox.launch({headless:true, executablePath:…})` und verwendet eigene Kontexte sowie einen flüchtigen Server. Der observer-only native-v3-Nachfolger verändert weder Produktcode noch Daten/Schema/Methoden. Seine sechs Bereiche sind vorab in **45 Fällen**, allen **1135 echten Detailzeilen** und neun mobilen Prüfschritten je Breite deklariert. `--list` zeigt den Fallplan; `--selftest` prüft tatsächliche Fixtures/Originalhashes/vier unabhängige Raw-XML-/CSV-/Decimal-Orakel sowie browserfreie Observer-Negativkontrollen. Native Fälle bleiben dabei ausdrücklich `notrun`, nicht PASS.

Jeder Lauf erzeugt einen **neuen eindeutigen Ordner direkt unter `.local/`**. Optional `NATIVE_OUTPUT=/absolut/zum/checkout/.local/neuer-eindeutiger-name` setzen; bestehende Ordner, fremde Pfade und Symlink-Vorfahren werden verweigert, nie überschrieben. Darin: `plan.json`, vollständiges `report.json` mit SHA-Datei, sofort angehängtes `events.jsonl`, Observer-Quellkopie; bei nativer Ausführung zusätzlich echte `download.saveAs`-Bytes/Hashes, eindeutige Viewport-PNGs, HAR und Playwright-Traces je Kontext. Der Report bindet 33 Quelldateien/Identität, neun tatsächlich im Browser zurückgelesene Runtimebytes, vier private Fixtures, 13 gepinnte Originale, Orakel, Node/Browser/Plattform/Zeit/Argumente und nur **Namen** der Umgebungsvariablen. Registriert/versucht/ausgeführt/abgeschlossen/PASS/FAIL/SKIP/notrun werden getrennt erfasst, einschliesslich unerreichter Zeilen/Mobilprüfschritte und Cleanupfehler. Fehlgeschlagenes Setup oder ein einzelner Teiltest kann niemals Gesamt-PASS liefern.

Alle Seiten werden vor Navigation beobachtet, auch Navigationshilfsseiten, Fremdtab und Fehlerkontexte: sämtliche Konsolenarten, JS-/Kontextfehler, HTTP-/Request-/Methoden-/Netzwerkfehler, unerwartete Seiten/Schliessungen, Dialoge, Downloads und Crashes sind roh protokolliert; Unerwartetes lässt die Abnahme scheitern. Acht fremde Namespaces erhalten getrennte opake RAW-Sentinels mit nativer Rücklesung. Lese-/Schreib-/Quota-Injektionen treffen **nur** `spitaltarife.workspace.v1`, haben genaue Triggerzähler und behalten native Accessors für Fremdwerte. Kein `Storage.clear`, keine Mockrechnung, kein Ersetzen von Importer/Renderer/Guard.

Navigation prüft neun echte Enter-Aktivierungen kanonischer Anchors, **vor externem Kontakt abgefangen**: nur die exakt vorangemeldete GET-Hauptnavigation und der bekannte Firefox-Abbruch `NS_ERROR_ABORT` sind erwartet. Andere Fehler werden nicht pauschal unterdrückt. Dies prüft keine Live-Pages-Zielinhalte. Druck prüft den tatsächlichen Button an einem ausdrücklich deklarierten `window.print`-Boundaryadapter mit gezählten Aufrufen und `beforeprint`/`afterprint`-Dispatch sowie echte native Print-Media-DOM/CSS; **kein OS-Druckdialog/Spooler**. Mobil werden echte Zeilen, ein gefüllter Rechner samt Orakelpreis, längste echte Detailhinweise oben/unten/Quelle und native 3+6-Menüs bei 1440/768/390/320px gescrollt und als Viewportclips gesichert; Fontfloors, maximaler Seitenüberlauf, Zielgeometrie, Überlappung und Hit-Test-Occlusion werden gemessen. Ein Header-Fullpagebild genügt nicht. Vor Assertions und vor Fehler-Cleanup werden Pixels gesichert.

Das ist Authoring, **kein nativer PASS**, keine unabhängige SPEC-/QUALITY-Freigabe oder Pages-Publikation. Details und vollständiges Inventar: [docs/CODEBASE.md](docs/CODEBASE.md).

Code: MIT; daraus folgt keine Lizenzierung fremder Kataloge oder Grouper.
