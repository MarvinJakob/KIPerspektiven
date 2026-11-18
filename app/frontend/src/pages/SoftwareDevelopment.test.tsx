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
// Unit-Ebene: Aufbau und Gestaltungsregeln. Fidelity im Browser: app/e2e/tests/57-themenartikel-breite.spec.ts.

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
  it('REQ-57-AC2: Abschnitte mit Titel trennen Titelspalte und Lesespalte', () => {
    const article = render(lang);
    for (const id of ['moderne-softwareentwicklung', 'der-weg']) {
      const section = article.querySelector(`section[aria-labelledby="${id}"]`)!;
      expect(section.classList.contains('article-split'), `${id}: zweispaltiger Abschnitt`).toBe(true);
      const [head, body] = [...section.children];
      expect(head.classList.contains('article-split-head') && head.querySelector(`h2#${id}`), `${id}: Titel in der Titelspalte`).toBeTruthy();
      expect(body.classList.contains('article-split-body'), `${id}: Lesespalte`).toBe(true);
      expect(head.querySelector('p'), `${id}: kein Fließtext in der Titelspalte`).toBeNull();
      expect(section.querySelectorAll('p').length, `${id}: Fließtext`).toBe(body.querySelectorAll('p').length);
    }
  });

  it('REQ-57-AC2: Abschnitte ohne Titel und beide Grafiken stehen in der Lesespalte', () => {
    const article = render(lang);
    for (const id of ['drei-teams', 'release-gate']) {
      const section = article.querySelector(`section#${id}`)!;
      expect(section.classList.contains('article-split'), id).toBe(true);
      expect([...section.children].map((e) => e.className), id).toEqual(['article-split-body']);
      expect(section.querySelectorAll('.article-split-body > figure.article-figure > img[alt]').length, `${id}: Grafik in der Lesespalte`).toBe(1);
    }
    expect(article.querySelectorAll('figure').length).toBe(2);
  });

  it('REQ-57-AC4: Inhalte behalten ihre Lesereihenfolge', () => {
    const text = (render(lang).textContent ?? '').replace(/\s+/g, ' ');
    let from = 0;
    for (const part of readingOrder(lang)) {
      const at = text.indexOf(part.replace(/\s+/g, ' '), from);
      expect(at, `„${part.slice(0, 40)}“ fehlt oder steht vor dem vorherigen Inhalt`).toBeGreaterThanOrEqual(from);
      from = at + 1;
    }
  });
});

describe('REQ-57-AC1/AC2: Gestaltungsregeln der Themenartikel', () => {
  it('der Artikel nutzt den vollen Inhaltsrahmen statt einer 760-px-Spalte', () => {
    const layout = declarations(css, '.article-layout');
    expect(layout['grid-template-columns'] ?? 'none').not.toMatch(/760px/);
    expect(layout['max-width'] ?? 'none').toBe('none');
  });

  it('Desktop: Titelspalte und Lesespalte im Verhältnis 5 : 7 wie „Vibe Coding“, Lesespalte höchstens 760 px', () => {
    const split = declarations(css, '.article-split');
    expect(split.display).toBe('grid');
    expect(split['grid-template-columns']).toBe(declarations(vcCss, '.vc-split')['grid-template-columns']);
    expect(split.gap).toBe(declarations(vcCss, '.vc-split').gap);
    const max = /^(\d+)px$/.exec(declarations(css, '.article-split-body')['max-width'] ?? '');
    expect(max, 'max-width der Lesespalte').not.toBeNull();
    expect(Number(max![1])).toBeLessThanOrEqual(760);
    expect(declarations(css, '.article-split-body')['grid-column']).toBe('2');
  });

  it('bis 850 px: eine Spalte in Dokumentreihenfolge', () => {
    const narrow = declarations(css, '.article-split', '(max-width: 850px)');
    expect(narrow['grid-template-columns']).toBe('1fr');
    expect(declarations(css, '.article-split-body', '(max-width: 850px)')['grid-column']).toBe('auto');
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
