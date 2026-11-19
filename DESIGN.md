# Design-Konzept: cimt × Apple

> **Stand:** 2026-11-09 · **Referenz:** [Klickbarer Mock](.mock/design_cimt/index.html) · **Projekt:** KI Perspektiven

Diese Anleitung beschreibt, wie das Layout von `design_cimt` nachgebaut und erweitert wird. Es verbindet die Farben und die sachliche Ausrichtung von cimt mit einer eigenständigen Interpretation der Apple Human Interface Guidelines (HIG). Es ist kein offizielles Designsystem von cimt oder Apple.

Der beschriebene Stand ist im statischen Mock umgesetzt. Die Anwendung unter `app/` wird durch dieses Dokument nicht verändert. Die Dokumentation der ursprünglichen Designvariante liegt im Git-Verlauf (`DESIGN.md` vor Commit `f9cd407`).

## 1. Leitidee und feste Entscheidungen

**cimt gibt die Farbe vor. Apple inspiriert Klarheit, Hierarchie und Bedienung.**

Die cimt-Website dient als Referenz für dunkle Blautöne, helle Flächen, orange Akzente und die Verbindung von Strategie und Umsetzung. Die genaue Unternehmensfarbe `#dc6e14` ist eine Vorgabe für diesen Entwurf. [Q1]

Aus Apples HIG werden Systemtypografie, klare Informationshierarchie, lesbare Inhalte und eine funktional getrennte Navigation auf das Web übertragen. Die konkreten Radien, Abstände und Farben dieses Dokuments sind eigene Gestaltungsentscheidungen, keine von Apple vorgeschriebenen Webwerte. [Q2] [Q3]

Folgende Entscheidungen beim Nachbauen beibehalten:

- **Liquid Glass ist für die Navigation dauerhaft aktiv**, sofern der Browser es unterstützt und keine Barrierefreiheits-Systemeinstellung dagegensteht.
- **Inhalte bleiben opak:** Themenkarten, Beiträge, Audit-Flächen und Dialoge sind nicht durchsichtig.
- **Keine zusätzliche obere Textleiste:** Der Schriftzug „Perspektiven für die digitale Zukunft.“ und die frühere Mock-Leiste entfallen.
- **Kein Liquid-Glass-Schalter:** Es gibt weder einen Slider noch eine gespeicherte Ein/Aus-Wahl.
- **Hell und Dunkel bleiben umschaltbar.** Der Mock startet hell; die Wahl wird nur im Arbeitsspeicher gehalten.
- **Keine externen Schrift- oder Bildabrufe.** Grafiken und Symbole entstehen lokal mit CSS und SVG.

## 2. Dateien und Vorgehen

| Datei | Aufgabe |
| --- | --- |
| [.mock/design_cimt/index.html](.mock/design_cimt/index.html) | Semantischer Seitenaufbau, Navigation, SVG-Grafiken, Karten, Dialoge und Quellen. |
| [.mock/design_cimt/styles.css](.mock/design_cimt/styles.css) | Design-Tokens, Materialeffekt, Komponenten, responsive Regeln und Barrierefreiheits-Fallbacks. |
| [.mock/design_cimt/script.js](.mock/design_cimt/script.js) | Mobiles Menü, Hell/Dunkel-Wechsel, Themenauswahl, Beitragsfilter, Lesedialoge und Demo-KI-Check. |

Die HTML-Datei lässt sich direkt im Browser öffnen. Es werden weder ein Build noch ein Backend oder zusätzliche Pakete benötigt. Für die Profilverlinkung die vorhandene Ordnerstruktur beibehalten.

Beim Nachbauen in dieser Reihenfolge vorgehen:

1. Die Farb-, Schrift- und Form-Tokens aus Abschnitt 3 zentral anlegen.
2. Den gemeinsamen Container und die Abschnittsabstände definieren.
3. Die schwebende Navigation mit opakem Fallback aufbauen und danach den CSS-Glaseffekt ergänzen.
4. Die Inhaltsabschnitte aus Abschnitt 4 in ihrer Reihenfolge umsetzen.
5. Die Bedienlogik aus Abschnitt 6 ergänzen, ohne Gestaltung und Zustände zu vermischen.
6. Die responsiven Regeln und Systemeinstellungen aus Abschnitt 7 berücksichtigen.
7. Das Ergebnis anhand der Prüfliste in Abschnitt 9 mit dem Mock vergleichen.

Redaktionelle Themenartikel folgen der Vorlage in Abschnitt 8.

## 3. Farben, Typografie und Formen

### Farben

Alle Farben als CSS-Variablen in `:root` definieren. Für die dunkle Darstellung die variablen Werte unter `:root[data-theme="dark"]` überschreiben.

