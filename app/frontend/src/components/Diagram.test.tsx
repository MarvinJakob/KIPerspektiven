import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import css from '../styles.css?raw';
import { Diagram } from './Diagram';

// Anforderung #41: Artikelgrafiken ohne neuen Tab, in Textbreite und auf heller Fläche.
// Die Fidelity-Tests im Browser stehen in app/e2e/tests/41-artikelbilder.spec.ts.

const markup = renderToStaticMarkup(<Diagram src="/assets/diagramm.png" alt="Release Gate: Build, Test und Final Check" width={1521} height={576} />);

/** Alle Deklarationen der Regeln, deren Selektor genau `selector` ist – auch innerhalb von Media Queries. */
function declarations(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...css.matchAll(new RegExp(`(?:^|[}\\s,])${escaped}\\s*\\{([^}]*)\\}`, 'gm'))].flatMap((m) =>
    m[1].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const i = d.indexOf(':');
      return { property: d.slice(0, i).trim(), value: d.slice(i + 1).trim() };
    }),
  );
}

describe('REQ-41-AC1/AC4: Diagramm ohne Link zur Bilddatei', () => {
  it('rendert kein Link-Element und keine Zieladresse um das Bild', () => {
    expect(markup).not.toMatch(/<a[\s>]/);
    expect(markup).not.toContain('href=');
    expect(markup).not.toContain('target=');
  });

  it('bietet im Diagramm keinen Tab-Stopp an', () => {
    expect(markup).not.toMatch(/tabindex=|<button/i);
  });

  it('behält Bild, Alternativtext und Abmessungen für Screenreader und Seitenverhältnis', () => {
    expect(markup).toMatch(/^<figure class="article-figure"><img [^>]*><\/figure>$/);
    expect(markup).toContain('alt="Release Gate: Build, Test und Final Check"');
    expect(markup).toContain('src="/assets/diagramm.png"');
    expect(markup).toContain('width="1521"');
    expect(markup).toContain('height="576"');
    expect(markup).not.toContain('aria-hidden');
  });
});

describe('REQ-41-AC2/AC3: Gestaltung der Diagrammfläche', () => {
  const figure = declarations('.article-figure');

  it('ragt in keiner Breite über die Textspalte hinaus (kein negativer Außenabstand)', () => {
    const margins = figure.filter((d) => d.property.startsWith('margin'));
    expect(margins.length).toBeGreaterThan(0);
    for (const m of margins) expect(m.value, `${m.property}: ${m.value}`).not.toMatch(/(^|\s)-/);
  });

  it('legt das transparente Bild auf eine weiße, deckende Fläche', () => {
    expect(figure).toContainEqual({ property: 'background', value: '#fff' });
  });

  it('enthält keine Regel mehr für einen Bildlink', () => {
    expect(declarations('.article-figure a')).toEqual([]);
    expect(figure.filter((d) => d.property === 'cursor')).toEqual([]);
  });
});
