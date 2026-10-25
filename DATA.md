# Datenherkunft, Gültigkeit und Rechte

## Öffentlich ausgeliefert

Stand: **22.10.2026**. Drei eigene Strukturprofile und vier Hinweise aus [BAG – Stationäre Tarifstrukturen](https://www.bag.admin.ch/de/stationaere-tarifstrukturen), ergänzt um überprüfte Original-/Archivmetadaten. BAG-Abruf `2026-10-22T03:39:46.474436+00:00`, HTTP 200, 778890 Bytes, SHA-256 `5911499a1e37cb122d3d03b23c409408ee883aacbca451bb2106ba84b2cb4e42`. Kein sichtbares Veröffentlichungsdatum im BAG-Artikel; allgemeiner Strukturleitfaden, kein Jahreskatalog.

**Null öffentlich gehostete amtliche Gruppen, Gewichtstabellen, Zusatzentgeltkataloge und Baserates.** Das ist eine Veröffentlichungsgrenze, keine technische Behauptung fehlender Kataloge. Maschinenlesbare Provenienz: `public/data/provenance.json`, Importbericht: `public/data/import-report.json`. `scripts/source_metadata.json` enthält nur Quellen-/Versionsmetadaten, keine Vollgruppendaten.

## Verifizierter privater Hauptbestand

| Setting | Version/Gültigkeit | Zeilen / bewertete Zeilen |
| --- | --- | ---: |
| SwissDRG Akutspitäler | 15.0 AV 2026/2026; Stand 28.11.2025 | 1081 / 1077 |
| SwissDRG Geburtshäuser | separates Blatt derselben Abrechnungs-XLSX | 8 / 8 |
| TARPSY | 6.0 für 2026/2027; PDF/CSV 14.03.2025, Seitenstand 18.03.2025 | 24 / 23 |
| ST Reha | 3.0; **physisch PV2/Titel 2025**, Stand 21.05.2024; Fortgeltung 2026 auf offizieller Archivseite | 22 / 21 |

Summe: **1135 Hauptsettingzeilen**. Die acht Geburtshauscodes kommen auch im Akutsetting vor und werden nicht zusammengeführt. Akut `P60A`, `960Z`, `961Z`, `962Z`, TARPSY `TP96Z` und ST Reha `TR96Z` haben kein ausgewiesenes Gewicht. Das SwissDRG-Deckblatt bezeichnet `P60A`, `960Z`, `961Z` ausdrücklich als nicht abrechenbar; leere Werte sind weder echte Nullen noch eine Vergütungszusage.

Die PDF-Abrechnungsversion SwissDRG hat **162 Seiten**, nicht die separat entdeckte 149-seitige Planungsversion 2024/2026. Nur die echte Abrechnungsversion wird konvertiert. ST Reha wird nicht als neu beschaffte AV2/2026-Datei ausgegeben: [offizielle Fortgeltungsevidenz, Snapshot 17.04.2026](https://web.archive.org/web/20260417021256id_/https://www.swissdrg.org/de/rehabilitation/st-reha-system-302025/rcg-katalog). Diese Seite nennt 2025,2026 und erklärt den Katalog seit 21.05.2024 für unverändert und für die Abrechnungsversion gültig.

## Echte beschaffte Downloadartefakte

Original-URLs bezeichnen das offizielle Ziel, nicht einen erfolgreich erneut geprüften Live-Abruf. Archiv-URLs sind die tatsächlich beschafften Bytes. Bytezahl, SHA-256, Erwerbszeit, Snapshot und Gültigkeit bleiben erhalten. Rohdateien wurden vor Verarbeitung nach privaten `sources/` kopiert und erneut gehasht. Keine erneuten Netzabrufe im Konverter.

### `archived-tarpsy-6.0.pdf`

- [Offizielles Original](https://www.swissdrg.org/application/files/4717/6422/7870/TARPSY_6.0_PCG_Katalog.pdf)
- [Tatsächlich beschaffter Archivsnapshot](https://web.archive.org/web/20260515203251id_/https://www.swissdrg.org/application/files/4717/6422/7870/TARPSY_6.0_PCG_Katalog.pdf)
- Snapshot `20260515203251`; Abruf `2026-10-22T04:32:49.326734+00:00`; HTTP 200; 251995 Bytes.
- SHA-256 `2a5d569846a261952b766bbb192f41a177f44fb6f9b8807842f9da355f3dc5ad`.

### `archived-drg-15.0-2026-BILLING.pdf`

- [Offizielles Original](https://www.swissdrg.org/application/files/4817/6423/9874/SwissDRG_Version_15.0_Fallpauschalenkatalog_Abrechnungsversion_2026_2026.pdf)
- [Tatsächlich beschaffter Archivsnapshot](https://web.archive.org/web/20260515204404id_/https://www.swissdrg.org/application/files/4817/6423/9874/SwissDRG_Version_15.0_Fallpauschalenkatalog_Abrechnungsversion_2026_2026.pdf)
- Snapshot `20260515204404`; Abruf `2026-10-22T04:33:36.241554+00:00`; HTTP 200; 1336886 Bytes.
- SHA-256 `1d242515d72e14f3b72d354cabbbe0945ebfb0307213f58519fb0cb3f9c42cfc`.

### `catalog-ST_Reha_3.0_RCG_Katalog_PV2_d.pdf`

- [Offizielles Original](https://www.swissdrg.org/application/files/2117/1626/6902/ST_Reha_3.0_RCG_Katalog_PV2_d.pdf)
- [Tatsächlich beschaffter Archivsnapshot](https://web.archive.org/web/20241108183935id_/https://www.swissdrg.org/application/files/2117/1626/6902/ST_Reha_3.0_RCG_Katalog_PV2_d.pdf)
- Snapshot `20241108183935`; Abruf `2026-10-22T04:36:52.895249+00:00`; HTTP 200; 167548 Bytes.
- SHA-256 `9b54269e2187745ecbbeaab8cdc2db29dee3c15024e6609cc206592c533ecdbd`.

### `catalog-TARPSY_6.0_AV_Zusatzentgeltkatalog.pdf`

- [Offizielles Original](https://www.swissdrg.org/application/files/5917/6423/2841/TARPSY_6.0_AV_Zusatzentgeltkatalog.pdf)
- [Tatsächlich beschaffter Archivsnapshot](https://web.archive.org/web/20260515201344id_/https://www.swissdrg.org/application/files/5917/6423/2841/TARPSY_6.0_AV_Zusatzentgeltkatalog.pdf)
- Snapshot `20260515201344`; Abruf `2026-10-22T04:36:52.896350+00:00`; HTTP 200; 155714 Bytes.
- SHA-256 `bfdca4f67636310abc6a46ea48e45637e5caa00b60161472fadb3d3fbce16401`.

### `catalog-SwissDRG_Version_15.0_Fallpauschalenkatalog_Abrechnungsversion_2026_2026.xlsx`

- [Offizielles Original](https://www.swissdrg.org/application/files/6217/6423/9758/SwissDRG_Version_15.0_Fallpauschalenkatalog_Abrechnungsversion_2026_2026.xlsx)
- [Tatsächlich beschaffter Archivsnapshot](https://web.archive.org/web/20260514050029id_/https://www.swissdrg.org/application/files/6217/6423/9758/SwissDRG_Version_15.0_Fallpauschalenkatalog_Abrechnungsversion_2026_2026.xlsx)
- Snapshot `20260514050029`; Abruf `2026-10-22T04:36:52.896147+00:00`; HTTP 200; 363739 Bytes.
- SHA-256 `bcad23d837934fb64ede0451f83d4b635725adb48dd282d6a6460c9baadea8dc`.

### `catalog-TARPSY_6.0_PCG_Katalog.csv`

- [Offizielles Original](https://www.swissdrg.org/application/files/7917/4305/3280/TARPSY_6.0_PCG_Katalog.csv)
- [Tatsächlich beschaffter Archivsnapshot](https://web.archive.org/web/20250912094204id_/https://www.swissdrg.org/application/files/7917/4305/3280/TARPSY_6.0_PCG_Katalog.csv)
- Snapshot `20250912094204`; Abruf `2026-10-22T04:36:52.895937+00:00`; HTTP 200; 16526 Bytes.
- SHA-256 `ac5dd51c6ce295a74a088757194347ef178c050ac3c98f36895d924f9dc051c7`.

### `catalog-TARPSY_6.0_AV_Zusatzentgeltkatalog.xlsx`

- [Offizielles Original](https://www.swissdrg.org/application/files/8017/6423/2831/TARPSY_6.0_AV_Zusatzentgeltkatalog.xlsx)
- [Tatsächlich beschaffter Archivsnapshot](https://web.archive.org/web/20260515194747id_/https://www.swissdrg.org/application/files/8017/6423/2831/TARPSY_6.0_AV_Zusatzentgeltkatalog.xlsx)
- Snapshot `20260515194747`; Abruf `2026-10-22T04:36:52.895715+00:00`; HTTP 200; 46638 Bytes.
- SHA-256 `295df6871fa283659a8f5b420bc9c18d1819cb43c0a6b0ef060feb471d195765`.

### `catalog-ST_Reha_3.0_RCG_Katalog_PV2_d.csv`

- [Offizielles Original](https://www.swissdrg.org/application/files/8717/1626/6912/ST_Reha_3.0_RCG_Katalog_PV2_d.csv)
- [Tatsächlich beschaffter Archivsnapshot](https://web.archive.org/web/20241108180312id_/https://www.swissdrg.org/application/files/8717/1626/6912/ST_Reha_3.0_RCG_Katalog_PV2_d.csv)
- Snapshot `20241108180312`; Abruf `2026-10-22T04:36:53.997116+00:00`; HTTP 200; 3285 Bytes.
- SHA-256 `a633b6b536f8b128574bc45953e2bfb0d802aaea39e34db458ae77316a9b674a`.

### `catalog-2026-burn-supplement.pdf`

- [Offizielles Original](https://www.swissdrg.org/application/files/2017/7460/3430/Ausserplanmaessige_Zusatzentgelte_zur_Verguetung_von_Faellen_mit_Verbrennungsopfern.pdf)
- [Tatsächlich beschaffter Archivsnapshot](https://web.archive.org/web/20260515200747id_/https://www.swissdrg.org/application/files/2017/7460/3430/Ausserplanmaessige_Zusatzentgelte_zur_Verguetung_von_Faellen_mit_Verbrennungsopfern.pdf)
- Snapshot `20260515200747`; Abruf `2026-10-22T04:39:21.915911+00:00`; HTTP 200; 411303 Bytes.
- SHA-256 `5de77ed8e2adb066e955fc262fd92880e4704851f3f8bf0eb437103c0db22e65`.

## Anlagen und offene Grenzen

- Die originale SwissDRG-XLSX enthält Anlagen 2 und 3 mit bewerteten/unbewerteten Zusatzentgelten. Sie sind privat erhalten, aber **nicht als Hauptgruppen oder automatisierte ZE modelliert**. Ihre CHOP-/ATC-/Unterpositionszeilen dürfen nicht nach Code allein dedupliziert werden.
- TARPSY-Zusatzentgelt-XLSX/PDF 2026/2026 und das ausserplanmässige SwissDRG-Verbrennungs-ZE-PDF vom 27.03.2026 liegen privat vor. Das Verbrennungs-PDF ist kein Basispreis; es hat eigene klinische/zeitliche/institutionelle Bedingungen. Keine automatische Anwendung.
- **ST-Reha-spezifischer Zusatzentgeltkatalog 2026 fehlt.** Auch die neu beschriftete [AV2-PDF](https://www.swissdrg.org/application/files/1017/6422/3783/ST_Reha_3.0_RCG_Katalog_AV2_d.pdf) wurde nicht als tatsächliche Datei beschafft. Dies ist ein fehlgeschlagenes Entdeckungsziel, kein vorhandener Download.
- SwissDRG-EDV-ZIP und Verbrennungs-ZE-ZIP nicht beschafft. Weitere Anwendungsempfehlungen/Änderungen bis Oktober 2026 nicht vollständig abgeglichen. Vier vollständige **gepinnt beschaffte Hauptsettings** sind nicht gleich vollständiger Gesamtänderungsbestand.
- Keine spital-/kantons-/versicherer-/zeitraumbezogenen Baserates. Keine medizinische Klassifikation, Grouper-Logik, Kodierungsprüfung, automatische Verweildauer-/Verlegungs-/ZE-Korrektur oder Abrechnungsfreigabe.

## Methoden und vollständige lokale Felder

Die tatsächlichen PDF-Erläuterungen wurden gelesen. **TARPSY:** Gesamtverweildauer mit dem für diese Verweildauer geltenden Tageskostengewicht multiplizieren; die Phasen werden nicht addiert. Die CSV hat 87 Spalten: `pcg,apcg,Bez_apcg,Bez_pcg,regp1,regp2,regp3,pt1…pt80`. `ptN` ist nicht das marginale Gewicht von Tag N. Letzte im PDF ausgewiesene „ab“-Dauer und tariflich massgebliche Verweildauer extern prüfen.

**ST Reha:** Tage je Phase mit deren Tagesgewicht multiplizieren, danach summieren. Die neun Spalten `rcg,Bez_rcg,arcg,Bez_arcg,tkg_ph1,ogv_ph1,tkg_ph2,ogv_ph2,tkg_ph3` bleiben erhalten. OGV sind kumulative obere Grenzverweildauern. Keine automatische Berechnung abrechenbarer Tage aus Kalenderdaten oder klinische Gruppierung.

**SwissDRG:** Alle zwölf Originalspalten einschliesslich Partition, Bezeichnung, ANK-Gewicht, mittlerer Verweildauer, unterer/oberer Grenzverweildauer, täglichen Zu-/Abschlagsgewichten, externem Verlegungsabschlag, Verlegungsfallpauschale und Wiederaufnahme-Ausnahme bleiben in den lokalen Details erhalten, zusammen mit MDC-Kontext und vollständigen Deckblatt-Fussnoten. Excel-Stil und ursprüngliche numerische XML-Lexeme werden als Audit getrennt von bereinigten Dezimalwerten mitgeführt. Alle nichtleeren D:J-Werte beider Hauptsettings werden gegen die tatsächlichen unabhängigen PDF-Zahlen verglichen. Binäre Enden sind keine neue fachliche Präzision.

Die vier Konverterdateien verwenden das kompatible Schema 1; komplette Quellfelder und Regeltexte stehen in bounded `notes` (maximal 20000 Zeichen pro Gruppe, tatsächlich deutlich darunter). Die Browser-App validiert Form/Typen, **nicht die Herkunft einer fremden Importdatei**. SHA-256 im Import ist deklarierte Provenienz; nur der lokale gepinnte Konverter prüft Originalbytes. Alle offenen tariflichen Anpassungen bleiben offen statt CHF 0.

## Historie bleibt Historie

Der erste Pilotabruf der drei BAG-verlinkten Systemseiten lieferte jeweils HTTP 500 mit 568 Bytes und SHA-256 `d43f5753210c3a9ca590c1bc81f52d9768accc5c5c31bdd3c8ea9acb3a24a5f5`. Weitere erste Suchen führten zu 403/429, Suchsperren und unpassenden Einstiegen. Diese ursprünglichen Nachweise werden nicht als erfolgreiche Katalogbeschaffung umgeschrieben. Sie waren aber nie ein Beleg genereller Nichtexistenz; der spätere Archivlauf hat neun echte Artefakte geliefert. Ursprüngliche vier Pilot-Manifestzeilen bleiben unverändert in der öffentlichen Provenienz.

Die vier ausgewählten offiziellen Archivseiten (SwissDRG, TARPSY, ST Reha, Rechte) sind als separate Belege mit Originalmetadaten gesichert. Deren historisches `validity`-Freitextfeld aus der Recovery bezeichnet sie zutreffend nicht als Tarifdatensätze; die Versions-/Fortgeltungsaussagen stehen in den Artefaktmetadaten und dieser eigenen Einordnung.

## Rechteentscheidung

[Archivierte offizielle Nutzungsbedingungen vom 17.04.2026](https://web.archive.org/web/20260417024654id_/https://www.swissdrg.org/de/datenschutz-und-nutzungsbedingungen) behalten Rechte an Texten, Daten, Listen und Dokumenten vor und verlangen insbesondere für Kopieren und Veröffentlichen vorherige schriftliche Genehmigung. Der tatsächliche Bedingungstext wurde geprüft. Aktuelle Live-Bedingungen lieferten HTTP 500. Keine offene Lizenz oder schriftliche Nachnutzungserlaubnis nachgewiesen.

Das ist **keine abschliessende juristische Bewertung einzelner reiner Tarifwerte**, aber auch keine Grundlage für einen weltweiten Vollkatalog-Mirror. Öffentliche Erreichbarkeit und der Nutzerauftrag übertragen keine Rechte Dritter. Es wird keine Vereinbarung für den Nutzer angenommen und keine allgemeine private Nutzungslizenz behauptet. Der Konverter setzt eine selbst geklärte Berechtigung voraus; technische Verfügbarkeit ist keine Erlaubnis. Eigener Code ist MIT, fremde Kataloge sind davon nicht erfasst.

## Reproduktion und Prüfgrenzen

`scripts/source_metadata.json` bindet neun Artefakte plus vier Belegseiten an Bytes/Hash/URLs. `scripts/import_catalog.py --check` verifiziert private Originale und reproduziert eigene öffentliche Referenzdaten bytegleich. `scripts/convert_main_catalogs.py --check` reproduziert alle vier lokalen Hauptsettings aus diesen Originalbytes; Ausgaben ausschliesslich `.local/`, keine Netzwerkaufrufe. CSV cp1252, XLSX stdlib, PDF-Text über vorhandenes `pdftotext`.

Ein sauberer öffentlicher Checkout funktioniert mit `npm ci`, `npm run check`, `npm test`, `npm run build` ohne `sources/`, `.local/` oder bestehendes `dist/`. Die sechs tatsächlichen Source-Tests melden dort ausdrücklich SKIP; keine Ersatzkataloge. Native Firefox/Camoufox-, Pixel-, Live-Pages- und unabhängige SPEC-/QUALITY-Abnahme sind separate Gates. Hier wurde kein Browser gestartet und keine Veröffentlichung vorgenommen.
