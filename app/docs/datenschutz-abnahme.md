# Datenschutzerklärung: Abgleich und Freigabe zu Ticket #74

Stand: 18. November 2026. [Ticket #74](https://github.com/MarvinJakob/KIPerspektiven/issues/74).
Laufzeitdateien: `frontend/src/content/legal/datenschutz.de.md` und `datenschutz.en.md`, gerendert von `Legal.tsx`
unter `/de/datenschutz` und `/en/datenschutz`.

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
