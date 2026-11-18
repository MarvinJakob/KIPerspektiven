// @vitest-environment happy-dom
import type { TFunction } from 'i18next';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import css from '../styles.css?raw';
import vcCss from './VibeCoding.css?raw';
import { softwareDevelopment } from '../i18n/softwareDevelopment';
import { LangContext, type Lang } from '../lib/lang';
import { SoftwareDevelopment } from './SoftwareDevelopment';

// Anforderung #57: Verfügbaren Platz auf dem Desktop in allen Themenartikeln besser nutzen.
// Anforderung #66: Überschrift und Zitat in den Lesefluss integrieren (ersetzt REQ-57-AC2 für „Softwareentwicklung“).
// Unit-Ebene: Aufbau und Gestaltungsregeln. Fidelity im Browser: app/e2e/tests/57-themenartikel-breite.spec.ts und
// app/e2e/tests/66-softwareentwicklung-lesefluss.spec.ts.

function render(lang: Lang) {
  const t = ((key: string) => key) as unknown as TFunction;
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/${lang}/themen/softwareentwicklung`]}>
      <LangContext.Provider value={{ lang, t }}>
        <SoftwareDevelopment titleRef={null} />
      </LangContext.Provider>
    </MemoryRouter>,
  );
  return new DOMParser().parseFromString(html, 'text/html').querySelector('article')!;
}

/** Deklarationen der Regeln mit genau diesem Selektor; `media` wählt Regeln innerhalb der passenden Media Query. */
function declarations(source: string, selector: string, media?: string) {
  const scope = media ? [...source.matchAll(/@media\s*([^{]+)\{((?:[^{}]*\{[^}]*\})*)\s*\}/g)].filter((m) => m[1].trim() === media).map((m) => m[2]).join('\n') : source.replace(/@media[^{]+\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Object.fromEntries(
    [...scope.matchAll(new RegExp(`(?:^|[}\\s,])${escaped}\\s*\\{([^}]*)\\}`, 'gm'))].flatMap((m) =>
      m[1].split(';').map((d) => d.trim()).filter(Boolean).map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]),
    ),
  );
}

/** Erwartete Lesereihenfolge aus den Seitentexten, unabhängig vom Seitenaufbau. */
const readingOrder = (lang: Lang) => {
  const c = softwareDevelopment[lang];
  return [c.modernTitle, c.modern[0], c.relatedLabel, c.relatedTitle, c.modern[1], c.wayTitle, c.wayAuthor, c.way, c.teams, c.release, c.opinionTitle, c.opinionText, c.contact];
};

describe.each(['de', 'en'] as const)('Softwareentwicklung %s', (lang) => {
  const c = softwareDevelopment[lang];

  it('REQ-66-AC1: Zwischenüberschrift steht im Abschnitt direkt über dem Einleitungsabsatz', () => {
    const section = render(lang).querySelector('section[aria-labelledby="moderne-softwareentwicklung"]')!;
    const [heading, lead] = [...section.children];
    expect(heading.matches('h2#moderne-softwareentwicklung'), 'erstes Element des Abschnitts ist die Zwischenüberschrift').toBe(true);
    expect(heading.textContent).toBe(c.modernTitle);
    expect(lead.tagName, 'Einleitungsabsatz folgt unmittelbar auf die Überschrift').toBe('P');
    expect(lead.textContent).toBe(c.modern[0]);
  });

  it('REQ-66-AC2: Zitat mit Zuschreibung steht nach der Einleitung und unmittelbar vor dem Absatz „Der Weg“', () => {
    const article = render(lang);
    const quote = article.querySelector('#der-weg')!;
    expect(quote.textContent!.replace(/\s+/g, ' '), 'Zitat, dann Zuschreibung im selben Element').toContain(`${c.wayTitle}${c.wayAuthor}`);
    const paragraphs = [...article.querySelectorAll('p')];
    const intro = paragraphs.find((p) => p.textContent === c.modern[1])!;
    const way = paragraphs.find((p) => p.textContent === c.way)!;
    expect(intro.compareDocumentPosition(quote) & Node.DOCUMENT_POSITION_FOLLOWING, 'Zitat nach dem letzten Einleitungsabsatz').toBeTruthy();
    expect(quote.nextElementSibling, 'Absatz „Der Weg“ folgt unmittelbar auf das Zitat').toBe(way);
  });

  it('REQ-66-AC3: Artikelabschnitte haben keine eigene Titel- oder Lesespalte', () => {
    const article = render(lang);
    const sections = [...article.querySelectorAll(':scope > section:not(.opinion)')];
    // Moderne Softwareentwicklung, Der Weg, Drei Teams, Release Gate
    expect(sections.length).toBe(4);
    for (const section of sections) {
      const name = section.getAttribute('aria-labelledby') ?? section.id;
      expect(section.querySelectorAll(':scope > div').length, `${name}: keine Spaltencontainer`).toBe(0);
      for (const p of section.querySelectorAll('p')) expect(p.parentElement, `${name}: Absatz direkt im Abschnitt`).toBe(section);
      for (const cls of section.classList) {
        const rule = declarations(css, `.${cls}`);
        expect(rule['grid-template-columns'], `${name}: .${cls} ohne Spaltenraster`).toBeUndefined();
        expect(rule['max-width'], `${name}: .${cls} ohne Breitenbegrenzung`).toBeUndefined();
      }
    }
    expect(article.querySelectorAll('section > figure.article-figure > img[alt]').length, 'beide Grafiken im Lesefluss').toBe(2);
  });

  it('REQ-57-AC4 / REQ-66-AC4: Inhalte behalten ihre Lesereihenfolge', () => {
    const text = (render(lang).textContent ?? '').replace(/\s+/g, ' ');
    let from = 0;
    for (const part of readingOrder(lang)) {
      const at = text.indexOf(part.replace(/\s+/g, ' '), from);
      expect(at, `„${part.slice(0, 40)}“ fehlt oder steht vor dem vorherigen Inhalt`).toBeGreaterThanOrEqual(from);
      from = at + 1;
    }
  });
});

describe('REQ-57-AC1 / REQ-66-AC3: Gestaltungsregeln der Themenartikel', () => {
  it('der Artikel nutzt den vollen Inhaltsrahmen statt einer 760-px-Spalte', () => {
    const layout = declarations(css, '.article-layout');
    expect(layout['grid-template-columns'] ?? 'none').not.toMatch(/760px/);
    expect(layout['max-width'] ?? 'none').toBe('none');
  });

  it('Fließtext der Artikelabschnitte ist nicht auf eine Lesespalte begrenzt', () => {
    expect(declarations(css, '.article-body')['max-width']).toBeUndefined();
    expect(declarations(css, '.article-body p')['max-width']).toBeUndefined();
    expect(css, 'keine Regeln für Titel- und Lesespalte mehr').not.toMatch(/\.article-split/);
  });
});

describe('REQ-57-AC3: „Vibe Coding“ bleibt unverändert', () => {
  it('Raster, Abstand und Lesespalte entsprechen der Referenz vor der Änderung', () => {
    expect(declarations(vcCss, '.vc-split')).toMatchObject({ display: 'grid', 'grid-template-columns': 'minmax(0, 5fr) minmax(0, 7fr)', gap: '88px' });
    expect(declarations(vcCss, '.vc-body')).toMatchObject({ 'max-width': '680px' });
    expect(declarations(vcCss, '.vc-conclusion')).toMatchObject({ padding: '64px', gap: '72px' });
    expect(declarations(vcCss, '.vc-split', '(max-width: 850px)')).toMatchObject({ 'grid-template-columns': '1fr' });
  });
});
