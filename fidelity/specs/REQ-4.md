---
id: REQ-4
issue: https://github.com/MarvinJakob/AIPerspectives/issues/4
status: verifiziert
geprueft_am: 2026-11-16
---

# REQ-4 Kontaktseite mit Nachrichtenformular und Eingang im Redaktionssystem

## Ziel

Besucher hinterlassen über eine öffentliche Kontaktseite eine Nachricht mit ihren Kontaktdaten, damit sie mit dem Betreiber in Kontakt treten können. Angemeldete Redaktionsnutzer sehen diese Nachrichten im Redaktionssystem; für alle anderen bleiben sie verborgen.

## Begriffe

- **Kontaktseite:** öffentliche Seite unter dem Sprachpräfix (`/de/…`, `/en/…`). Der genaue Pfad ist frei wählbar.
- **Formularfelder:** Eingabefelder mit sichtbarer Beschriftung, die zugleich ihr zugänglicher Name ist:

  | Feld | Deutsch (Name enthält) | Englisch (Name enthält) | Pflicht |
  |---|---|---|---|
  | Name | „Name“ (z. B. „Name“, „Dein Name“) | „Name“ (z. B. „Name“, „Your name“) | ja |
  | Unternehmen | „Unternehmen“ oder „Firma“ | „Company“ oder „Organisation/Organization“ | nein |
  | E-Mail-Adresse | „E-Mail“ | „Email“ oder „E-mail“ | ja |
  | Nachricht | „Nachricht“ | „Message“ | ja |

  Dazu eine Schaltfläche, deren Name „senden“ bzw. „send“ oder „submit“ enthält.
- **Fehlermeldung eines Feldes:** sichtbarer Text in der Sprache der Seite, der dem Feld zugeordnet ist: Das Feld ist als ungültig markiert (`aria-invalid="true"`) und hat den Text als zugängliche Beschreibung, so dass ein Screenreader ihn mit dem Feld vorliest. Deutsche Meldungen enthalten ein Wort wie „bitte“, „angeben“, „eingeben“, „ausfüllen“, „Pflicht…“, „erforderlich“, „fehlt“ oder „gültig“; englische eines wie „please“, „enter“, „provide“, „required“, „missing“ oder „valid“.
- **Bestätigung:** nach dem Absenden neu sichtbarer Text, der den Dank oder Eingang ausdrückt. Deutsch: „Danke“, „Vielen Dank“, „gesendet“, „übermittelt“, „erhalten“ oder „eingegangen“; Englisch: „Thank“, „sent“, „received“ oder „submitted“.
- **Berechtigte Redaktionsnutzer:** angemeldete Redaktionskonten mit Rolle `editor` oder `admin` (Testkonten `redaktion@example.test`, `admin@example.test` aus `DEV_SEED`).
- **Nachrichtenbereich:** Seite der Redaktion unter `/redaktion/…`, erreichbar über einen Navigationseintrag, dessen Name „Nachricht“ oder „Kontakt“ enthält.

## Akzeptanzkriterien

