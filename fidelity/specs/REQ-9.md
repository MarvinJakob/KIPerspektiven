---
id: REQ-9
issue: https://github.com/MarvinJakob/AIPerspectives/issues/9
status: verifiziert
geprueft_am: 2026-11-16
---

# REQ-9 Einstiegsbereich mit klarer Hauptaktion zur KI Readiness

## Ziel

Besucher erkennen im Einstiegsbereich der Startseite sofort eine einzige Hauptaktion, die sie zur KI Readiness führt. Die übrigen Einstiege bleiben als nachrangige Links erreichbar, ohne dass mobil eine lange Liste gleichrangiger Buttons entsteht.

## Begriffe

- **Einstiegsbereich:** der oberste Bereich der Startseite (`/de`, `/en`), der die Hauptüberschrift (Ebene 1) enthält. Er ist als Region ausgezeichnet, deren zugänglicher Name die Hauptüberschrift ist (z. B. `<section aria-labelledby>`). Die darin verschachtelte Navigation zu den Themenabschnitten („Direkt zu den Themen“ / „Jump to the topics“) gehört **nicht** zu den Aktionen des Einstiegsbereichs.
- **Aktionen des Einstiegsbereichs:** alle sichtbaren Links und Schaltflächen im Einstiegsbereich außerhalb der Themennavigation. Andere Navigationen im Einstiegsbereich (z. B. ein eigenes `<nav>` für die nachrangigen Zugänge) sind erlaubt; ihre Links zählen zu den Aktionen.
- **Gefüllte Fläche (Button-Optik):** Eine Aktion hat eine gefüllte Fläche, wenn ihr berechneter Hintergrund ein Bild/Verlauf ist, das mindestens die halbe Breite und Höhe der Aktion abdeckt, oder eine nicht transparente Hintergrundfarbe (gleich in welchem CSS-Farbformat), die sich vom tatsächlich dahinterliegenden Hintergrund unterscheidet. Rahmen allein, schmale Verläufe als Unterstreichung und auf den Text beschnittene Verläufe (`background-clip: text`) zählen nicht als gefüllte Fläche. Bewertet wird der Ruhezustand ohne Mauszeiger über der Aktion, nach Abschluss laufender Übergänge.
- **Hauptaktion:** die einzige Aktion des Einstiegsbereichs mit gefüllter Fläche.
- **Nachrangige Zugänge:** die Aktionen des Einstiegsbereichs ohne gefüllte Fläche, mit diesen zugänglichen Namen und Zielen:

  | Zugang | Deutsch (Name enthält) | Englisch (Name enthält) | Ziel |
  |---|---|---|---|
  | Themen | „Themen“ | „Topics“ | Themenübersicht der Startseite: Die Überschrift „Gute Fragen. Neue Perspektiven.“ bzw. „Good questions. New perspectives.“ liegt danach im sichtbaren Bereich |
  | News | „News“ | „News“ | Seite unter `/<lang>/blog` oder `/<lang>/news` |
  | KI verstehen | „KI verstehen“ | „Understand AI“ | Seite unter `/<lang>/ki-verstehen` |
  | Über mich | „Über mich“ | „About me“ | Seite unter `/<lang>/profil` |

  „KI verstehen“ ist nach Erstellung des Issues hinzugekommen und zählt zu den „übrigen Einstiegen“, die erhalten bleiben. Die Ziel-URLs sind die heutigen Ziele; das Issue verlangt keine Änderung der Linkziele. Weil REQ-8 „Blog“ in „News“ umbenennt und eine geänderte URL zulässt, solange alle Links funktionieren, ist für News zusätzlich `/<lang>/news` zulässig.
- **Startseite der KI Readiness:** Seite unter `/<lang>/…` mit Hauptüberschrift „KI Readiness“ (Deutsch) bzw. „AI Readiness“ (Englisch); heute `/<lang>/themen/ai-audit`.
- **Ansichten:** Desktop (Desktop Chrome, 1280 × 720) und Mobil (Pixel 7, 412 × 839), jeweils als eigenes Playwright-Projekt.

## Akzeptanzkriterien