| Token | Hell | Dunkel | Verwendung |
| --- | --- | --- | --- |
| `--brand` | `#dc6e14` | unverändert | Primärbuttons, Akzente, grafische Hervorhebungen. |
| `--brand-ink` | `#a64b08` | `#f39b56` | Orangefarbener Text mit besserem Kontrast zur jeweiligen Fläche. |
| `--ink` | `#12263a` | `#eef2f5` | Haupttext und Überschriften. |
| `--muted` | `#596777` | `#b2bfcc` | Beschreibungen, Metadaten und Nebeninformationen. |
| `--paper` | `#ffffff` | `#0d1d2b` | Grundfläche und Dialoge. |
| `--soft` | `#f5f6f7` | `#162a3b` | Themenkarten und dezente Bedienflächen. |
| `--warm` | `#fcf8f3` | `#1c292f` | Hero und warme Hervorhebungen. |
| `--line` | `#dde2e6` | `#344756` | Trennlinien und Ränder. |
| `--navy` | `#12263a` | unverändert | Hero-Grafik, Audit-Abschnitt und dunkle Kontaktbuttons. |
| `--on-brand` | `#12263a` | unverändert | Dunkler Text auf dem orangefarbenen Primärbutton. |

Die Unternehmensfarbe nicht pauschal als Textfarbe auf Weiß einsetzen. Für kleinere orangefarbene Schrift `--brand-ink` verwenden. Auf orangefarbenen Buttons steht dunkler Text, nicht Weiß. Kontraste in beiden Darstellungen und insbesondere auf der transparenten Navigation prüfen. [Q4]

### Typografie

Eine gemeinsame Systemschrift verwenden:

```css
--font: -apple-system, BlinkMacSystemFont, "Segoe UI Variable",
        "Segoe UI", Helvetica, Arial, sans-serif;
```

Auf unterstützten Apple-Geräten wird die Systemschrift genutzt, unter Windows die passende Segoe-UI-Variante. SF Pro nicht als Webfont einbetten. Die HIG empfehlen wenige Schriftfamilien, klare Hierarchien und gut lesbare Schriftgrößen. [Q2]

| Element | Ausgangswert im breiten Layout |
| --- | --- |
| Grundschrift | `1.0625rem`, Zeilenhöhe `1.65`. |
| Hero-Überschrift | `clamp(3.5rem, 5.65vw, 5rem)`, Gewicht `700`. |
| Abschnittsüberschrift | `clamp(2rem, 3.4vw, 3rem)`, Gewicht `700`. |
| Große Überschriften | Zeilenhöhe `1.08`, Laufweite `-.045em`. |
| Hero-Beschreibung | `1.0625rem`, Zeilenhöhe `1.75`, maximal `480px` breit. |
| Kartentitel | Etwa `20–25px`, Gewicht `650`. |
| Beitragsüberschriften | `1.5rem`, Gewicht `650`, Zeilenhöhe `1.3`. |
| Beitragstext im Dialog | `1rem`, Zeilenhöhe `1.85`. |
| Primärbutton | `.9375rem`, Gewicht `650`. |

Überschriften mit `text-wrap: balance` setzen. Lange deutsche Kartentitel mit `hyphens: auto` und `overflow-wrap: anywhere` vor Überlaufen schützen. Die kleineren Ansichten besitzen zusätzliche Schriftgrößen-Regeln in `styles.css`.

### Formen und Tiefe

| Element | Gestaltung |
| --- | --- |
| Themenkarten, Beitragskarten, Audit-Fläche, Dialoge | Radius `28px`. |
| Formulargruppen und kleinere Innenflächen | Radius `16px`. |
| Buttons, Filter und breite Navigationskapsel | Radius `999px`. |
| Hero-Grafik | Radius `36px`, Inhalt an der Rundung abschneiden. |
| Standard-Schatten hell | `0 8px 32px -18px rgba(18, 38, 58, .2)`. |
| Standard-Schatten dunkel | `0 8px 32px -16px rgba(0, 0, 0, .5)`. |

Weiche Schatten trennen die Ebenen, ohne jede Karte optisch schweben zu lassen. Die orangefarbene Kontur einer ausgewählten Themenkarte kommt zusätzlich zum semantischen Zustand `aria-pressed`.

## 4. Seitenaufbau

### Gemeinsames Raster

```css
.container {
  width: min(1240px, calc(100% - 96px));
  margin-inline: auto;
}

.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 64px;
  align-items: center;
}
```