| ID | Kriterium | Test |
|---|---|---|
| REQ-4-AC1 | Auf `/de` führt ein sichtbarer Link „Kontakt“ (bei schmaler Ansicht ggf. im geöffneten Menü) zu einer Seite unter `/de/…` mit Hauptüberschrift, den vier Formularfeldern auf Deutsch und der Schaltfläche zum Senden. Der direkte Aufruf dieser URL liefert Status 200. Die Seite hat keinen horizontalen Überlauf. | `tests/REQ-4.spec.ts` |
| REQ-4-AC2 | Auf `/en` führt ein sichtbarer Link „Contact“ zu einer Seite unter `/en/…` mit Hauptüberschrift, den vier Formularfeldern auf Englisch und der Schaltfläche zum Senden. Der direkte Aufruf dieser URL liefert Status 200. Die Seite hat keinen horizontalen Überlauf. | `tests/REQ-4.spec.ts` |
| REQ-4-AC3 | Auf der deutschen Kontaktseite führt der Sprachwechsel „English“ zur englischen Kontaktseite (URL unter `/en/…`, englische Formularfelder). | `tests/REQ-4.spec.ts` |
| REQ-4-AC4 | Wird das deutsche Formular leer abgesendet, zeigen Name, E-Mail-Adresse und Nachricht je eine deutsche Fehlermeldung; das Feld Unternehmen ist nicht als ungültig markiert; es erscheint keine Bestätigung. | `tests/REQ-4.spec.ts` |
| REQ-4-AC5 | Wird das deutsche Formular mit ausgefüllten Pflichtfeldern, aber der ungültigen E-Mail-Adresse `max.mustermann@` abgesendet, zeigt nur das Feld E-Mail-Adresse eine deutsche Fehlermeldung, die Eingaben bleiben erhalten und es erscheint keine Bestätigung. | `tests/REQ-4.spec.ts` |
| REQ-4-AC6 | Wird das englische Formular leer abgesendet, zeigen Name, E-Mail-Adresse und Nachricht je eine englische Fehlermeldung, die keine deutschen Wörter („bitte“, „eingeben“, „angeben“, „Pflicht“, „gültig“) enthält. | `tests/REQ-4.spec.ts` |
| REQ-4-AC7 | Wird das deutsche Formular mit Name, gültiger E-Mail-Adresse und Nachricht, aber **ohne** Unternehmen abgesendet, erscheint eine deutsche Bestätigung und kein Feld ist als ungültig markiert. | `tests/REQ-4.spec.ts` |
| REQ-4-AC8 | Wird das englische Formular vollständig abgesendet, erscheint eine englische Bestätigung. | `tests/REQ-4.spec.ts` |
| REQ-4-AC9 | Eine über die Kontaktseite abgesendete Nachricht ist nach Anmeldung als `editor` und ebenso als `admin` im Nachrichtenbereich der Redaktion mit Name, Unternehmen, E-Mail-Adresse und Nachrichtentext sichtbar, ohne Suche oder Blättern (neueste zuerst). | `tests/REQ-4.spec.ts` |
| REQ-4-AC10 | Ohne Anmeldung ist eine abgesendete Nachricht nicht einsehbar: Der Nachrichtenbereich führt zur Anmeldung und zeigt die Nachricht nicht, und jeder Datenabruf, der der angemeldeten Redaktion die Nachricht liefert, antwortet ohne Sitzung mit Status 401 oder 403 und ohne die Nachricht. | `tests/REQ-4.spec.ts` |

## Szenarien

### REQ-4-AC1 Deutsche Kontaktseite erreichbar

- **Gegeben** die Startseite `/de` (Desktop oder Mobil)
- **Wenn** die Besucherin dem Link „Kontakt“ folgt (bei geschlossenem Menü erst „Menü“ öffnen)
- **Dann** ist die URL unter `/de/…`, eine Überschrift der Ebene 1 ist sichtbar, die Felder Name, Unternehmen, E-Mail-Adresse und Nachricht sowie die Schaltfläche zum Senden sind sichtbar, `GET` auf diese URL liefert 200 und die Seite ist nicht breiter als das Fenster

### REQ-4-AC2 Englische Kontaktseite erreichbar

- **Gegeben** die Startseite `/en`
- **Wenn** die Besucherin dem Link „Contact“ folgt
- **Dann** gilt dasselbe wie in AC1 unter `/en/…` mit englischen Beschriftungen

### REQ-4-AC3 Sprachwechsel

- **Gegeben** die deutsche Kontaktseite
- **Wenn** die Besucherin „English“ wählt
- **Dann** ist die URL unter `/en/…` und die englischen Formularfelder sind sichtbar

### REQ-4-AC4 Pflichtfelder

- **Gegeben** die deutsche Kontaktseite mit leerem Formular
- **Wenn** die Besucherin auf Senden klickt
- **Dann** sind Name, E-Mail-Adresse und Nachricht als ungültig markiert und haben je eine deutsche Fehlermeldung, die sichtbar ist; Unternehmen ist nicht als ungültig markiert; keine Bestätigung erscheint

### REQ-4-AC5 Ungültige E-Mail-Adresse

- **Gegeben** die deutsche Kontaktseite
- **Wenn** Name und Nachricht ausgefüllt sind, als E-Mail-Adresse `max.mustermann@` eingetragen ist und die Besucherin auf Senden klickt
- **Dann** hat nur das Feld E-Mail-Adresse eine deutsche Fehlermeldung, alle Eingaben stehen unverändert in den Feldern und keine Bestätigung erscheint

### REQ-4-AC6 Englische Fehlermeldungen

- **Gegeben** die englische Kontaktseite mit leerem Formular
- **Wenn** die Besucherin auf Senden klickt
- **Dann** haben Name, E-Mail-Adresse und Nachricht je eine englische Fehlermeldung ohne deutsche Wörter

### REQ-4-AC7 Absenden ohne Unternehmen

- **Gegeben** die deutsche Kontaktseite
- **Wenn** Name, eine E-Mail-Adresse `…@example.test` und eine Nachricht eingetragen sind, Unternehmen leer bleibt und die Besucherin auf Senden klickt
- **Dann** erscheint eine deutsche Bestätigung und kein Feld ist als ungültig markiert

### REQ-4-AC8 Englische Bestätigung

- **Gegeben** die englische Kontaktseite
- **Wenn** alle vier Felder ausgefüllt sind und die Besucherin auf Senden klickt
- **Dann** erscheint eine englische Bestätigung

