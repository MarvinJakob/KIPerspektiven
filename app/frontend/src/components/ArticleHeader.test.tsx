// @vitest-environment happy-dom
import type { TFunction } from 'i18next';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import css from '../styles.css?raw';
import vcCss from '../pages/VibeCoding.css?raw';
import { softwareDevelopment } from '../i18n/softwareDevelopment';
import { vibeCoding } from '../i18n/vibeCoding';
import { LangContext, type Lang } from '../lib/lang';
import { SoftwareDevelopment } from '../pages/SoftwareDevelopment';
import { VibeCoding } from '../pages/VibeCoding';

// Anforderung #61: Titel aller Themenartikel vereinheitlichen und Brotkrumennavigation entfernen.
// Unit-Ebene: Aufbau des Artikelkopfs und gemeinsame Gestaltungsregeln.
// Fidelity im Browser: app/e2e/tests/61-artikelkopf.spec.ts.

const ARTICLES = {
  'vibe-coding': { Page: VibeCoding, subtitle: (lang: Lang) => vibeCoding[lang].subtitle },
  softwareentwicklung: { Page: SoftwareDevelopment, subtitle: () => undefined },
} as const;

function render(slug: keyof typeof ARTICLES, lang: Lang) {
  const t = ((key: string) => key) as unknown as TFunction;
  const { Page } = ARTICLES[slug];
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/${lang}/themen/${slug}`]}>
      <LangContext.Provider value={{ lang, t }}>
        <Page titleRef={null} />
      </LangContext.Provider>
    </MemoryRouter>,
  );
  return new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html').querySelector('main')!;
}

/** Deklarationen der Regeln mit genau diesem Selektor; `media` wählt Regeln innerhalb der passenden Media Query. */
function declarations(source: string, selector: string, media?: string) {
  const scope = media
    ? [...source.matchAll(/@media\s*([^{]+)\{((?:[^{}]*\{[^}]*\})*)\s*\}/g)].filter((m) => m[1].trim() === media).map((m) => m[2]).join('\n')
    : source.replace(/@media[^{]+\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Object.fromEntries(
    [...scope.matchAll(new RegExp(`(?:^|[}\\s,])${escaped}\\s*\\{([^}]*)\\}`, 'gm'))].flatMap((m) =>
      m[1].split(';').map((d) => d.trim()).filter(Boolean).map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]),
    ),
  );
}

describe.each(Object.keys(ARTICLES) as (keyof typeof ARTICLES)[])('Artikelkopf %s', (slug) => {
  describe.each(['de', 'en'] as const)('%s', (lang) => {
    it('REQ-61-AC1: genau ein Titel im gemeinsamen Artikelkopf', () => {
      const main = render(slug, lang);
      expect(main.querySelectorAll('h1')).toHaveLength(1);
      const head = main.querySelector('header.article-head');
      expect(head, 'gemeinsamer Artikelkopf').not.toBeNull();
      expect(head!.querySelector('h1'), 'Titel im Artikelkopf').not.toBeNull();
    });

    it('REQ-61-AC1: Reihenfolge Titel, vorhandener Untertitel, Autorenblock; keine Themenzeile', () => {
      const copy = render(slug, lang).querySelector('.article-head-copy')!;
      const subtitle = ARTICLES[slug].subtitle(lang);
      const kinds = [...copy.children].map((el) =>
        el.tagName === 'H1' ? 'title' : el.classList.contains('byline') ? 'byline' : el.classList.contains('article-subtitle') ? 'subtitle' : `other:${el.tagName}.${el.className}`,
      );
      expect(kinds).toEqual(subtitle ? ['title', 'subtitle', 'byline'] : ['title', 'byline']);
      if (subtitle) expect(copy.querySelector('.article-subtitle')!.textContent).toBe(subtitle);
      expect(copy.querySelector('.byline img'), 'Porträt').not.toBeNull();
      expect(copy.querySelector('.byline time'), 'Stand').not.toBeNull();
      const head = copy.closest('header')!;
      expect(head.querySelector('.topic-number, .eyebrow'), 'keine nummerierte Themenzeile').toBeNull();
    });

    it('REQ-61-AC2: keine Brotkrumennavigation', () => {
      const main = render(slug, lang);
      expect(main.querySelector('.crumbs, .article-crumbs, nav[aria-label]')).toBeNull();
      const before = (main.textContent ?? '').split(main.querySelector('h1')!.textContent!)[0];
      expect(before.trim(), 'kein Inhalt vor dem Titel').toBe('');
    });
  });
});

describe('REQ-61-AC1/AC3: gemeinsame Gestaltungsregeln des Artikelkopfs', () => {
  it('Titeltypografie entspricht der Vibe-Coding-Referenz (Stand 0bf4b0f)', () => {
    expect(declarations(css, '.article-head h1')).toMatchObject({
      'font-size': 'clamp(3.6rem, 8vw, 7rem)',
      'line-height': '1',
      'letter-spacing': '-.06em',
    });
    expect(declarations(css, '.article-head-copy')['text-align']).toBe('center');
  });

  it('eine einzige Quelle: keine abweichenden Titelregeln für einzelne Artikel', () => {
    expect(declarations(vcCss, '.vc-hero h1'), 'Vibe Coding ohne eigene Titelregel').toEqual({});
    expect(declarations(css, '.article-hero h1'), 'Softwareentwicklung ohne eigene Titelregel').toEqual({});
    for (const media of ['(max-width: 650px)', '(max-width: 850px)']) {
      expect(declarations(vcCss, '.vc-hero h1', media), media).toEqual({});
      expect(declarations(css, '.article-hero h1', media), media).toEqual({});
    }
  });

  it('Autorenblock mittig, Text darin linksbündig', () => {
    expect(declarations(css, '.article-head-copy .byline')).toMatchObject({ 'justify-content': 'center', 'text-align': 'left' });
  });

  it('schmale Ansichten: lange Wörter brechen innerhalb der Breite um', () => {
    const h1 = declarations(css, '.article-head h1');
    expect(h1['overflow-wrap']).toMatch(/break-word|anywhere/);
    expect(h1.hyphens).toBe('auto');
    expect(declarations(css, '.article-head h1', '(max-width: 650px)')['font-size'], 'eigene Größe für Mobil').toBeTruthy();
  });

  it('Brotkrumen-Stile der Themenartikel sind entfernt', () => {
    expect(declarations(css, '.article-crumbs')).toEqual({});
  });
});

// Kontrolle der Testdaten: Softwareentwicklung hat keinen Untertitel, Vibe Coding hat einen.
it('Testdaten: Untertitel nur bei Vibe Coding', () => {
  expect(vibeCoding.de.subtitle.length).toBeGreaterThan(10);
  expect('subtitle' in softwareDevelopment.de).toBe(false);
});
