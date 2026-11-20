# Datenschutzerklärung: Abgleich und Freigabe

Laufzeitdateien: `frontend/src/content/legal/datenschutz.de.md` und `datenschutz.en.md`, gerendert von `Legal.tsx`
unter `/de/datenschutz` und `/en/datenschutz`. Der erste Teil beschreibt die aktuelle Fassung aus
[Ticket #125](https://github.com/MarvinJakob/KIPerspektiven/issues/125). Sie ändert die gekürzte Fassung aus
[Ticket #118](https://github.com/MarvinJakob/KIPerspektiven/issues/118) nur im Abschnitt „Cookies und
Browserspeicher“; der Abgleich zu #118 gilt im Übrigen weiter. Der Abgleich zur Vorgängerfassung aus
[Ticket #74](https://github.com/MarvinJakob/KIPerspektiven/issues/74) steht darunter und bleibt als Verlauf erhalten.

# Fassung ohne Tabelle der Browserspeicher-Einträge zu Ticket #125

Stand: 20. November 2026. Ausgangsfassung: `main` @ `bb07f25`.

## Änderung

Im Abschnitt „Cookies und Browserspeicher“ („Cookies and browser storage“) entfällt die Tabelle mit den vier
Einträgen `ki-perspektiven.lang`, `ki-perspektiven.theme`, `ki-perspektiven.consent` und `ki_session` ohne
Ersatztext. Der einleitende Absatz bleibt wörtlich erhalten: Gespeichert wird nur, was für eine gewählte Funktion
unbedingt erforderlich ist (§ 25 Abs. 2 TDDDG), eine Einwilligung ist dafür nicht nötig, und die Speicherung lässt
sich über „Cookie-Einstellungen“ im Footer abschalten. Alle übrigen Abschnitte sind unverändert (Unit-Test
`REQ-125-AC3`). Das Stand-Datum bleibt der 20. November 2026, weil die neue Fassung am selben Tag entsteht.

| | bisher (`main` @ `bb07f25`) | neu |
| --- | --- | --- |
| Deutsch | 697 Wörter | 632 Wörter |
| Englisch | 736 Wörter | 668 Wörter |

Gezählt mit `wc -w` über die Markdown-Datei.

## Geänderte Pflichtangaben gegenüber #118

| Nr. | Angabe | Textstelle seit #125 |
| --- | --- | --- |
| P7 | Speicherdauer | Zeile „Speicherdauer“ in jedem Verarbeitungsabschnitt. Die Spalte „Speicherdauer“ im Browserspeicher entfällt. |
| P14 | Speichern und Auslesen im Endgerät | „Cookies und Browserspeicher“: allgemeiner Hinweis nach § 25 Abs. 2 TDDDG und Verweis auf die Cookie-Einstellungen; Einwilligung nach § 25 Abs. 1 TDDDG in „Ergebnisse der Selbsteinschätzung“. Zweck und Speicherdauer der einzelnen Einträge stehen nicht mehr in der Erklärung. |

**Bewusste Abgrenzung zu P14.** #118 führte die Information „für jeden Eintrag im Browserspeicher“. Die
verantwortliche Stelle hat am 20. November 2026 entschieden, die Tabelle ersatzlos zu streichen (Entscheidung 1 in
Ticket #125). Zweck und Speicherdauer der vier Einträge nennt die Erklärung damit nicht mehr. Der Dialog
„Cookie-Einstellungen“ im Footer, auf den die Erklärung verweist, führt die Einträge weiterhin einzeln mit Zweck
und Laufzeit auf (`frontend/src/i18n/de.ts`, `en.ts`); er ist nicht Teil der Erklärung.

## Abgleich mit Anwendung und Betrieb

| Verarbeitung | Ist-Stand (Quelle) | Erklärung | Befund |
| --- | --- | --- | --- |
| Browserspeicher | Unverändert: `ki-perspektiven.lang`, `.theme`, `.consent` (180 Tage), `ki_session` (zwölf Stunden) (`lib/lang.ts`, `lib/theme.ts`, `lib/consent.ts`, `auth`, `service.SessionTTL`). | Allgemeiner Hinweis ohne einzelne Einträge | Die Aussage „nur, was für eine von dir gewählte Funktion unbedingt erforderlich ist“ trifft auf alle vier Einträge zu. Einträge, Zwecke und Laufzeiten sind nicht mehr einzeln genannt (Abgrenzung zu P14). |

An der Speicherung selbst ändert dieses Ticket nichts. Die übrigen Zeilen des Abgleichs zu #118 gelten unverändert.

## Freigabe (REQ-125-AC5)

Freigegeben am 20. November 2026 durch die verantwortliche Stelle (Marvin Jakob), Nachweis:
[Freigabekommentar in #125](https://github.com/MarvinJakob/KIPerspektiven/issues/125#issuecomment-7036436861).
Freigegebene Revision: Commit `6d09b27`, SHA-256 (Zeilenenden LF) DE
`e44d4725b5391fb6fa51de3fa74e0a62c31354d39d1c6ac6e19667708c6f61c1`, EN
`985602afba3e50446a19314aea8182d64f9355681ab3ec2bc27e0ec805697eca`. Die Werte stehen in
`frontend/src/content/legal/datenschutz.freigabe.json`; der Unit-Test `REQ-125-AC5` stellt sicher, dass genau
diese Fassungen ausgeliefert werden. Jede spätere Textänderung braucht eine neue Freigabe. Die Freigabe zu #118
weiter unten gilt für die Vorfassung und bleibt als Verlauf erhalten.

# Gekürzte Fassung zu Ticket #118

Stand: 20. November 2026. Geprüfter Stand von Anwendung und Betriebsdokumentation: `main` @ `bf59306`.
Die Abschnittsnamen folgen der deutschen Fassung; die englische hat dieselben Abschnitte in derselben Reihenfolge
(Unit-Test `REQ-118-AC6`).

## Umfang

| | bisher (`main` @ `3994c27`) | neu | Grenze nach REQ-118-AC4 |
| --- | --- | --- | --- |
| Deutsch | 1.581 Wörter | 697 Wörter | 790 |
| Englisch | 1.752 Wörter | 736 Wörter | 876 |

Gezählt mit `wc -w` über die Markdown-Datei.

## Pflichtangaben und Textstellen (REQ-118-AC1)

| Nr. | Angabe | Textstelle |
| --- | --- | --- |
| P1 | Verantwortlicher | „Verantwortliche Stelle“: Name, Anschrift, Telefon, E-Mail |
| P2 | Datenschutzbeauftragter | Entfällt, keiner benannt (Entscheidung vom 18. November 2026) |
| P3 | Zweck und Rechtsgrundlage | Zeilen „Zweck“ und „Rechtsgrundlage“ in jedem der fünf Verarbeitungsabschnitte |
| P4 | Berechtigtes Interesse | Zeile „Rechtsgrundlage“ in „Aufruf der Website“, „Reichweitenstatistik“ und „Kontaktformular“ |
| P5 | Empfänger | „Empfänger“: Hetzner Online GmbH als Auftragsverarbeiter |
| P6 | Drittland | Entfällt, keine Übermittlung |
| P7 | Speicherdauer | Zeile „Speicherdauer“ in jedem Verarbeitungsabschnitt, Spalte „Speicherdauer“ im Browserspeicher |
| P8 | Betroffenenrechte | „Deine Rechte“ (Art. 15, 16, 17, 18, 20) und „Widerspruchsrecht“ (Art. 21) |
| P9 | Widerruf der Einwilligung | „Deine Rechte“ (Art. 7 Abs. 3); wie der Widerruf geschieht, steht in „Ergebnisse der Selbsteinschätzung“ |
| P10 | Beschwerderecht | „Deine Rechte“ (Art. 77) mit dem Hessischen Beauftragten für Datenschutz und Informationsfreiheit |
| P11 | Erforderlichkeit | Zeile „Ohne diese Daten“ in allen Verarbeitungsabschnitten außer der Reichweitenstatistik, für die Besucher nichts bereitstellen |
| P12 | Automatisierte Entscheidung | Entfällt, findet nicht statt |
| P13 | Getrennter Hinweis auf den Widerspruch | Eigener Abschnitt „Widerspruchsrecht“, als hervorgehobener Block gesetzt |
| P14 | Speichern und Auslesen im Endgerät | „Cookies und Browserspeicher“ mit vier Einträgen; Einwilligung nach § 25 Abs. 1 TDDDG in „Ergebnisse der Selbsteinschätzung“ |
| P15 | Klare, einfache Form | Gleicher Aufbau aller Verarbeitungsabschnitte: Daten, Zweck, Rechtsgrundlage, Speicherdauer (Unit-Test `REQ-118-AC5`) |

## Abgleich mit Anwendung und Betrieb (REQ-118-AC2)

| Verarbeitung | Ist-Stand (Quelle) | Erklärung | Befund |
| --- | --- | --- | --- |
| Zugriffsprotokoll | IP auf /24 beziehungsweise /48 gekürzt, tägliche Rotation, rotierte Dateien 120 Stunden (`deploy/Caddyfile`); kein Eintrag älter als sieben Tage ([Betrieb](betrieb.md#logs)). | „nur gekürzt“, „höchstens sieben Tage“ | Übereinstimmend. Die frühere Formulierung „nach sieben Tagen gelöscht“ war eine Obergrenze, die tatsächliche Aufbewahrung liegt bei rund sechs Tagen. Die neue Formulierung nennt die Obergrenze als solche. |
| Anwendungsprotokoll | Methode, Pfad, Status, Dauer; keine IP-Adresse, keine Formularinhalte (`http/server.go`). | Nicht mehr beschrieben | Enthält keine personenbezogenen Daten, deshalb keine Pflichtangabe. |
| Schutz der Formulare | Kontaktformular und Beratungsanfrage zählen Anfragen je IP-Adresse im Arbeitsspeicher, Fenster eine Stunde (`http/contact.go`, `http/consultations.go`). Anmeldung der Redaktion: 15 Minuten ([Login-Begrenzung](login-begrenzung.md)). | Einmal in „Aufruf der Website“: IP-Adresse nach einem Formularversand höchstens eine Stunde | Übereinstimmend. Die Anfragegrenzen entfallen als technisches Detail. |
| Reichweitenstatistik | Tageszähler; Ableitung der IP-Adresse mit letztem Aufruftag; Aufbewahrung für die Laufzeit des Bestands, Prüfung mindestens jährlich ([ADR 0010](adr/0010-statistik-ohne-kennung-und-einwilligung.md), [Betrieb](betrieb.md#ip-bereinigung-der-seitenstatistik-142)). | „Pseudonym“, „Tag des letzten Aufrufs“, „prüfen wir jährlich“ | Übereinstimmend. Verfahren und Schlüsselverwaltung entfallen als technisches Detail. |
| Kontaktformular | Name, Unternehmen (optional), E-Mail, Nachricht, Sprache, Zeitpunkt (`migrations/00016_contact_messages.sql`); Löschung sechs Monate nach Eingang (`service/retention.go`, #90). | Datenliste und „spätestens sechs Monate nach Eingang“ | Übereinstimmend. |
| Beratungsanfrage | E-Mail, Sprache, Zeitpunkt; Löschen nach Terminabstimmung über die Redaktion; automatisch sechs Monate nach der letzten Anfrage ([ADR 0011](adr/0011-beratungsanfragen-in-der-redaktion.md), `service/retention.go`). | Datenliste, „sobald der Termin abgestimmt ist, spätestens aber sechs Monate nach deiner letzten Anfrage“ | Übereinstimmend. |
| Ergebnisse der Selbsteinschätzung | Opt-in, nicht vorausgewählt; Reifegrade, Sprache, Zeitpunkt, Hash der Fensterkennung; Löschen beim Entfernen des Hakens (ADR 0010). | Datenliste, Einwilligung, sofortige Löschung beim Widerruf | Übereinstimmend. Eine feste Aufbewahrungsdauer ist weiterhin nicht festgelegt; die Erklärung nennt das Kriterium. |
| Browserspeicher | `ki-perspektiven.lang`, `.theme`, `.consent` (180 Tage), `ki_session` (`lib/lang.ts`, `lib/theme.ts`, `lib/consent.ts`, `auth`); Sitzung gilt zwölf Stunden (`service.SessionTTL`). | Tabelle mit vier Einträgen | Übereinstimmend. Die Dauer von `ki_session` ist jetzt mit zwölf Stunden beziffert statt mit „Sitzungsdauer“. |
| Hosting | Hetzner Cloud, Auftragsverarbeitung, Rechenzentrum in Deutschland (Entscheidung vom 18. November 2026, [Betrieb](betrieb.md)). | „Empfänger“ | Übereinstimmend. |
| Redaktionskonten (#64) | E-Mail, Anzeigename, Rollen, Profilbild der Konten. | Nicht beschrieben | Betrifft nur Personen mit Redaktionskonto. Laut Entscheidung vom 18. November 2026 hat nur der Betreiber ein Konto. Mit der Freigabe neu zu bestätigen. |
| LinkedIn (#85) | Die Anwendung veröffentlicht Titel und Link eigener Beiträge. Auf der Website stehen nur gewöhnliche Links zu LinkedIn. | Nicht beschrieben | Keine Daten von Besuchern. Die Content-Security-Policy (`default-src 'self'`) lässt keine fremden Inhalte zu. |

Der Produktionsserver war bei der Prüfung am 20. November 2026 per SSH nicht erreichbar. Der Abgleich stützt sich
deshalb auf Code und Betriebsdokumentation des geprüften Stands, nicht auf eine Sichtprüfung in Produktion.

## Weitere Befunde

1. **Antworten per E-Mail.** Die Erklärung nennt als Empfänger nur Hetzner. Antworten auf Nachrichten und
   Beratungsanfragen gehen über das Postfach des Betreibers. Ob dessen Anbieter als Empfänger zu nennen ist,
   entscheidet die verantwortliche Stelle. Die Vorgängerfassung nannte ihn ebenfalls nicht.
2. **Manuelle Sicherungen.** Die automatische Sicherung ist nicht eingerichtet. Manuelle Kopien unter
   `/root/sicherung` können Nachrichten und Anfragen über die Löschfrist hinaus enthalten. Das betrifft die
   Datenverarbeitung und liegt außerhalb dieses Tickets.

## Zuordnung der Aussagen (REQ-118-AC3)

Jede Aussage der neuen Fassung dient einer Pflichtangabe:

| Abschnitt | Aussagen | Pflichtangabe |
| --- | --- | --- |
| Verantwortliche Stelle | Name, Anschrift, Telefon, E-Mail | P1 |
| Fünf Verarbeitungsabschnitte | Zeile „Daten“ (Gegenstand der Verarbeitung), „Zweck“, „Rechtsgrundlage“ | P3, P4 |
| | Zeile „Speicherdauer“ | P7 |
| | Zeile „Ohne diese Daten“ | P11 |
| Ergebnisse der Selbsteinschätzung | Einwilligung und Widerruf durch Entfernen des Hakens | P9, P14 |
| Cookies und Browserspeicher | Einleitung, vier Einträge mit Zweck und Dauer, Abschalten über die Cookie-Einstellungen | P14 |
| Empfänger | Hetzner als Auftragsverarbeiter | P5 |
| Deine Rechte | Rechte, Widerruf, Beschwerde, Kontaktweg | P8, P9, P10 |
| Widerspruchsrecht | Hinweis nach Art. 21 | P13 |
| Stand-Datum | Datum der Fassung | P15 |

Gestrichen sind: „Kurz gesagt“, Verfahren und Bitlängen der IP-Kürzung und der Ableitung, Rotation des
Anwendungsprotokolls, Anfragegrenzen, die Spalten „Nicht gespeichert“, die Spalten „Anbieter“ und „Einordnung“
im Browserspeicher sowie die Negativhinweise zu Tracking, Weitergabe, Drittländern und automatisierten
Entscheidungen. Der Unit-Test `REQ-118-AC3` prüft, dass kein Satz doppelt vorkommt und die gestrichenen
technischen Details nicht zurückkehren. Die Zuordnung in dieser Tabelle ist eine manuelle Prüfung.

## Freigabe der gekürzten Fassung (REQ-118-AC7)

Freigegeben am 20. November 2026 durch die verantwortliche Stelle (Marvin Jakob), Nachweis:
[Freigabekommentar in #118](https://github.com/MarvinJakob/KIPerspektiven/issues/118#issuecomment-7034994341).
Freigegebene Revision: Commit `e500291`, SHA-256 (Zeilenenden LF) DE
`26e507c5f098c29cf8447800eab53aacab4219557c45db7572463c4156b6ea20`, EN
`a7c452eae9089a2b1e2f6c2e3f769c6b273dbf4ab4117d568af81e3fb1a80f3f`. Die Werte stehen in
`frontend/src/content/legal/datenschutz.freigabe.json`; der Unit-Test `REQ-118-AC7` stellt sicher, dass genau
diese Fassungen ausgeliefert werden. Jede spätere Textänderung braucht eine neue Freigabe.

Mit der Freigabe entschieden: Die Negativhinweise zu Drittländern und automatisierten Entscheidungen entfallen,
als Empfänger ist nur Hetzner genannt, und der Zielumfang nach REQ-118-AC4 gilt.

# Vorgängerfassung zu Ticket #74

Stand: 18. November 2026. [Ticket #74](https://github.com/MarvinJakob/KIPerspektiven/issues/74).

## Verantwortliche Stelle (REQ-74-AC1)

Name, Anschrift, Telefon und E-Mail-Adresse sind unverändert aus der [Impressum-Abnahme](impressum-abnahme.md)
(Betreiberfreigabe vom 10. November 2026) übernommen. Beide Fassungen nennen dieselben Angaben; die Platzhalter
sind ersetzt. Ergänzt sind die Rechte nach Art. 15–21 und 7 Abs. 3 DSGVO sowie das Beschwerderecht nach
Art. 77 DSGVO mit der für einen Verantwortlichen in Hessen zuständigen Aufsichtsbehörde (HBDI).

## Abgleich mit Implementierung und Betrieb (REQ-74-AC2, REQ-74-AC3)

Geprüfter Stand: `main` @ `bb33462`.

| Vorgang | Ist-Stand (Quelle) | Erklärung | Befund |
| --- | --- | --- | --- |
| Kontaktformular (#4) | Name, Unternehmen (optional), E-Mail, Nachricht, Sprache, Zeitpunkt; keine IP, kein User-Agent (`migrations/00016_contact_messages.sql`, `service/contact.go`). Sichtbar für `editor`/`admin` unter `/redaktion/nachrichten`. Höchstens 100 Nachrichten je IP und Stunde, Zähler nur im Arbeitsspeicher (`http/contact.go`). Protokoll ohne Inhalte. | Neuer Abschnitt „Kontaktformular“ | Es gibt **keine Löschfunktion** für Kontaktnachrichten (API und Redaktion nur lesend). Frist sechs Monate, Umsetzung in #90. |
| Beratungsanfrage (#136) | E-Mail, Sprache, Zeitpunkt; Upsert je Adresse; Löschen über die Redaktion; 5 Anfragen je IP und Stunde ([ADR 0011](adr/0011-beratungsanfragen-in-der-redaktion.md), `http/consultations.go`). | Abschnitt getrennt vom Kontaktformular | Übereinstimmend. |
| Reichweitenstatistik (#130/#142) | Tageszähler; HMAC-SHA-256-Ableitung der IP mit letztem Aufruftag; Schlüssel getrennt; Aufbewahrung für die Laufzeit des Bestands ([ADR 0010](adr/0010-statistik-ohne-kennung-und-einwilligung.md), [Betrieb](betrieb.md#ip-bereinigung-der-seitenstatistik-142)). | Unverändert, ergänzt um „keine Auswahl nötig“ | Übereinstimmend. |
| Ergebnisse der Selbsteinschätzung | Opt-in, nicht vorausgewählt; Reifegrade, Sprache, Zeitpunkt, SHA-256 der Fensterkennung; Löschen beim Entfernen des Hakens (ADR 0010). | Ergänzt um Widerruf und Aufbewahrung | Keine Aufbewahrungsdauer festgelegt; die Erklärung nennt „solange für die Bedarfsauswertung benötigt“. |
| Browserspeicherung | `ki-perspektiven.lang`, `.theme`, `.consent` (180 Tage), `ki_session` (`lib/consent.ts`, `lib/lang.ts`, `lib/theme.ts`, `auth/auth.go`). | Tabelle unverändert | Übereinstimmend mit den Cookie-Einstellungen. |
| Anwendungsprotokoll | Methode, Pfad, Status, Dauer; keine IP (`http/server.go`); Docker rotiert 5 × 10 MB ([Betrieb](betrieb.md#logs)). | Neu beschrieben | Übereinstimmend. |
| Zugriffsprotokoll Caddy | `remote_ip` und `client_ip` auf /24 bzw. /48 gekürzt, `X-Forwarded-For`/`X-Real-Ip`/`Forwarded` nicht protokolliert, tägliche Rotation, fünf Tage Aufbewahrung, `caddy:2.11.9-alpine` (`deploy/Caddyfile`, `compose.yaml`). | „gekürzt, nach sieben Tagen gelöscht“ | Übereinstimmend seit [Bug #80](https://github.com/MarvinJakob/KIPerspektiven/issues/80) (ausgeliefert mit `fd8871f`, Produktionsprüfung und Bereinigung der Altbestände am 18. November 2026). |
| Hosting | Hetzner Cloud, Server `KI-Perspektiven-PRD` ([Betrieb](betrieb.md)); früherer Servername `…-nbg1-1` (Nürnberg). | Hetzner als Auftragsverarbeiter, Rechenzentrum in Deutschland | Vom Betreiber bestätigt (AVV, Standort). |
| Sicherungen | Automatische Sicherung noch nicht eingerichtet; manuelle Kopien unter `/root/sicherung`. | „für Sicherungen gilt deren Rotation“ | Manuelle Kopien bei Löschungen mit bedenken. |

## Entscheidungen der verantwortlichen Stelle (18. November 2026)

1. **Kontaktnachrichten:** Löschung spätestens sechs Monate nach Eingang, auf Wunsch früher. Die automatische
   Löschung und das Löschen einzelner Nachrichten setzt [#90](https://github.com/MarvinJakob/KIPerspektiven/issues/90)
   um; die ältesten Nachrichten stammen vom 17. November 2026 (Migration `00016`), die Frist greift also
   frühestens im Mai 2027.
2. **Hetzner:** Auftragsverarbeitungsvertrag abgeschlossen, Rechenzentrum in Deutschland.
3. **Redaktionskonten:** Nur der Betreiber hat ein Redaktionskonto; die Erklärung nennt ihn als einzige Person mit Zugriff.
4. **Datenschutzbeauftragter:** Keine Aussage in der Erklärung.

## Freigabe

Freigegeben am 18. November 2026 durch die verantwortliche Stelle (Marvin Jakob), Nachweis:
[Freigabekommentar in #74](https://github.com/MarvinJakob/KIPerspektiven/issues/74#issuecomment-6984305594).
Freigegebene Revision: Commit `902f942`, SHA-256 (Zeilenenden LF) DE
`be7d5c7d59fa85ee3d41f31878dc217f7d48883842788cb2da8d4011078279ee`, EN
`8dd5e7f7857c47ba3edf3c4ed9eaa2dac87697ee3206adccbf31ac2598663671`. Die Werte stehen in
`frontend/src/content/legal/datenschutz.freigabe.json`; der Unit-Test `REQ-74-AC4` stellt sicher, dass genau
diese Fassungen ausgeliefert werden. Jede spätere Textänderung braucht eine neue Freigabe.