| ID | Kriterium | Test |
|---|---|---|
| REQ-9-AC1 | Auf `/de` hat der Einstiegsbereich genau eine Aktion mit gefüllter Fläche (Hauptaktion). Ihr zugänglicher Name enthält „KI Readiness“. | `tests/REQ-9.spec.ts` |
| REQ-9-AC2 | Auf `/en` hat der Einstiegsbereich genau eine Aktion mit gefüllter Fläche (Hauptaktion). Ihr zugänglicher Name enthält „AI Readiness“. | `tests/REQ-9.spec.ts` |
| REQ-9-AC3 | Auf `/de` und `/en` führt ein Klick auf die Hauptaktion ohne Zwischenschritt zur Startseite der KI Readiness der jeweiligen Sprache (URL unter `/<lang>/`, Status 200, Hauptüberschrift „KI Readiness“ bzw. „AI Readiness“). | `tests/REQ-9.spec.ts` |
| REQ-9-AC4 | Auf `/de` enthält der Einstiegsbereich die nachrangigen Zugänge Themen, News, KI verstehen und Über mich, jeweils sichtbar, ohne gefüllte Fläche und mit deutschem Namen laut Begriffe; jeder führt zu seinem Ziel. | `tests/REQ-9.spec.ts` |
| REQ-9-AC5 | Auf `/en` enthält der Einstiegsbereich die nachrangigen Zugänge Topics, News, Understand AI und About me, jeweils sichtbar, ohne gefüllte Fläche und mit englischem Namen laut Begriffe; jeder führt zu seinem Ziel. | `tests/REQ-9.spec.ts` |
| REQ-9-AC6 | Auf `/de` und `/en`, in Desktop- und Mobilansicht: Die Hauptaktion liegt beim Laden ohne Scrollen vollständig im sichtbaren Bereich, die nachrangigen Zugänge verteilen sich auf höchstens zwei Zeilen (keine Liste untereinander), und die Seite hat keinen horizontalen Überlauf. | `tests/REQ-9.spec.ts` |
| REQ-9-AC7 | Auf `/de` und `/en` erreicht man vom Seitenanfang aus mit der Tabulatortaste die Hauptaktion und jeden nachrangigen Zugang; Enter auf der fokussierten Hauptaktion öffnet die Startseite der KI Readiness. | `tests/REQ-9.spec.ts` |

## Szenarien

### REQ-9-AC1 Eine Hauptaktion „KI Readiness“ (Deutsch)

- **Gegeben** die Startseite `/de` (Desktop oder Mobil)
- **Wenn** die Besucherin den Einstiegsbereich betrachtet
- **Dann** hat genau eine sichtbare Aktion außerhalb der Themennavigation eine gefüllte Fläche, und ihr Name enthält „KI Readiness“

### REQ-9-AC2 Eine Hauptaktion „AI Readiness“ (Englisch)

- **Gegeben** die Startseite `/en`
- **Dann** gilt dasselbe wie in AC1 mit „AI Readiness“

### REQ-9-AC3 Hauptaktion führt direkt zur KI Readiness

- **Gegeben** die Startseite `/de` bzw. `/en`
- **Wenn** die Besucherin auf die Hauptaktion klickt
- **Dann** zeigt die nächste Seite die Hauptüberschrift „KI Readiness“ bzw. „AI Readiness“, die URL liegt unter `/de/` bzw. `/en/`, und `GET` auf diese URL liefert 200

### REQ-9-AC4 Nachrangige Zugänge erreichbar (Deutsch)

- **Gegeben** die Startseite `/de`
- **Wenn** die Besucherin im Einstiegsbereich nacheinander Themen, News, KI verstehen und Über mich wählt (jeweils von der Startseite aus)
- **Dann** ist jeder Link sichtbar und ohne gefüllte Fläche und führt zu seinem Ziel laut Begriffe

### REQ-9-AC5 Nachrangige Zugänge erreichbar (Englisch)

- **Gegeben** die Startseite `/en`
- **Dann** gilt dasselbe wie in AC4 mit den englischen Namen

### REQ-9-AC6 Klare Hierarchie ohne lange Buttonliste

- **Gegeben** die Startseite `/de` bzw. `/en` in Desktop- oder Mobilansicht, nicht gescrollt
- **Dann** liegt die Hauptaktion vollständig im Fenster, die nachrangigen Zugänge stehen in höchstens zwei Zeilen (Zeilen = Gruppen von Links mit überlappender vertikaler Lage) und die Seite ist nicht breiter als das Fenster

### REQ-9-AC7 Bedienung mit der Tastatur

- **Gegeben** die Startseite `/de` bzw. `/en`, Fokus am Seitenanfang
- **Wenn** die Besucherin wiederholt Tab drückt (höchstens 40-mal)
- **Dann** erhalten die Hauptaktion und alle nachrangigen Zugänge nacheinander den Fokus
- **Und wenn** sie auf der fokussierten Hauptaktion Enter drückt, **dann** erscheint die Startseite der KI Readiness

## Nicht Teil der Anforderung

