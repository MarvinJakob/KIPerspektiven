# Datenschutzerklärung: Abgleich und Freigabe zu Ticket #74

Stand: 18. November 2026. [Ticket #74](https://github.com/MarvinJakob/KIPerspektiven/issues/74).
Laufzeitdateien: `frontend/src/content/legal/datenschutz.de.md` und `datenschutz.en.md`, gerendert von `Legal.tsx`
unter `/de/datenschutz` und `/en/datenschutz`.

## Verantwortliche Stelle (REQ-74-AC1)

Name, Anschrift, Telefon und E-Mail-Adresse sind unverändert aus der [Impressum-Abnahme](impressum-abnahme.md)
(Betreiberfreigabe vom 10. November 2026) übernommen. Beide Fassungen nennen dieselben Angaben; die Platzhalter
sind ersetzt. Ergänzt sind die Rechte nach Art. 15–21 und 7 Abs. 3 DSGVO sowie das Beschwerderecht nach
Art. 77 DSGVO mit der für einen Verantwortlichen in Hessen zuständigen Aufsichtsbehörde (HBDI). Ein
Datenschutzbeauftragter ist nicht benannt; die Erklärung stützt das auf das Fehlen einer Pflicht, was bei der
Freigabe zu bestätigen ist.

## Abgleich mit Implementierung und Betrieb (REQ-74-AC2, REQ-74-AC3)

Geprüfter Stand: `main` @ `bb33462`.

| Vorgang | Ist-Stand (Quelle) | Erklärung | Befund |
| --- | --- | --- | --- |
| Kontaktformular (#4) | Name, Unternehmen (optional), E-Mail, Nachricht, Sprache, Zeitpunkt; keine IP, kein User-Agent (`migrations/00016_contact_messages.sql`, `service/contact.go`). Sichtbar für `editor`/`admin` unter `/redaktion/nachrichten`. Höchstens 100 Nachrichten je IP und Stunde, Zähler nur im Arbeitsspeicher (`http/contact.go`). Protokoll ohne Inhalte. | Neuer Abschnitt „Kontaktformular“ | Es gibt **keine Löschfunktion** für Kontaktnachrichten (API und Redaktion nur lesend). Das Löschkriterium lässt sich derzeit nur direkt in der Datenbank umsetzen. Offene Entscheidung, siehe unten. |
| Beratungsanfrage (#136) | E-Mail, Sprache, Zeitpunkt; Upsert je Adresse; Löschen über die Redaktion; 5 Anfragen je IP und Stunde ([ADR 0011](adr/0011-beratungsanfragen-in-der-redaktion.md), `http/consultations.go`). | Abschnitt getrennt vom Kontaktformular | Übereinstimmend. |
| Reichweitenstatistik (#130/#142) | Tageszähler; HMAC-SHA-256-Ableitung der IP mit letztem Aufruftag; Schlüssel getrennt; Aufbewahrung für die Laufzeit des Bestands ([ADR 0010](adr/0010-statistik-ohne-kennung-und-einwilligung.md), [Betrieb](betrieb.md#ip-bereinigung-der-seitenstatistik-142)). | Unverändert, ergänzt um „keine Auswahl nötig“ | Übereinstimmend. |
| Ergebnisse der Selbsteinschätzung | Opt-in, nicht vorausgewählt; Reifegrade, Sprache, Zeitpunkt, SHA-256 der Fensterkennung; Löschen beim Entfernen des Hakens (ADR 0010). | Ergänzt um Widerruf und Aufbewahrung | Keine Aufbewahrungsdauer festgelegt; die Erklärung nennt „solange für die Bedarfsauswertung benötigt“. |
| Browserspeicherung | `ki-perspektiven.lang`, `.theme`, `.consent` (180 Tage), `ki_session` (`lib/consent.ts`, `lib/lang.ts`, `lib/theme.ts`, `auth/auth.go`). | Tabelle unverändert | Übereinstimmend mit den Cookie-Einstellungen. |
| Anwendungsprotokoll | Methode, Pfad, Status, Dauer; keine IP (`http/server.go`); Docker rotiert 5 × 10 MB ([Betrieb](betrieb.md#logs)). | Neu beschrieben | Übereinstimmend. |
| Zugriffsprotokoll Caddy | `ip_mask` nur auf `request>remote_ip`, `roll_keep_for 168h` (`deploy/Caddyfile`). | „gekürzt, nach sieben Tagen gelöscht“ | **Abweichung vermutet:** ungekürzte `client_ip` und größenbasierte Rotation. [Bug #80](https://github.com/MarvinJakob/KIPerspektiven/issues/80); Produktionsprüfung ausstehend. Blockiert die Veröffentlichung dieser Aussage. |
| Hosting | Hetzner Cloud, Server `KI-Perspektiven-PRD` ([Betrieb](betrieb.md)); früherer Servername `…-nbg1-1` (Nürnberg). | Hetzner als Auftragsverarbeiter, Rechenzentrum in Deutschland | Auftragsverarbeitungsvertrag und Standort bei der Freigabe bestätigen. |
| Sicherungen | Automatische Sicherung noch nicht eingerichtet; manuelle Kopien unter `/root/sicherung`. | „für Sicherungen gilt deren Rotation“ | Manuelle Kopien bei Löschungen mit bedenken. |

## Offene Entscheidungen vor der Freigabe (REQ-74-AC4)

1. **Löschung von Kontaktnachrichten:** Kriterium „sobald das Anliegen abschließend bearbeitet ist“ und den
   tatsächlichen Ablauf ohne Löschfunktion bestätigen; gegebenenfalls eigenes Ticket für eine Löschfunktion.
2. **Bug #80** (Zugriffsprotokoll) beheben oder die Aussage an den bestätigten Betrieb anpassen.
3. **Hetzner:** Auftragsverarbeitungsvertrag abgeschlossen, Standort Deutschland.
4. **Redaktionskonten:** Haben außer dem Betreiber weitere Personen Zugriff? Die Erklärung sagt „nur wir“.
5. **Freigabe** beider Fassungen nach datenschutzrechtlicher Prüfung durch die verantwortliche Stelle.

## Freigabe

Ausstehend. Nach der Freigabe trägt der Bearbeiter Datum, Link zum Freigabekommentar im Ticket und die
SHA-256-Werte der freigegebenen Fassungen (Zeilenenden LF) in `frontend/src/content/legal/datenschutz.freigabe.json`
ein. Der Unit-Test `REQ-74-AC4` stellt sicher, dass genau diese Fassungen ausgeliefert werden.