`minmax(0, 1fr)` verhindert, dass lange Inhalte die Hero-Spalten über ihre verfügbare Breite hinaus vergrößern. Breite Inhaltsabschnitte erhalten grundsätzlich `104px` vertikalen Innenabstand; kompaktere Ansichten reduzieren diesen Wert. Einzelne Abschnitte haben bewusst abweichende Abstände.

### Abschnitte in dieser Reihenfolge

| Abschnitt | So wird er aufgebaut |
| --- | --- |
| **Navigation** | Als `position: sticky` oben halten. Ein äußerer Header mit `12px` vertikalem Abstand enthält eine eigene Glaskapsel. Darin stehen Wortmarke, Themenlinks, Hell/Dunkel-Schalter und auf breiten Ansichten ein orangefarbener CTA. |
| **Gestaltungshinweis** | Oberhalb des Hero-Inhalts bleibt die dezente Zeile „cimt-Farben. Apple-inspirierte Klarheit.“ mit orangefarbenem Punkt. Sie ist keine zusätzliche Kopf- oder Statusleiste. |
| **Hero** | Links stehen „KI verstehen. Potenziale entfalten.“, Einführung und zwei Aktionen. Rechts liegt die dunkelblaue SVG-Grafik mit orangefarbenem KI-Kern, vier Stationen und verbindenden Kreisen. Hintergrund ist `--warm`. |
| **Drei Grundsätze** | Unter dem Hero drei nummerierte Aussagen zu Verständnis, Praxis und Verantwortung. Im breiten Layout nebeneinander mit Trennlinien. |
| **Themen** | Vier auswählbare Karten: Softwareentwicklung, Data & Analytics, Prozessautomatisierung und KI im Arbeitsalltag. Darunter erklärt eine gemeinsame Detailfläche die gewählte Perspektive. |
| **KI-Audit-Teaser** | Vollbreiter dunkelblauer Abschnitt. Links Einführung und Demo-Button, rechts eine opake Reifegrad-Fläche mit Einfach, Strukturiert und Intelligent. Orange Akzente verbinden den Abschnitt mit der Marke. |
| **Wissen & Praxis** | Themenfilter als Pills; darunter opake Beitragskarten mit eigener CSS-/SVG-Illustration, Kategorie, Titel und Kurzbeschreibung. Breite Ansichten zeigen zwei Spalten. |
| **Haltung und Profil** | Ruhiger zweispaltiger Textabschnitt mit Link zum vorhandenen Profil-Mock. |
| **Kontakt** | Orangefarbene Fläche mit dunkler Überschrift und dunkelblauem Button zur cimt-Kontaktseite. Externen Link als solchen kennzeichnen. |
| **Footer** | Wortmarke, Einordnung als lokaler Entwurf, Sprunglink nach oben und aufklappbare Gestaltungsquellen. |

Die Illustrationen selbst erstellen: SVG für das Hero-Diagramm und gemeinsame Symbole, CSS für Codefenster, Workflow, Balkengrafik und typografische Beitragsbilder. Dekorative Grafiken vor Screenreadern verbergen; die inhaltliche Hero-Grafik mit Titel und Beschreibung auszeichnen.

## 5. Liquid Glass richtig einsetzen

Apple beschreibt Liquid Glass als funktionale Ebene für Navigation und Bedienelemente, nicht als Material für Inhaltskarten. Der Mock beschränkt es deshalb auf `.header-inner`. [Q3]

**Glas bleibt automatisch an, ohne Schalter und ohne JavaScript.** Der folgende Aufbau zeigt den Materialteil; Raster, Innenabstände und Radien aus den vorherigen Abschnitten ergänzen:

```css
:root {
  --navigation-bg: var(--paper);
  --navigation-filter: none;
  --navigation-sheen: none;
  --navigation-border: var(--line);
}

@supports (backdrop-filter: blur(1px)) or
          (-webkit-backdrop-filter: blur(1px)) {
  :root {
    --navigation-bg: rgba(255, 255, 255, .88);
    --navigation-filter: blur(24px) saturate(140%);
    --navigation-sheen:
      linear-gradient(135deg, rgba(255, 255, 255, .45), transparent 60%);
    --navigation-border: rgba(255, 255, 255, .7);
  }

  :root[data-theme="dark"] {
    --navigation-bg: rgba(13, 29, 43, .9);
    --navigation-sheen:
      linear-gradient(135deg, rgba(255, 255, 255, .08), transparent 60%);
    --navigation-border: #506171;
  }
}

.header-inner {
  background-color: var(--navigation-bg);
  background-image: var(--navigation-sheen);
  border: 1px solid var(--navigation-border);
  box-shadow: var(--shadow);
  -webkit-backdrop-filter: var(--navigation-filter);
  backdrop-filter: var(--navigation-filter);
}

@media (prefers-reduced-transparency: reduce),
       (prefers-contrast: more),
       (forced-colors: active) {
  :root,
  :root[data-theme="dark"] {
    --navigation-bg: var(--paper);
    --navigation-filter: none;
    --navigation-sheen: none;
    --navigation-border: var(--muted);
  }
}

@media print {
  :root,
  :root[data-theme="dark"] {
    --navigation-bg: var(--paper);
    --navigation-filter: none;
    --navigation-sheen: none;
  }
}
```

