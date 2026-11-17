import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { TopicContent } from './components/TopicContent';
import type { TFunction } from 'i18next';
import { softwareDevelopment } from './i18n/softwareDevelopment';
import { LangContext } from './lib/lang';
import { getTopicContent } from './lib/topicContent';
import { softwareDevelopmentImages } from './pages/SoftwareDevelopment';
import { installFakeApi, renderApp } from './test/fakeApi';

beforeEach(() => { installFakeApi(); });

describe('Ticket #7: Themenseite Softwareentwicklung nach Mock', () => {
  it.each(['de', 'en'] as const)('zeigt auf /%s Hero, Artikel, Grafiken, Meinungsaufruf und weitere Themen in Mock-Reihenfolge', async (lang) => {
    const c = softwareDevelopment[lang];
    renderApp(`/${lang}/themen/softwareentwicklung`);
    const title = await screen.findByRole('heading', { level: 1 });
    expect(title.textContent?.replace(/­/g, '')).toBe(lang === 'de' ? 'KI in der Softwareentwicklung' : 'AI in Software Development');

    const crumbs = screen.getByRole('navigation', { name: c.breadcrumbLabel });
    expect(within(crumbs).getByRole('link', { name: c.topics })).toHaveAttribute('href', `/${lang}#themen`);
    expect(crumbs).toHaveTextContent(c.current);
    expect(screen.getByText(c.author)).toBeInTheDocument();
    expect(screen.getByText(c.updated)).toBeInTheDocument();
    expect(screen.getByText(c.readingTime)).toBeInTheDocument();

    const article = screen.getByRole('article');
    expect(within(article).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      c.modernTitle, `“${c.wayTitle}${c.wayAuthor}`, c.opinionTitle,
    ]);
    // Abschnittsfolge: Text, Verweis, Text, Zitat, Prozessgrafik, Teams, Release-Grafik, Release, Meinung.
    const blocks = [c.modern[0], c.relatedTitle, c.modern[1], c.way, c.processFigure.alt, c.teams, c.releaseFigure.alt, c.release, c.opinionText];
    const positions = blocks.map((text) => article.innerHTML.indexOf(text.replace(/&/g, '&amp;')));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);

    const [process, release] = within(article).getAllByRole('img');
    for (const [image, src, figure] of [[process, softwareDevelopmentImages[lang].process, c.processFigure], [release, softwareDevelopmentImages[lang].release, c.releaseFigure]] as const) {
      expect(image).toHaveAttribute('src', src);
      expect(image).toHaveAttribute('alt', figure.alt);
      const open = within(article).getByRole('link', { name: figure.open });
      expect(open).toHaveAttribute('href', src);
      expect(open).toHaveAttribute('target', '_blank');
      expect(open).toHaveAttribute('rel', 'noopener');
    }

    expect(within(article).getByRole('link', { name: new RegExp(c.relatedTitle) })).toHaveAttribute('href', `/${lang}/themen/vibe-coding`);
    expect(within(article).getByRole('link', { name: c.contact })).toHaveAttribute('href', `/${lang}/kontakt`);
    const more = screen.getByRole('region', { name: c.moreTitle });
    expect(within(more).getByRole('link', { name: new RegExp(c.more[0].title) })).toHaveAttribute('href', `/${lang}/themen/data-analytics`);
    expect(within(more).getByRole('link', { name: new RegExp(c.more[1].title) })).toHaveAttribute('href', `/${lang}/themen/modelle-und-kosten`);
    expect(within(more).getByRole('link', { name: c.allTopics })).toHaveAttribute('href', `/${lang}#themen`);
    // Der Mock zeigt weder die Einführung aus der Datenbank noch eine Beitragsliste.
    expect(screen.queryByRole('heading', { name: /Beiträge|Articles/ })).not.toBeInTheDocument();
  });

  it('enthält keine Platzhalter, Mock-Ziele oder Sie-Ansprache', async () => {
    for (const lang of ['de', 'en'] as const) {
      const { unmount } = renderApp(`/${lang}/themen/softwareentwicklung`);
      const main = await screen.findByRole('main');
      await screen.findByRole('article');
      for (const link of within(main).getAllByRole('link')) {
        expect(link.getAttribute('href')).toMatch(/^\/(?:de|en)(?:[/#]|$)|^\/assets\/|^data:image\/png|\.png$/);
        expect(link.getAttribute('href')).not.toMatch(/mock\/|\.md$|^#|javascript:/);
      }
      expect(main).not.toHaveTextContent(/hier Grafik|Link: Kontaktformular|Platzhalter|placeholder|Lokaler Designentwurf|Übersetzung|translation/i);
      if (lang === 'de') expect(main).not.toHaveTextContent(/\bIhnen\b|(?:erfahren|entwickeln|teilen|würden) Sie\b/);
      unmount();
    }
  });

  it('wechselt Artikel, Grafiken und Bedienelemente mit der Sprache und behält den Pfad', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/de/themen/softwareentwicklung');
    await screen.findByRole('article');
    await user.click(screen.getByRole('button', { name: 'English' }));
    await screen.findByRole('heading', { level: 1, name: 'AI in Software Development' });
    expect(router.state.location.pathname).toBe('/en/themen/softwareentwicklung');
    const article = screen.getByRole('article');
    expect(within(article).getByRole('heading', { name: 'Modern Software Development' })).toBeInTheDocument();
    expect(within(article).getAllByRole('img')[0]).toHaveAttribute('src', softwareDevelopmentImages.en.process);
    expect(screen.getByRole('main')).not.toHaveTextContent(/Moderne Softwareentwicklung|Zum Kontaktformular|Alle Themen/);
    await user.click(screen.getByRole('button', { name: 'Deutsch' }));
    await screen.findByRole('heading', { level: 2, name: 'Moderne Softwareentwicklung' });
    expect(within(screen.getByRole('article')).getAllByRole('img')[1]).toHaveAttribute('src', softwareDevelopmentImages.de.release);
  });

  it('übersetzt jeden Text vollständig ins Englische', () => {
    const shared = new Set(['author', 'wayAuthor', 'releaseLabel']);
    const flat = (value: unknown): string[] => (typeof value === 'string' ? [value] : Object.values(value as object).flatMap(flat));
    for (const key of Object.keys(softwareDevelopment.de) as (keyof typeof softwareDevelopment.de)[]) {
      const de = flat(softwareDevelopment.de[key]);
      const en = flat(softwareDevelopment.en[key]);
      expect(en, key).toHaveLength(de.length);
      expect(en.every((text) => text.trim().length > 0), key).toBe(true);
      if (!shared.has(key) && key !== 'more') expect(en, key).not.toEqual(de);
    }
  });

  it('hält für die Softwareentwicklung nur Metadaten als Markdown und lässt andere Themen unverändert', () => {
    expect(getTopicContent('softwareentwicklung', 'de')).toBeUndefined();
    expect(getTopicContent('softwareentwicklung', 'en')).toBeUndefined();
    expect(getTopicContent('data-analytics', 'de')?.body).toBeTruthy();
    expect(getTopicContent('ai-audit', 'de')).toBeUndefined();
    expect(getTopicContent('unbekannt', 'en')).toBeUndefined();
  });
});

// Bis Ticket #102 nutzte nur die entfernte Seite „KI-Tipps und Tricks“ Quellenbereiche; der gemeinsame Renderer behält sie.
it('löst Quellenbereiche in einzelne, erreichbare Verweise auf', () => {
  const body = 'Belegt [1–3] und [2].\n\n## Quellen\n\n1. Erste\n2. Zweite\n3. Dritte';
  render(
    <LangContext.Provider value={{ lang: 'de', t: ((key: string) => key) as unknown as TFunction }}>
      <TopicContent content={{ subtitle: undefined, body, lang: 'de' }} />
    </LangContext.Provider>,
  );
  const article = screen.getByRole('article');
  expect(within(article).getAllByRole('link').map((a) => a.textContent)).toEqual(['[1]', '[2]', '[3]', '[2]']);
  expect(within(article).getAllByRole('link', { name: '[3]' })[0]).toHaveAttribute('href', '#topic-source-3');
});
