# Verbesserungsvorschläge zur Usability

**Grundlage:** Nutzertest der Website „KI Perspektiven“ am 14.11.2026. Getestet wurde der Stand `origin/main` (Commit `60a6caa`) lokal mit Testdaten (`DEV_SEED=true`).

**Geprüft:**

- 16 Seiten in Desktop-Ansicht (1280 px) und Mobilansicht (390 px)
- Selbsteinschätzung bis zur Auswertung
- Menü, Dark Mode, Cookie-Dialog und Sprachwechsel

Neue Funktionen stehen in [new_functions.md](new_functions.md).

## Was bereits gut funktioniert

- Klares, ruhiges Design und kurze Ladezeiten (lokal 0,7 bis 1,2 s je Seite)
- Keine JavaScript-Fehler, keine defekten internen Links und kein seitliches Scrollen auf Mobilgeräten
- Gute Grundlagen der Barrierefreiheit:
  - Sprunglink zum Inhalt, ARIA-Beschriftungen und Kennzeichnung der aktiven Seite
  - Alternativtexte für alle Bilder
  - Textalternative zum Netzdiagramm
- Gut bedienbares mobiles Menü, funktionierender Dark Mode und Cookie-Dialog
- Fehlt eine englische Fassung, zeigt die Seite den deutschen Text mit einem Hinweis.

## Vorschläge nach Priorität

### 1. Einheitliche Begriffe und Ansprache

**Befund:**

- Dieselbe Funktion trägt verschiedene Namen:
  - „KI Readiness“ in der Navigation
  - „KI Reifegrad einschätzen“ auf der Startseite
  - „Zum KI-Audit“ im Banner
  - „AI Audit“ in einem Blogbeitrag
  - `/themen/ai-audit` als URL
- Die Startseite verlinkt „News“, die Navigation nennt denselben Bereich „Blog“.
- Die Startseite spricht mit „du“ an. Themenseiten, Selbsteinschätzung, Footer und Cookie-Hinweis verwenden „Sie“.

**Vorschlag:**

- Einen Namen festlegen, z. B. „KI Readiness“, und ihn überall verwenden.
- Die URL anpassen und die alte URL weiterleiten.
- Eine einheitliche Anredeform für die gesamte Website wählen.

### 2. Startseite mit klarem Einstieg

**Befund:**

- Der Einstiegsbereich bietet vier gleichrangige Buttons: „Themen entdecken“, „News“, „KI Reifegrad einschätzen“ und „Über mich“. Auf Mobilgeräten stehen sie als lange Liste untereinander.
- Drei Themen-Teaser mit je rund 250 Wörtern stehen vor dem Link „Zum Artikel“.
- Die Seite ist auf dem Desktop etwa 5.300 px lang, auf Mobilgeräten etwa 6.900 px.
- Aktuelle Blogbeiträge erscheinen nicht.

**Vorschlag:**

- Einen Haupt-Button festlegen, z. B. „Selbsteinschätzung starten“, und höchstens einen zweiten Button anbieten.
- Die Teaser auf zwei bis drei Sätze kürzen.
- Einen Bereich „Neueste Beiträge“ ergänzen.

### 3. Lange Themenseiten besser erschließen

**Befund:**

- Die Seiten sind auf Mobilgeräten sehr lang:
  - „Modelle und Kosten“: rund 1.500 Wörter, etwa 12.800 px
  - „Softwareentwicklung“: etwa 12.000 px
  - Übersicht „KI Readiness“: etwa 8.700 px
- Es fehlen Inhaltsverzeichnis, Lesezeit und eine Schaltfläche „Nach oben“.
- Auf der Übersicht „KI Readiness“ erscheint „Selbsteinschätzung starten“ erst nach einer langen Einleitung.

**Vorschlag:**

- Ein Inhaltsverzeichnis mit Sprungmarken, die Lesezeit und eine Schaltfläche „Nach oben“ ergänzen.
- „Selbsteinschätzung starten“ zusätzlich direkt unter dem ersten Absatz anbieten.

### 4. Selbsteinschätzung

**Befund:**

- Die Auswahl liegt nur im Arbeitsspeicher. Nach dem Neuladen springt der Fortschritt aller acht Dimensionen auf „0 von 8“ zurück.
- Fehlende Dimensionen meldet die Selbsteinschätzung erst im letzten Schritt.
- Die Einwilligung zur anonymen Statistik erscheint im letzten Schritt und erneut in der Auswertung. Laut Text wird „beim Anzeigen der Auswertung“ gespeichert; der Zeitpunkt bleibt für Nutzer unklar.
- Screenreader lesen die Schrittnummer doppelt vor („1 1.“).

**Vorschlag:**

- Den Fortschritt sichern, siehe [new_functions.md](new_functions.md).
- Fehlende Dimensionen schon in der Fortschrittsanzeige kennzeichnen.
- Die Einwilligung nur an einer Stelle abfragen und den Speicherzeitpunkt klar benennen.
- Die doppelte Nummerierung entfernen.

### 5. Auswertung mit nächstem Schritt

**Befund:**

- Die Auswertung zeigt nur ein Netzdiagramm und eine Tabelle mit „Ändern“-Links. Danach folgen ein allgemeiner Text und „Zur Übersicht“.
- Es gibt weder Empfehlungen noch eine Kontaktmöglichkeit, obwohl das Profil passende Beratungsangebote enthält.

**Vorschlag:**

- Mindestens auf die passenden Beratungsangebote und den Kontakt verlinken.
- Die vollständige Erweiterung steht in [new_functions.md](new_functions.md).

### 6. Navigation und Footer

**Befund:**

- Das Menü „Themen“ zeigt drei Themen; „KI Readiness“ steht als eigener Menüpunkt daneben.
- Im Footer wirkt die Themenliste ungeordnet und enthält den langen Titel „Modelle und Kosten: Wie finde ich das beste Preis-/Leistungsverhältnis?“.
- Die Seite „KI-Einsatzfelder“ (`/de/ki-einsatzfelder`) ist nur über die Sitemap oder die direkte URL erreichbar. Laut `app/README.md` verlinkt die Startseite sie mit „Zur ausführlichen Einordnung“. Die aktuelle Startseite enthält diesen Link nicht mehr; die Konstante `AI_USES_PATH` wird nicht verwendet.

**Vorschlag:**

- In Menü und Footer Kurztitel verwenden und überall dieselbe Reihenfolge einhalten.
- „KI-Einsatzfelder“ wieder verlinken oder die Seite entfernen und die README anpassen.

### 7. Texte und Details

**Befund:**

- Aus der Textvorlage übernommene Fehler sind sichtbar, z. B. „kontrolle“, „uns aber wir“ und ein fehlender Punkt nach „übernehmen“. Laut `app/README.md` ist das Absicht, wirkt aber unprofessionell.
- Die Meta-Beschreibung der Seite „Softwareentwicklung“ enthält Backticks (`` `AGENTS.md` ``).
- Auf Mobilgeräten sind die Klickflächen sehr klein:
  - Fußnoten-Links [n]: 19 × 22 px
  - Quellenverweise auf „KI-Einsatzfelder“: 10 × 15 px

  Damit liegen sie unter der empfohlenen Mindestgröße von 24 × 24 px. Für Links im Fließtext ist das zulässig, größere Klickflächen erleichtern aber die Bedienung.

**Vorschlag:**

- Die Tippfehler korrigieren.
- Formatierungszeichen aus Meta-Beschreibungen entfernen.
- Die Klickflächen der Fußnoten-Links vergrößern, z. B. mit Innenabstand.