### REQ-4-AC9 Eingang in der Redaktion

- **Gegeben** eine über die deutsche Kontaktseite abgesendete Nachricht mit eindeutigen Werten für Name, Unternehmen, E-Mail-Adresse und Nachricht
- **Wenn** sich `redaktion@example.test` (Rolle `editor`) unter `/redaktion/anmelden` anmeldet und den Nachrichtenbereich über die Navigation öffnet, danach ebenso `admin@example.test` (Rolle `admin`)
- **Dann** sind jeweils alle vier Werte sichtbar

### REQ-4-AC10 Schutz der Nachrichten

- **Gegeben** eine abgesendete Nachricht, die eine angemeldete Redaktionsnutzerin im Nachrichtenbereich sieht
- **Wenn** dieselbe URL des Nachrichtenbereichs ohne Sitzung aufgerufen wird und die Datenabrufe, deren Antwort die Nachricht enthielt, ohne Sitzung wiederholt werden
- **Dann** erscheint die Anmeldung („Anmelden“), die Nachricht ist nicht sichtbar, und die Datenabrufe antworten mit 401 oder 403 ohne die Nachricht

## Nicht Teil der Anforderung

- Der genaue Pfad der Kontaktseite und des Nachrichtenbereichs, Gestaltung und Platzierung des Links (Kopf, Menü oder Fußbereich).
- Benachrichtigung per E-Mail an Betreiber oder Absender, Antwortfunktion, Bearbeiten, Löschen oder Archivieren von Nachrichten in der Redaktion.
- Unterscheidung von Rechten zwischen `editor` und `admin` beim Nachrichtenbereich; beide sind berechtigt.
- Missbrauchsschutz (z. B. Begrenzung je IP-Adresse, Captcha). **Hinweis für die Umsetzung:** Die Fidelity-Suite sendet je Lauf bis zu zehn Nachrichten von derselben Adresse und läuft mehrmals pro Stunde; eine Begrenzung darf das nicht verhindern.
- Eine Verlinkung von der Themenseite Software Entwicklung (Anforderung #7).
- Wortlaut von Hinweisen zum Datenschutz auf der Kontaktseite und die Ansprache (Du/Sie, Anforderung #8).

## Verifikation der Tests (Team 1)

- [x] Jedes Akzeptanzkriterium hat genau einen Test mit seiner ID am Anfang des Testtitels.
- [x] Jeder Test prüft das Ergebnis, das Nutzer sehen (Text, URL, Statuscode, Zuordnung der Fehlermeldung zum Feld), nicht Implementierungsdetails.
- [x] Gegen `origin/main` (`9c525e5`): alle 20 Läufe rot aus dem richtigen Grund (kein Link „Kontakt“/„Contact“). Anmeldung als `editor` und `admin` sowie die Umleitung zur Anmeldung separat gegen `main` geprüft.
- [x] Gegenprobe: Gegen eine Wegwerf-Attrappe der Funktion (nicht im Repository) sind alle 20 Läufe grün, auch doppelt und parallel (40/40). Mit je einem eingebauten Fehler werden genau die passenden Tests rot: fehlender Sprachwechsel → AC3; horizontaler Überlauf → AC1, AC2; Felder nicht als ungültig markiert → AC4–AC6; deutsche Meldungen auf Englisch → AC6; Name nicht Pflicht → AC4, AC6; keine E-Mail-Prüfung → AC5; Formular bei Fehler geleert → AC5; keine Bestätigung → AC7–AC10; Unternehmen fehlt in der Redaktion → AC9; kein Navigationseintrag → AC9, AC10; `admin` ohne Zugriff → AC9; Datenabruf ohne Anmeldung offen → AC10; älteste zuerst → AC9, AC10. Tests dabei unverändert.
- [x] Die Tests laufen auf Desktop und Mobil und hängen nicht voneinander oder von der Reihenfolge ab (jeder Test legt seine Nachricht mit eindeutiger Kennung selbst an).
- [x] Testdaten kommen nur aus dem Entwicklungs-Seed (`DEV_SEED=true`, Testkonten) oder werden im Test selbst angelegt (`…@example.test`).
- [x] Vollständigkeit: Jede Aussage des Issues ist durch ein Kriterium abgedeckt oder steht unter „Nicht Teil der Anforderung“ (Erreichbarkeit und mobil → AC1, AC2; Felder und Pflicht → AC1, AC4, AC7; Fehler → AC4–AC6; Bestätigung → AC7, AC8; Redaktion → AC9; Berechtigung → AC10; Lokalisierung → AC2, AC3, AC6, AC8; Verlinkung der Themenseite → #7).
