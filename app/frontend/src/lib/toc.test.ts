// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { activeIndex, collectSections, TOC_MEDIA, tocEnabled } from './toc';

// Anforderung #98: Mobiles Inhaltsverzeichnis zeigt den aktuellen Abschnitt.
// Sollwerte aus dem Ticket (Geltungsbereich, Breakpoint 650 CSS-Pixel) und der Spezifikation REQ-98-AC1 bis AC6.

describe('REQ-98-AC1/AC4: Geltungsbereich und Breakpoint', () => {
  it('nutzt den bestehenden mobilen Breakpoint bis einschließlich 650 CSS-Pixel', () => {
    expect(TOC_MEDIA).toBe('(max-width: 650px)');
  });

  it.each([
    '/de', '/en/', '/de/themen/softwareentwicklung', '/en/themen/vibe-coding', '/de/themenartikel/12',
    '/de/blog/ai-audit-fuenf-fragen', '/en/blog/was-ki-kostet/', '/de/ki-verstehen', '/en/ki-einsatzfelder',
  ])('%s liegt im Geltungsbereich', (path) => {
    expect(tocEnabled(path)).toBe(true);
  });

  it.each([
    '/', '/de/blog', '/de/blog/', '/de/themen/ai-audit', '/de/themen/ai-audit/strategie',
    '/de/themen/ai-audit/ergebnis', '/de/profil', '/de/kontakt', '/de/impressum', '/de/datenschutz',
    '/redaktion', '/redaktion/themenartikel/3', '/fr/blog/x', '/de/blog/x/y',
  ])('%s ist ausgenommen (Übersicht, Selbsteinschätzung, Redaktion, sonstige Seiten)', (path) => {
    expect(tocEnabled(path)).toBe(false);
  });
});

function dom(html: string) {
  document.body.innerHTML = `<header><h2>Kopf</h2></header><main id="main">${html}</main><footer><h2>Themen</h2></footer>`;
  return document.getElementById('main')!;
}

describe('REQ-98-AC1/AC5/AC6: Einträge aus den Abschnittsüberschriften', () => {
  it('übernimmt sichtbare H2 des Inhalts in Seitenreihenfolge, ohne Kopf- und Fußzeile', () => {
    const main = dom('<h1>Titel</h1><h2 id="a">Erster  Abschnitt</h2><h3>Unterpunkt</h3><section><h2>Zweiter\nAbschnitt</h2></section><h2>Dritter</h2>');
    const sections = collectSections(main);
    expect(sections.map((s) => s.entry.label)).toEqual(['Erster Abschnitt', 'Zweiter Abschnitt', 'Dritter']);
    expect(sections[0].entry.id, 'vorhandene ID bleibt').toBe('a');
  });

  it('vergibt fehlende Sprungziele eindeutig und macht die Überschrift fokussierbar', () => {
    const main = dom('<h2>Eins</h2><h2>Zwei</h2><p id="abschnitt-1">belegt</p>');
    const sections = collectSections(main);
    const ids = sections.map((s) => s.entry.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids).not.toContain('abschnitt-1');
    for (const s of sections) {
      expect(document.getElementById(s.entry.id)).toBe(s.heading);
      expect(s.heading.tabIndex).toBe(-1);
    }
    // Erneutes Einsammeln behält die IDs (stabile Sprungziele bei späteren Änderungen der Seite).
    expect(collectSections(main).map((s) => s.entry.id)).toEqual(ids);
  });

  it('nutzt eine hinterlegte Kurzbezeichnung und lässt nur für Screenreader sichtbare Überschriften aus', () => {
    const main = dom('<h2 class="sr-only">Kennzahlen</h2><h2 data-toc-label="Themen">Zwei Themen,<br>die zählen</h2><div class="sr-only"><h2>Versteckt</h2></div><h2 data-toc="off">Ohne</h2><h2>   </h2>');
    expect(collectSections(main).map((s) => s.entry.label)).toEqual(['Themen']);
  });

  it('übernimmt die Inhaltssprache der Überschrift', () => {
    const main = dom('<article lang="de"><h2>Abschnitt</h2></article><h2>Section</h2>');
    expect(collectSections(main).map((s) => s.entry.lang)).toEqual(['de', undefined]);
  });

  it('liefert für Seiten ohne Abschnittsüberschrift eine leere Liste', () => {
    expect(collectSections(dom('<h1>Nur Titel</h1><p>Text</p>'))).toEqual([]);
  });
});

describe('REQ-98-AC2: aktiver Abschnitt', () => {
  // Überschriften-Oberkanten relativ zum Fenster; Lesemarke bei 200 px.
  const tops = [100, 500, 900];

  it('markiert den letzten Abschnitt, dessen Überschrift die Lesemarke erreicht hat', () => {
    expect(activeIndex(tops, 200, false)).toBe(0);
    expect(activeIndex([-300, 150, 900], 200, false)).toBe(1);
    expect(activeIndex([-900, -500, 200], 200, false), 'genau auf der Lesemarke').toBe(2);
  });

  it('markiert vor dem ersten Abschnitt keinen Eintrag', () => {
    expect(activeIndex([201, 600], 200, false)).toBe(-1);
  });

  it('markiert am Seitenende den letzten Abschnitt, auch wenn er die Lesemarke nicht erreicht', () => {
    expect(activeIndex([-100, 300, 700], 200, true)).toBe(2);
  });

  it('liefert ohne Abschnitte keinen Eintrag', () => {
    expect(activeIndex([], 200, true)).toBe(-1);
  });
});
