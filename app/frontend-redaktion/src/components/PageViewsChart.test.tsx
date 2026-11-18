import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageViewsChart } from './PageViewsChart';

// Anforderung #65: Die Grafik ersetzt die Tagestabelle. Interaktion prüft app/e2e/tests/65-tageswerte-grafik.spec.ts.

const days = [
  { date: '2026-11-18', views: 138, uniqueViews: 54 },
  { date: '2026-11-17', views: 0, uniqueViews: 0 },
];
const markup = (showUnique = true) => renderToStaticMarkup(<PageViewsChart days={days} showUnique={showUnique} onShowUnique={() => {}} />);

describe('REQ-65-AC1: Grafik ohne Verweis auf eine Tabelle', () => {
  it('nennt in Beschreibung und Bildunterschrift keine Tabelle, sondern die Grafik als Ort der Tageswerte', () => {
    const html = markup();
    expect(html).not.toMatch(/Tabelle/);
    expect(html).not.toMatch(/<table/);
    expect(html).toMatch(/<figcaption>[^<]*Genaue Tageswerte[^<]*<\/figcaption>/);
  });
});

describe('REQ-65-AC3: Tagesauswahl per Tastatur erreichbar', () => {
  it('bietet eine fokussierbare Gruppe mit Bedienhinweis', () => {
    const html = markup();
    expect(html).toMatch(/<div[^>]*role="group"[^>]*tabindex="0"|<div[^>]*tabindex="0"[^>]*role="group"/);
    expect(html).toMatch(/Pfeiltasten/);
  });

  it('enthält eine Live-Region für Screenreader und zeigt anfangs keinen Tooltip', () => {
    const html = markup();
    expect(html).toMatch(/role="status"/);
    expect(html).not.toMatch(/class="chart-tooltip/);
  });

  it('behält die Bedienung bei ausgeblendeter bereinigter Kurve (REQ-65-AC2)', () => {
    expect(markup(false)).toMatch(/role="group"/);
  });
});