Die Fallback-Regeln **nach** den normalen Materialregeln platzieren. Die explizite dunkle Variante in den Media Queries verhindert, dass eine spezifischere Dark-Mode-Regel den Barrierefreiheits-Fallback übersteuert.

Der äußere Header erhält keinen eigenen Blur-Filter. Keine verschachtelten Glasflächen und keinen zusätzlichen Weichzeichner über dem Seiteninhalt anlegen. Nur der Hintergrund hinter der Navigation wird weichgezeichnet; deren Schrift bleibt scharf. Die Abdunklung hinter einem geöffneten Dialog ist ein Modal-Backdrop, keine durchsichtige Dialogfläche.

## 6. Bedienlogik

| Funktion | Verhalten |
| --- | --- |
| Mobiles Menü | Button mit `aria-expanded` und `aria-controls`. Schließt bei Linkwahl, Klick außerhalb, Fokuswechsel aus dem Header und `Esc`. Bei `Esc` Fokus zum Menübutton zurückgeben. |
| Hell/Dunkel | `data-theme` auf dem HTML-Element wechseln und `aria-pressed` sowie die Beschriftung des Buttons aktualisieren. Kein Cookie oder Local Storage. |
| Themenauswahl | Genau eine Karte mit `aria-pressed="true"`. Titel und Beschreibung der gemeinsamen Detailfläche aktualisieren; Änderungen über `aria-live="polite"` ankündigen. |
| Passende Beiträge | Den Filter auf das gewählte Thema setzen und zum Wissensabschnitt springen. |
| Beitragsfilter | Nicht passende Karten mit `hidden` ausblenden. Filterzustand mit `aria-pressed` und Trefferzahl über eine Statusmeldung vermitteln. |
| Lesedialog | Natives `<dialog>` mit `showModal()`. Überschrift zuordnen, sichtbaren Schließen-Button anbieten und `Esc` ermöglichen. Ein Klick außerhalb schließt; ein Klick in den Dialog-Innenabstand nicht. |
| Demo-KI-Check | Drei Pflichtfragen zu Zielen, Daten und Verantwortung. Für jede Antwort „Noch nicht“ einen konkreten nächsten Schritt anzeigen. Keinen Reifegrad aus nur drei Antworten ableiten. |
| Demo-Daten | Antworten nur während des geöffneten Checks im Arbeitsspeicher halten und beim Schließen zurücksetzen. Keine Übertragung. |

Der Audit-Teaser und die Beispielbeiträge sind als Demo gekennzeichnet. Die fachliche Einordnung von Workflows, menschlichen Freigaben und Governance orientiert sich an cimt zu n8n; die Perspektive auf KI-Adoption knüpft an die Langdock-Seite an. Die Mock-Texte sind eigenständige Beispiele, keine übernommenen Projektberichte. [Q5] [Q6]

## 7. Responsive Verhalten und Barrierefreiheit

### Breakpoints

Die Regeln kumulativ in dieser Reihenfolge anlegen:

| Fensterbreite | Wesentliche Anpassungen |
| --- | --- |
| Über `1180px` | Container maximal `1240px`, sonst `48px` Seitenabstand. Hero zweispaltig, vier Themenkarten und zwei Beitragsspalten. |
| Bis `1180px` | Seitenabstand `32px`, kleinere Rasterabstände; zusätzlichen CTA in der Navigation ausblenden. |
| Bis `850px` | Seitenabstand `24px`, Themenkarten zweispaltig, Abschnittsabstand grundsätzlich `72px`. |
| Bis `650px` | Seitenabstand `20px`, mobiles Menü, Navigationsradius `28px`. Hero, Audit, Grundsätze und Beiträge einspaltig; Abschnittsabstand grundsätzlich `60px`. |
| Bis `359px` | Seitenabstand `16px`, auch Themenkarten einspaltig. Kleinere Überschriften und kompaktere Innenabstände verhindern Überlaufen. |
| Ab `1600px` | Zusätzlich `12px` Innenabstand oberhalb des Hero-Rasters. |

Auf kleinen Bildschirmen steht die Hero-Grafik unter dem Text und wird höchstens `470px` breit. Filter dürfen umbrechen. Weder feste Seitenbreiten noch `overflow-x: hidden` verwenden, um Layoutfehler zu verstecken.