- Die konkrete visuelle Gestaltung (Farben, Größen, Anordnung, Reihenfolge), solange die Kriterien erfüllt sind; der Entwurf ist Teil der Umsetzung.
- Die einheitliche Benennung und Du-Ansprache auf der übrigen Website (Issue #8). Hier gilt nur der Name der Hauptaktion.
- Inhalte und Ablauf der KI Readiness selbst.
- Der KI-Readiness-Banner weiter unten auf der Startseite und die Themennavigation „Direkt zu den Themen“ im Einstiegsbereich.
- Ein eigener Test für die Gestaltung des Fokusrahmens; Tastaturbedienbarkeit wird über Erreichbarkeit und Enter geprüft.
- Ob die Hauptaktion beim Laden von fixierten Elementen (z. B. Kopfzeile oder Hinweisbanner) verdeckt wird; AC6 prüft nur, dass sie vollständig im sichtbaren Bereich liegt (`toBeInViewport` erkennt keine Verdeckung).
- Neue URLs für KI verstehen oder Profil; für News siehe Begriffe.

## Verifikation der Tests (Team 1)

- [x] Jedes Akzeptanzkriterium hat genau einen Test mit seiner ID am Anfang des Testtitels.
- [x] Jeder Test prüft das Ergebnis, das Nutzer sehen (Text, URL, Statuscode), nicht Implementierungsdetails.
- [x] Gegenprobe: Jeder Test wurde mindestens einmal rot gesehen (Funktion fehlt, falsche Erwartung oder bewusst verfälschte Erwartung) und ist danach unverändert zurückgesetzt.
- [x] Die Tests laufen auf Desktop und Mobil und hängen nicht voneinander oder von der Reihenfolge ab.
- [x] Testdaten kommen nur aus dem Entwicklungs-Seed (`DEV_SEED=true`) oder werden im Test selbst angelegt.
- [x] Vollständigkeit: Jede Aussage des Issues ist einem Kriterium oder „Nicht Teil der Anforderung“ zugeordnet (genau eine hervorgehobene Hauptaktion → AC1, AC2; direkt zur KI Readiness mit diesem Namen → AC1–AC3; übrige Einstiege erreichbar → AC4, AC5; mobil keine lange Buttonliste, Hauptaktion sofort erkennbar → AC6; Desktop, Mobil und beide Sprachen → alle Kriterien über beide Projekte und `/de`, `/en`; Tastatur und verständliche Beschriftungen → AC7 sowie Namen in AC1, AC2, AC4, AC5; freie Gestaltung → Nicht Teil).

**Ergebnis 2026-11-16** (App aus `origin/main` 72175f5, Port 20009, Desktop und Mobil):

- Stand `main`: AC1–AC5 und AC7 sowie AC6 mobil rot aus dem richtigen Grund. Heute ist „Themen entdecken“ die einzige Aktion mit gefüllter Fläche, „KI Reifegrad einschätzen“ ist nur ein Textlink, und mobil stehen die vier Textlinks in vier Zeilen untereinander. AC6 Desktop grün, denn dort stehen die Links bereits in einer Zeile.
- Positivprobe: Mit einer lokal simulierten, nicht committeten Umsetzung („KI Readiness starten“ / „Start AI Readiness“ als gefüllter Button, vier Textlinks umbrechend darunter) bestehen alle 14 Läufe, auch mit `--repeat-each 3` (42/42).
- Gegenprobe gegen die Simulation: verfälschter Name (AC1–AC3), Zeilenzahl 0 (AC6), falsches Linkziel (AC4, AC5), zu wenige Tab-Schritte (AC7). Jeder Test wurde rot, danach unverändert zurückgesetzt.

**Testkorrektur #34 (Team 3, 2026-11-17)** (App aus `origin/main` 6a54f6c, Port 20034, Desktop und Mobil): Aktionen schließen nur noch die Themennavigation (über ihren zugänglichen Namen) aus; Hintergrundfarben werden formatunabhängig über ein Canvas verglichen; Verläufe zählen nur ab halber Breite und Höhe und nicht bei `background-clip: text`; vor dem Auslesen wird der Mauszeiger entfernt und laufende Übergänge werden abgewartet; News darf auch unter `/<lang>/news` liegen.

- Stand `main`: unverändert AC1–AC5 und AC7 rot aus dem richtigen Grund („Themen entdecken“ statt KI Readiness als einzige gefüllte Aktion).
- Positivprobe: lokal simulierte, nicht committete Umsetzung mit Hauptaktion in `oklch()`-Farbe, nachrangigen Zugängen in einem eigenen `<nav>`, Unterstreichung per schmalem Verlauf und Hover-Hintergrund mit Übergang: 42/42 mit `--repeat-each 3`. Der bisherige Test scheitert an derselben Simulation (keine bzw. nicht gefundene Aktionen).
- Gegenprobe gegen eine zweite Simulation (Hauptaktion als vollflächiger Verlauf, „News“ zusätzlich gefüllt): AC1, AC2, AC4, AC5 rot (zwei gefüllte Aktionen bzw. „News“ nicht nachrangig). Simulation vollständig zurückgenommen.
