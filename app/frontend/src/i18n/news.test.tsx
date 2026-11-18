// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { EmptyPosts } from '../components/Status';
import { footerPages } from '../components/footer';
import { LangContext, type Lang } from '../lib/lang';
import { de } from './de';
import { en } from './en';
import { i18n } from './index';

// Anforderung #76: Öffentlichen Blog in „News“ umbenennen.
// Sollwerte aus Ticket #76 („Zurück zu News“ bzw. „Back to News“); Fidelity-Tests: app/e2e/tests/76-news.spec.ts.
const SOLL = {
  de: { name: 'News', back: 'Zurück zu News', cta: 'Zu News' },
  en: { name: 'News', back: 'Back to News', cta: 'Go to News' },
} as const;

/** Alle Texte eines Sprachpakets mit ihrem Schlüsselpfad. */
function entries(obj: object, prefix = ''): [string, string][] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [[`${prefix}${k}`, v] as [string, string]] : entries(v as object, `${prefix}${k}.`),
  );
}

describe.each(['de', 'en'] as const)('News statt Blog (%s)', (lang) => {
  const t = i18n.getFixedT(lang);
  const soll = SOLL[lang];

  it('REQ-76-AC1: Hauptnavigation nennt die Beitragsübersicht „News“', () => {
    expect(t('nav.blog')).toBe(soll.name);
  });

  it('REQ-76-AC2: Fußzeilenlink heißt „News“ und führt zur Übersicht derselben Sprache', () => {
    expect(footerPages(lang, t)[0]).toEqual({ label: soll.name, to: `/${lang}/blog` });
  });

  it('REQ-76-AC2: Rücklink im Beitrag nennt „News“', () => {
    expect(t('backToBlog')).toBe(soll.back);
  });

  it('REQ-76-AC2: Leerzustand der Themenseite verlinkt mit „News“ auf die Übersicht', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[`/${lang}/themen/x`]}>
        <LangContext.Provider value={{ lang: lang as Lang, t }}>
          <EmptyPosts text={t('empty.topicText')} />
        </LangContext.Provider>
      </MemoryRouter>,
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const link = doc.querySelector('a')!;
    expect(link.getAttribute('href')).toBe(`/${lang}/blog`);
    expect(link.textContent?.trim()).toBe(soll.cta);
    expect(doc.body.textContent).toContain('News');
  });

  it('REQ-76-AC3: Hauptüberschrift und Seitenname der Übersicht lauten „News“', () => {
    expect(t('blog.title')).toBe(soll.name);
  });

  it('REQ-76-AC1–AC3: kein öffentlicher Text bezeichnet das Angebot noch als „Blog“', () => {
    const hits = entries(lang === 'de' ? de : en).filter(([, v]) => /\bblog\b/i.test(v));
    expect(hits, 'Texte mit „Blog“').toEqual([]);
  });
});