### Bedienbarkeit

Die HIG betonen lesbare Inhalte, ausreichend große Bedienelemente, Kontraste und anpassbare Darstellung. Diese Prinzipien werden hier mit Web-Techniken umgesetzt; native Apple-API-Funktionen wie Dynamic Type werden nicht vorgetäuscht. [Q2] [Q4]

- Navigation und zentrale Buttons mit mindestens `44px` hohen Bedienflächen gestalten; der Primärbutton ist `52px` hoch.
- Einen sichtbaren Tastaturfokus und einen Sprunglink zum Hauptinhalt anbieten.
- Auswahl nicht nur farblich vermitteln: Kontur, Buttonzustand und semantische Attribute ergänzen.
- Bei `prefers-reduced-motion: reduce` weiches Scrollen, Übergänge und Hover-Verschiebungen abschalten.
- Bei `prefers-contrast: more` Ränder verstärken und die Navigation opak darstellen.
- Bei `prefers-reduced-transparency: reduce` oder `forced-colors: active` ebenfalls auf opake Navigation wechseln.
- Inhaltliche Flächen immer deckend halten und Kontraste auch im Dark Mode prüfen.

## 8. Redaktionelle Themenartikel

Vorlage für alle redaktionellen Themenartikel unter `/{lang}/themen/<slug>` in Deutsch und Englisch (#61). Sie beschreibt den umgesetzten Stand der beiden vorhandenen Artikel **„Vibe Coding“** (`VibeCoding.tsx`, `VibeCoding.css`) und **„KI in der Softwareentwicklung“** (`SoftwareDevelopment.tsx`, Artikelregeln in `styles.css`). Der Artikelkopf ist für beide identisch (`components/ArticleHeader.tsx`); der Artikelkörper setzt sich aus den unten genannten Bausteinen zusammen. Allgemeine Themenseiten mit Beitragsliste und die KI-Readiness-Selbsteinschätzung sind keine redaktionellen Artikel und nutzen eigene Layouts.

### Seitenaufbau und Navigation

Reihenfolge von oben nach unten:

1. Schwebende Hauptnavigation (Abschnitt 4) mit dem Themenmenü. Sie ist der Weg zu anderen Themen.
2. **Artikelkopf** auf `--warm` über die volle Fensterbreite: Titel, optionaler Untertitel, Autorenblock.
3. **Artikelkörper**: Abschnitte im Inhaltsrahmen, je nach Artikel mit Einleitung, Perspektiven- oder Themenabschnitten und Grafiken.
4. **Abschlussblock**: Fazit („Vibe Coding“) oder Meinungsaufruf mit Kontaktbutton („KI in der Softwareentwicklung“). Danach folgt direkt der Footer; Verweise auf weitere Themen am Beitragsende entfallen (#37, #38).

Im gesamten Themenbereich gibt es **keine Brotkrumennavigation** (weder „Start / Themen / …“ noch „Themen / …“). Beim Öffnen erhält die Hauptüberschrift den Fokus (`usePageFocus`, `tabIndex="-1"`), sodass Tastatur- und Screenreader-Nutzer direkt beim Seitentitel beginnen. Inhaltliche Sprunglinks (Übersicht der Perspektiven in „Vibe Coding“) gehören zum Artikelkörper.

### Artikelkopf

| Element | Gestaltung |
| --- | --- |
| Fläche `.article-head` | Hintergrund `--warm`, `margin-top: -24px` gleicht den Innenabstand von `#main` aus, sodass die Fläche direkt unter der Navigation beginnt. Innenabstand `96px` oben, `104px` unten. |
| Textblock `.article-head-copy` | Im Inhaltsrahmen horizontal zentriert, maximal `860px` breit, `text-align: center`. |
| Titel `h1` | Genau eine Hauptüberschrift je Artikel, zentriert. Gemeinsame Werte aus der Vibe-Coding-Referenz: `clamp(3.6rem, 8vw, 7rem)`, Gewicht `700`, Zeilenhöhe `1`, Laufweite `-.06em`, `text-wrap: balance`, `hyphens: auto`, `overflow-wrap: break-word`. Bei `1280px` ergibt das `102.4px`, ab `1400px` die Obergrenze `112px`. |
| Untertitel `.article-subtitle` | **Optional.** `clamp(1.4rem, 2.4vw, 2rem)`, Gewicht `600`, Zeilenhöhe `1.3`, `26px` Abstand zum Titel, `text-wrap: balance`. |
| Autorenblock `.byline` (#56) | Zentriert unter Titel bzw. Untertitel, `32px` Abstand. Rundes Porträt (`44px`) links, rechts der Name (Gewicht `650`) und darunter „Stand · Lesezeit“ in `--text-2`; der Text im Block ist linksbündig. Stand und Lesezeit brechen nur zwischen den Angaben um. |

Ohne Untertitel folgt der Autorenblock direkt auf den Titel. Eine nummerierte Themenzeile oder Kennzeile („01 Softwareentwicklung“) über dem Titel gibt es nicht.

### Typografie

Systemschrift `--font` wie im übrigen Auftritt.

| Element | Wert |
| --- | --- |
| Titel | siehe Artikelkopf. |
| Abschnittsüberschrift `h2` „Vibe Coding“ | `clamp(1.9rem, 2.7vw, 2.5rem)`, Zeilenhöhe `1.15`; mobil `27px`. |
| Abschnittsüberschrift `h2` „Softwareentwicklung“ | `clamp(1.75rem, 2.6vw, 2.25rem)`, Zeilenhöhe `1.15`, Laufweite `-.035em`. |
| Kennzeile über `h2` (`.eyebrow`) | `.75rem`, Gewicht `650`, Laufweite `.12em`, Großbuchstaben, `--accent`, mit `28px` breitem orangefarbenem Strich davor. Nur in Abschnitten, die eine Kategorie nennen (Perspektivenname, „Fazit“). |
| Perspektivennummer `.vc-number` | `clamp(3.5rem, 5vw, 4.75rem)`, Gewicht `250`, `--accent`, dekorativ (`aria-hidden`). |
| Fließtext | „Vibe Coding“: `16.5px`, Zeilenhöhe `1.85`, `--text-2`; erster Absatz der Einleitung `19px` in `--text`. „Softwareentwicklung“: `1.0625rem`, Zeilenhöhe `1.85`, `hyphens: auto`; Leitabsatz `1.1875rem`; mobil `1rem` bzw. `1.0625rem`. |
| Zitat `.vc-quote` | `clamp(1.9rem, 3.6vw, 2.75rem)`, Gewicht `700`, Zeilenhöhe `1.15`, Laufweite `-.045em`, zentriert. |
| Beschriftungen (Beispielkasten, Weiterlesen) | `11px` bzw. `.625rem`, Gewicht `650`, Laufweite `.12em`, Großbuchstaben, `--accent`. |

### Farben

Es gelten die Tokens aus Abschnitt 3; Artikel verwenden nur semantische Rollen (`--text`, `--text-2`, `--accent`, `--border`) und keine eigenen Hex-Werte für Text.

| Fläche | Farbe |
| --- | --- |
| Artikelkopf | `--warm`. |
| Einleitung und Abschnitte der Softwareentwicklung | `--paper`. |
| Perspektivenbereich „Vibe Coding“ | `--soft`; Beispielkästen darin `--paper`, außerhalb `--warm`. |
| Fazit „Vibe Coding“ | `--navy`, Text weiß, Fließtext `#bdcbd7`, Kennzeile `#f39b56`. |
| Meinungsaufruf „Softwareentwicklung“ | `--brand` mit `--on-brand`; Button `--navy` mit weißem Text. |
| Grafikrahmen `.article-figure` | Immer Weiß (`#fff`), auch im Dark Mode, damit transparente Diagramme lesbar bleiben (#41). |
| Akzentlinien | Beispielkasten und Weiterlesen-Verweis mit `3px` linker Linie in `--brand`. |

### Abstände

| Bereich | Desktop | bis `850px` | bis `650px` |
| --- | --- | --- | --- |
| Artikelkopf oben/unten | `96px` / `104px` | `72px` / `72px` | `56px` / `56px` |
| Einleitung „Vibe Coding“ | `96px` / `104px` | `72px` | `52px` / `56px` |
| Perspektive „Vibe Coding“ | `72px` (erste oben `96px`, letzte unten `104px`) | `56px` | `44px` |
| Artikelkörper „Softwareentwicklung“ | `80px` / `96px`, `64px` zwischen Abschnitten | `56px` / `72px`, `48px` | wie `850px` |
| Grafik im Text | `48px` oben/unten („Vibe Coding“: `32px`) | – | `36px` |
| Absätze | `18px` („Vibe Coding“) bzw. `20px` | – | – |

### Inhaltsrahmen und Lesespalte

Alle Artikelinhalte liegen im gemeinsamen Inhaltsrahmen `.container` (`min(1240px, 100% - 96px)`; bis `1180px` `100% - 64px`, bis `850px` `100% - 48px`, bis `650px` `100% - 40px`). Der Artikelkopf zentriert seinen Textblock (maximal `860px`) in diesem Rahmen. Die Lesespalte ist auf dem Desktop höchstens `680px` („Vibe Coding“, `.vc-body`) bzw. `760px` („Softwareentwicklung“, `.article-split-body`) breit (#57). Die Einleitung von „Vibe Coding“ nutzt die volle Rahmenbreite (#43).

### Abschnittsraster

Abschnitte mit Überschrift verwenden auf dem Desktop ein zweispaltiges Raster `minmax(0, 5fr) minmax(0, 7fr)` mit `88px` Abstand (bis `1180px`: `56px`):

- **Titelspalte links** (`.vc-split-head`, `.article-split-head`): Nummer, Kennzeile und `h2`. Sie bleibt beim Scrollen mit `position: sticky; top: 120px` sichtbar.
- **Lesespalte rechts** (`.vc-body`, `.article-split-body`): Fließtext, Grafiken, Beispiele.
- Abschnitte ohne Überschrift (Grafikabschnitte der Softwareentwicklung) setzen ihren Inhalt in die rechte Spalte (`grid-column: 2`), damit die Lesespalte durchgehend fluchtet.

Bis `850px` und im Druck ist das Raster einspaltig in Dokumentreihenfolge; die Titelspalte ist dann nicht mehr sticky.

### Inhaltsbausteine

Pflicht sind Artikelkopf mit Titel und Autorenblock, mindestens ein Abschnitt und ein Abschlussblock. Alle anderen Bausteine sind **optional**:

| Baustein | Verwendet in | Gestaltung |
| --- | --- | --- |
| Untertitel | „Vibe Coding“ | Im Artikelkopf zwischen Titel und Autorenblock. |
| Einleitung mit Sprungliste | „Vibe Coding“ | Fließtext über die Rahmenbreite, darunter nummerierte Liste `.vc-index` mit `68px` hohen Zeilen und Trennlinien; jeder Eintrag springt per `jumpTo` zum Abschnitt und fokussiert ihn. |
| Beispielkasten `.vc-example` | „Vibe Coding“ | `figure` mit `figcaption` („Im Beispiel“), kursivem Text, `--warm`-Fläche, `3px` orangefarbener linker Linie, Radius `0 16px 16px 0`. |
| Zitat `.vc-quote` | „Vibe Coding“ | Großes zentriertes `blockquote` zwischen Linien oben und unten (`36px` Innenabstand). |
| Zitat als Überschrift `.quote-heading` | „Softwareentwicklung“ | `h2` mit großem dekorativem Anführungszeichen in `--brand` (`opacity: .35`) und Quelle als `small`. |
| Nummerierte Perspektive | „Vibe Coding“ | Abschnittsraster mit Nummer, Kennzeile und `h2` links. |
| Grafik `Diagram` (#41) | beide | `figure.article-figure` in der Lesespalte, weißer Rahmen mit `28px` Innenabstand, Radius `--radius`, `--shadow`; Bild in Spaltenbreite mit beschreibendem Alternativtext, sprachspezifische Datei, kein Link zur Originalgröße. |
| Weiterlesen-Verweis `.related-link` | „Softwareentwicklung“ | Ganze Fläche als Link zu einem anderen Artikel: Beschriftung „Weiterlesen“, Titel, Pfeil; `--soft`-Fläche mit orangefarbener linker Linie. |
| Fazit `.vc-conclusion` | „Vibe Coding“ | Dunkelblaue Karte im Abschnittsraster, Radius `32px`, Innenabstand `64px`. |
| Meinungsaufruf `.opinion` | „Softwareentwicklung“ | Orangefarbene Karte mit Sprechblasen-Symbol, Überschrift, Text und Button zum Kontaktformular. |

Ein Artikel endet mit genau einem Abschlussblock (Fazit oder Meinungsaufruf).

### Responsives Verhalten

| Fensterbreite | Artikel |
| --- | --- |
| Desktop über `1180px` | Kopf zentriert mit Titel bis `112px`; Abschnitte zweispaltig mit `88px` Abstand und sticky Titelspalte. |
| Bis `1180px` | Rasterabstand `56px`; Fazit mit `52px 44px` Innenabstand. |
| Bis `850px` (Tablet) | Abschnitte einspaltig, Lesespalte ohne Höchstbreite; Kopf mit `72px` Innenabstand; Meinungsaufruf mit Button in eigener Zeile. |
| Bis `650px` (Mobil) | Titel `clamp(2.5rem, 13vw, 4rem)` (bei `320px` `41.6px`, bei `390px` `50.7px`), weiterhin zentriert; lange Titel wie „KI in der Softwareentwicklung“ trennen per `hyphens: auto` bzw. brechen per `overflow-wrap` innerhalb der Breite um. Autorenblock mit `28px` Abstand. Beispielkästen, Grafiken (`12px` Innenabstand) und Abschlussblöcke kompakter; Meinungsbutton volle Breite. |
| Druck | Kopf ohne Fläche, Raster einspaltig, Fazit ohne dunkle Fläche. |

Auf keiner Breite entsteht horizontaler Bildlauf; Text wird nicht abgeschnitten (geprüft bei `320px`, `390px`, `1280px` und `1440px`).

### Barrierefreiheit

- Genau ein `h1` je Artikel; Abschnitte sind `section` mit `aria-labelledby` auf ihr `h2` oder, ohne sichtbare Überschrift, mit `aria-label`.
- Keine Brotkrumennavigation: Vor dem Titel steht im Hauptinhalt kein fokussierbares Element. Die Hauptnavigation bleibt vollständig per Tastatur bedienbar.
- Der Titel erhält beim Seitenwechsel den Fokus; Sprungziele haben `tabIndex="-1"` und `scroll-margin-top`, sichtbarer Fokus über `:focus-visible` (`3px` in `--accent`).
- Dekorative Elemente (Nummern, Anführungszeichen, Symbole, Trenner im Autorenblock) sind mit `aria-hidden` verborgen; das Porträt hat einen leeren Alternativtext, weil der Name daneben steht.
- Grafiken tragen beschreibende Alternativtexte in der Sprache des Artikels; der Artikel trägt sein `lang`-Attribut.
- Datum als `<time datetime>`; Kontraste in Hell und Dunkel nach Abschnitt 3, orangefarbener Text nur als `--accent`/`--brand-ink`.
- Bei `prefers-reduced-motion: reduce` springen Sprunglinks ohne weiches Scrollen, Hover-Verschiebungen entfallen.

## 9. Prüfliste beim Nachbauen

- Die Seite beginnt mit der schwebenden Navigation; die frühere obere Textleiste und der Glas-Schalter fehlen.
- Liquid Glass ist beim Laden sowie nach einem Neuladen aktiv und funktioniert ohne JavaScript.
- Nach einem Hell/Dunkel-Wechsel bleibt der Glaseffekt aktiv; Karten und Dialoge bleiben opak.
- Reduzierte Transparenz, erhöhter Kontrast, erzwungene Farben und Druckansicht erhalten den opaken Fallback.
- Bei `1440px`, `768px`, `390px` und `320px` entsteht kein horizontaler Scrollbalken. Sehr schmale Ansichten zusätzlich prüfen.
- Menü, Themenauswahl, Filter, Lesedialoge und Demo-Check funktionieren mit Tastatur; Dialoge stellen den Fokus nach dem Schließen wieder her.
- Der Check verlangt drei Antworten, zeigt passende Impulse und löscht Antworten beim Schließen.
- Die Seite lädt keine externen Schriftarten, Bilder oder Tracking-Skripte. Externe Inhalte werden erst durch bewusste Linkwahl geöffnet.

## 10. Quellen

Die Quellen wurden für den Entwurf am **2026-11-09** herangezogen. Aussagen und daraus abgeleitete Gestaltungsentscheidungen sind oben zugeordnet; der vorhandene Mock ist die Referenz für die konkreten CSS-Werte.

| Quelle | Belegt oder inspiriert |
| --- | --- |
| [Q1: cimt-Startseite][Q1] | Farbwirkung, sachlicher Unternehmensauftritt sowie Verbindung von Strategie und Umsetzung. `#dc6e14` ist die separate Nutzervorgabe. |
| [Q2: Apple HIG – Typography][Q2] | Systemtypografie, Lesbarkeit, Schriftgewichtung und Informationshierarchie. |
| [Q3: Apple HIG – Materials][Q3] | Trennung von Navigation und Inhalt, sparsamer Einsatz von Liquid Glass, Material-Lesbarkeit. |
| [Q4: Apple HIG – Accessibility][Q4] | Kontrast, Tastatur- und alternative Bedienung, große Bedienflächen und anpassbare Darstellung. |
| [Q5: cimt – n8n-Beratung][Q5] | Workflow-Automatisierung, menschliche Freigaben, Guardrails und Governance. |
| [Q6: cimt – Langdock-Beratung][Q6] | KI-Adoption und Einbindung von KI in den Unternehmensalltag. |

[Q1]: https://www.cimt-ag.de/
[Q2]: https://developer.apple.com/design/human-interface-guidelines/typography
[Q3]: https://developer.apple.com/design/human-interface-guidelines/materials
[Q4]: https://developer.apple.com/design/human-interface-guidelines/accessibility
[Q5]: https://www.cimt-ag.de/n8n-beratung/
[Q6]: https://www.cimt-ag.de/langdock-beratung/
