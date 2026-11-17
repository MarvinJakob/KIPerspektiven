> **Platzhalter.** Die Datenschutzerklärung ist noch nicht erstellt (Design.md, Abschnitt 12). Die Angaben unten beschreiben den technischen Stand und müssen rechtlich geprüft werden.

## Kurz gesagt

- Wir setzen keine Tracking-Cookies und keine Analysewerkzeuge ein. Es gibt keine optionalen Cookies oder vergleichbaren Technologien.
- Unser Server zählt, wie oft öffentliche Seiten abgerufen werden, als Summe je Tag und zusätzlich bereinigt je IP-Adresse mit einer geschützten Ableitung (siehe „Statistik“).
- Das Ergebnis der KI-Readiness-Selbsteinschätzung speichern wir nur, wenn du vorher zustimmst, und dann anonym.
- Fragst du auf der Auswertung ein kostenloses Beratungsgespräch an, speichern wir deine E-Mail-Adresse, bis der Termin abgestimmt ist (siehe „Anfrage für ein Beratungsgespräch“).
- Schriften, Skripte und Bilder kommen ausschließlich von unserem eigenen Server. Es werden keine Daten an Dritte übertragen.
- Sprach- und Darstellungswahl sowie deine Cookie-Auswahl speichern wir nur in deinem Browser (Local Storage). Sie verlassen dein Gerät nicht. Über „Cookie-Einstellungen“ im Footer wählst du „Keine Cookies speichern“ (nichts wird gespeichert), „Nur notwendige Cookies“ oder widerrufst deine Auswahl jederzeit.

## Cookies und Speicherzugriffe

| Eintrag | Zweck | Anbieter | Laufzeit | Einordnung |
| --- | --- | --- | --- | --- |
| `ki-perspektiven.lang` (Local Storage) | Sprachwahl | diese Webseite | bis zum Löschen | notwendig: von dir ausdrücklich gewählte Funktion (§ 25 Abs. 2 TDDDG) |
| `ki-perspektiven.theme` (Local Storage) | helle oder dunkle Darstellung | diese Webseite | bis zum Löschen | notwendig: von dir ausdrücklich gewählte Funktion |
| `ki-perspektiven.consent` (Local Storage) | deine Cookie-Auswahl mit Zeitpunkt und Version, ohne Kennung | diese Webseite | höchstens 180 Tage | notwendig, um deine Entscheidung umzusetzen |
| `ki_session` (Cookie, HttpOnly) | Anmeldung der Redaktion | diese Webseite | Sitzungsdauer | notwendig, nur nach ausdrücklicher Anmeldung unter `/redaktion` |

## Server-Protokolle

Beim Aufruf der Seite verarbeitet unser Server technisch notwendige Daten wie die angefragte Adresse und den Zeitpunkt. IP-Adressen werden im Zugriffsprotokoll gekürzt und die Protokolle nach sieben Tagen gelöscht.

## Statistik

**Seitenaufrufe.** Um die Reichweite der Webseite und wiederholte Abrufe einzuschätzen, zählt unser Server jeden Abruf einer öffentlichen Seite. Die absolute Anzahl wird als Summe je Kalendertag gespeichert. Für die bereinigte Anzahl wird die IP-Adresse aus der ohnehin notwendigen Verbindung normalisiert und sofort mit einem geheimen Schlüssel abgeleitet (HMAC-SHA-256). Wir speichern für diese Statistik keine IP-Adresse im Klartext. Je Ableitung bleibt nur der letzte Aufruftag erhalten, kein Verlauf besuchter Seiten, kein genauer Zeitpunkt und keine Browserdaten. Die Ableitungen werden nicht mit Konten, Ergebnissen oder Beratungsanfragen verbunden und nicht an Dritte weitergegeben. Nur angemeldete Redaktionskonten sehen die zusammengefassten Zahlen.

Die Ableitung ist ein personenbezogenes Pseudonym, keine anonyme Kennung. Sie und der getrennt geschützte Schlüssel bleiben für die Laufzeit des Statistikbestands erhalten, damit auch lange nicht verwendete IP-Adressen in der Gesamtzahl nur einmal zählen. Bei Abschaltung oder Zurücksetzen der IP-Statistik werden Ableitungen und Schlüssel gelöscht; für Sicherungen gilt deren Rotation. Die Notwendigkeit dieser Aufbewahrung prüfen wir jährlich. Reine Tageszähler können bestehen bleiben. Mehrere Personen können dieselbe IP nutzen, eine Person kann verschiedene IPs nutzen; die bereinigte Zahl misst deshalb keine eindeutigen Personen.

