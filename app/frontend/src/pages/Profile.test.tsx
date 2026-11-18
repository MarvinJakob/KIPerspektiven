// @vitest-environment happy-dom
import type { TFunction } from 'i18next';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import css from '../styles.css?raw';
import { LangContext, type Lang } from '../lib/lang';
import { Profile } from './Profile';

// Anforderung #63: Breadcrumb-Navigation von der Profilseite entfernen.
// Sollwert aus dem Ticket: Zeile „Startseite / Marvin Jakob“ (EN „Home / Marvin Jakob“) entfällt.
// Fidelity im Browser: app/e2e/tests/63-profil-ohne-breadcrumb.spec.ts.

function render(lang: Lang) {
  const t = ((key: string) => key) as unknown as TFunction;
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/${lang}/profil`]}>
      <LangContext.Provider value={{ lang, t }}>
        <Profile />
      </LangContext.Provider>
    </MemoryRouter>,
  );
  return new DOMParser().parseFromString(html, 'text/html').querySelector('article.profile')!;
}

/** Deklarationen außerhalb von Media Queries für genau diesen Selektor. */
function declarations(selector: string) {
  const scope = css.replace(/@media[^{]+\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...scope.matchAll(new RegExp(`(?:^|[}\\s,])${escaped}(?=[\\s,{])[^{]*\\{([^}]*)\\}`, 'gm'))].map((m) => m[1].trim());
}

describe.each(['de', 'en'] as const)('Profilseite %s', (lang) => {
  it('REQ-63-AC1: Profilinhalt beginnt mit der Profilvorstellung samt Überschrift', () => {
    const article = render(lang);
    const first = article.firstElementChild!;
    expect(first.matches('header.profile-hero'), `erstes Element ist ${first.tagName}.${first.className}`).toBe(true);
    expect(first.querySelector('h1')?.textContent).toBe('Marvin Jakob');
  });

  it('REQ-63-AC1: keine Breadcrumb-Zeile vor der Überschrift', () => {
    const article = render(lang);
    expect(article.querySelector('.crumbs, .profile-crumbs')).toBeNull();
    const h1 = article.querySelector('h1')!;
    const eyebrow = article.querySelector('.profile-hero .eyebrow')!.textContent!;
    const before = (article.textContent ?? '').split(h1.textContent!)[0];
    expect(before.trim(), 'vor der Überschrift steht nur die Rubrik der Vorstellung').toBe(eyebrow);
    expect(article.textContent).not.toMatch(/(Startseite|Home)\s*\/\s*Marvin Jakob/);
  });

  it('REQ-63-AC2: kein Navigationsbereich und kein Startseiten-Link im Profilinhalt', () => {
    const article = render(lang);
    expect(article.querySelector('nav, [role="navigation"]')).toBeNull();
    const homeLinks = [...article.querySelectorAll('a[href]')].filter((a) => a.getAttribute('href') === `/${lang}`);
    expect(homeLinks.map((a) => a.textContent)).toEqual([]);
  });
});

describe('Stile', () => {
  it('REQ-63-AC1: kein für die Breadcrumb-Zeile reservierter Abstand', () => {
    expect(declarations('.profile-crumbs')).toEqual([]);
  });

  it('REQ-63-AC3: gemeinsame Breadcrumb-Stile bleiben für andere Seiten erhalten', () => {
    expect(declarations('.crumbs').join(';')).toContain('display: flex');
    expect(declarations('.crumbs a').join(';')).toContain('min-height: 44px');
  });
});
