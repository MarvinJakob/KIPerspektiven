# Vorschläge für neue Funktionen

**Grundlage:** Nutzertest der Website „KI Perspektiven“ am 14.11.2026. Getestet wurde der Stand `origin/main` (Commit `60a6caa`) lokal mit Testdaten.

Verbesserungen bestehender Funktionen stehen in [improvements.md](improvements.md). Die Vorschläge sind nach Priorität geordnet.

## 1. Auswertung mit Empfehlungen

**Ziel:** Nach der Selbsteinschätzung erhalten Nutzer einen konkreten nächsten Schritt statt nur einer Übersicht.

- Für jede Dimension eine kurze Empfehlung passend zum gewählten Reifegrad anzeigen.
- Die schwächsten Dimensionen hervorheben.
- Das Ergebnis als PDF exportieren oder drucken.
- Auf passende Beratungsangebote hinweisen und zu einem Erstgespräch einladen.

## 2. Fortschritt der Selbsteinschätzung sichern

**Ziel:** Neuladen oder Schließen der Seite löscht die Eingaben aus acht Dimensionen nicht mehr.

- Die Auswahl auf Wunsch im Browser speichern (localStorage) und nach dem Neuladen wiederherstellen. Gespeicherte Angaben lassen sich jederzeit löschen.
- Alternativ einen Link erzeugen, mit dem man das Ergebnis teilen oder später fortsetzen kann.
- Hinweis: Die Auswahl liegt bisher bewusst nur im Arbeitsspeicher (Tickets #113 und #130). Eine Speicherung im Browser muss in der Datenschutzerklärung ergänzt werden.

## 3. Vergleich mit anderen Ergebnissen

**Ziel:** Nutzer können ihren Reifegrad besser einordnen.

- Den eigenen Reifegrad je Dimension dem Durchschnitt der anonym gespeicherten Ergebnisse gegenüberstellen (Statistik aus Ticket #130).
- Den Vergleich erst ab einer Mindestanzahl von Ergebnissen anzeigen, damit keine Rückschlüsse auf einzelne Teilnehmende möglich sind.

## 4. Blog mit Filter, Suche und Abonnement

**Ziel:** Leser finden passende Beiträge schneller und erfahren von neuen Inhalten.

- Beiträge nach Themen filtern.
- Eine Volltextsuche über Blogbeiträge und Themenseiten anbieten.
- Einen RSS-Feed und/oder Newsletter anbieten; beides fehlt bisher (`/de/feed.xml` liefert 404).

## 5. Kontakt und Terminbuchung

**Ziel:** Interessierte Unternehmen nehmen ohne Umweg Kontakt auf.

- Das Profil bietet bisher nur „LinkedIn“ und „Mail“.
- Ein Kontaktformular oder einen Buchungslink für ein Erstgespräch ergänzen.
- Den Kontakt auf Profil, Auswertung und Themenseiten anbieten.

## 6. Englische Version und Ladezeit

**Ziel:** Die englische Seite ist vollständig, und die Website lädt schneller.

- Fehlende englische Übersetzungen ergänzen. Beiträge ohne englische Fassung zeigen bisher den deutschen Text mit einem Hinweis.
- Das JavaScript-Paket der öffentlichen Seite (725 kB, gzip 230 kB) in kleinere Teile aufteilen. Selbsteinschätzung und Netzdiagramm laden dann erst bei Bedarf.