Dafür wird nichts zusätzlich in deinem Browser gespeichert oder ausgelesen. Gezählt wird die ohnehin gesendete Seitenanfrage. Wechsel innerhalb der geöffneten Webseite zählen nicht; automatische Abrufe zählen mit. Rechtsgrundlage der serverseitigen IP-Bereinigung ist unser berechtigtes Interesse an einer aussagekräftigen Reichweitenstatistik (Art. 6 Abs. 1 lit. f DSGVO). Du kannst aus Gründen deiner besonderen Situation nach Art. 21 DSGVO widersprechen und uns dazu über die Kontaktdaten im Impressum erreichen.

**Ergebnisse der Selbsteinschätzung.** Am Ende der KI-Readiness-Selbsteinschätzung kannst du freiwillig ankreuzen, dass dein Ergebnis anonym gespeichert wird. Wir nutzen die Ergebnisse, um den Bedarf unserer Zielgruppe einzuschätzen und die Inhalte weiterzuentwickeln. Nur mit Haken überträgt die Seite beim Anzeigen der Auswertung:

| Gespeichert | Nicht gespeichert |
| --- | --- |
| gewählter Reifegrad (1 bis 3) je Dimension, Sprache der Seite, Zeitpunkt der Speicherung | Name, E-Mail-Adresse, IP-Adresse, Browser oder eine andere Kennung deiner Person |

Damit ein geändertes Ergebnis aktualisiert statt doppelt gespeichert wird, erzeugt die Seite eine zufällige Kennung. Sie liegt nur im Arbeitsspeicher dieses Browserfensters, nicht in Cookies oder im Local Storage, und geht beim Neuladen oder Schließen verloren. Wir speichern nur einen nicht umkehrbaren Hashwert davon. Entfernst du den Haken, solange das Fenster offen ist, löschen wir das Ergebnis sofort. Danach lässt es sich niemandem mehr zuordnen und deshalb auch nicht mehr einzeln löschen.

Rechtsgrundlage für die Übertragung ist deine Einwilligung (§ 25 Abs. 1 TDDDG). Ohne Haken wird nichts übertragen, und du siehst deine Auswertung trotzdem vollständig.

## Anfrage für ein Beratungsgespräch

Auf der Auswertung der KI-Readiness-Selbsteinschätzung kannst du freiwillig ein kostenloses Beratungsgespräch anfragen. Erst wenn du das Formular absendest, überträgt die Seite deine Anfrage an unseren Server. Wir nutzen sie ausschließlich, um uns per E-Mail bei dir zu melden und einen Termin abzustimmen.

| Gespeichert | Nicht gespeichert |
| --- | --- |
| deine E-Mail-Adresse, die Sprache der Seite (für die Antwort), der Zeitpunkt der Anfrage | dein Ergebnis der Selbsteinschätzung, Name, IP-Adresse, Browser oder weitere Angaben |

Die Anfrage liegt in der Datenbank auf unserem Server und ist nur für angemeldete Konten der Redaktion sichtbar. Fragst du mit derselben Adresse erneut an, aktualisieren wir den bestehenden Eintrag. Sobald der Termin abgestimmt ist, löschen wir die Anfrage. Auf Wunsch löschen wir sie jederzeit vorher.

Zum Schutz vor massenhaft eingetragenen fremden Adressen nimmt der Server je IP-Adresse höchstens fünf Anfragen pro Stunde an. Dafür hält er die IP-Adresse höchstens eine Stunde im Arbeitsspeicher; sie wird nicht gespeichert und nicht mit der Anfrage verknüpft.

Rechtsgrundlage für die Anfrage ist Art. 6 Abs. 1 lit. b DSGVO (Maßnahmen vor einem möglichen Vertrag, die auf deine Anfrage erfolgen), für die Begrenzung je IP-Adresse unser berechtigtes Interesse an einem missbrauchsfreien Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Ohne Anfrage wird nichts übertragen, und deine Auswertung bleibt vollständig zugänglich.

## Hosting

Die Webseite wird auf einem Server der Hetzner Online GmbH in Deutschland betrieben.

## Verantwortliche Stelle

[Name, Anschrift, Kontakt]
