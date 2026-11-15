import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import source from '../../../content/KI in der Softwareentwicklung v2.md?raw';
import { TopicContent } from './components/TopicContent';
import type { TFunction } from 'i18next';
import { LangContext } from './lib/lang';
import { getTopicContent } from './lib/topicContent';
import { topicImages } from './lib/topicImages';
import { installFakeApi, renderApp } from './test/fakeApi';

beforeEach(() => { installFakeApi(); });

describe('Ticket #146: Themenseite Softwareentwicklung', () => {
  it('übernimmt den vollständigen deutschen Textstand ohne zusätzliche alte Abschnitte', async () => {
    const body = getTopicContent('softwareentwicklung', 'de')!.body;
    expect(body).toBe(source.slice(source.indexOf('\n') + 1).trim());
    renderApp('/de/themen/softwareentwicklung');
    await screen.findByRole('heading', { level: 1, name: 'KI in der Softwareentwicklung' });
    const article = screen.getByRole('article');
    const expected = [...source.matchAll(/^## (.+)$/gm)].map((match) => match[1].trim());
    expect(within(article).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(expected);
    expect(screen.getByText('Mit KI entwickeln, Ergebnisse prüfen, Änderungen beherrschen')).toHaveClass('topic-subtitle');
    expect(within(article).getByRole('heading', { name: 'Tipps für sinnvolle Guardrails' })).toBeInTheDocument();
    expect(article).not.toHaveTextContent('Metadaten der Themenseite');
    expect(screen.getByRole('link', { name: /Neuester Beitrag/ })).toHaveAttribute('href', '/de/blog/neu');
    expect(screen.getByRole('link', { name: /Nur auf Deutsch erschienen/ })).toHaveAttribute('href', '/de/blog/nur-deutsch');
  });

  it.each(['de', 'en'] as const)('zeigt auf /%s fünf Schritte, sieben Tipps und genau die passende lokale Grafik ohne Quellen', async (lang) => {
    const content = getTopicContent('softwareentwicklung', lang)!;
    expect(content.lang).toBe(lang);
    renderApp('/' + lang + '/themen/softwareentwicklung');
    const article = await screen.findByRole('article');
    expect(article).toHaveAttribute('lang', lang);
    expect(within(article).getAllByRole('heading', { level: 2 })).toHaveLength(3);
    expect(within(article).getAllByRole('heading', { level: 3 })).toHaveLength(2);
    const [steps, tips] = within(article).getAllByRole('list');
    expect(steps.tagName).toBe('OL');
    expect(tips.tagName).toBe('UL');
    expect(within(steps).getAllByRole('listitem')).toHaveLength(5);
    expect(within(tips).getAllByRole('listitem')).toHaveLength(7);
    const images = within(article).getAllByRole('img');
    expect(images).toHaveLength(1);
    const src = topicImages['../ressources/grafiken/AgenticSWDevProcess_' + lang + '.png'];
    expect(images[0]).toHaveAttribute('src', src);
    expect(images[0]).toHaveAttribute('alt', lang === 'de'
      ? 'Drei Agententeams erstellen Tests, melden Fehler und liefern Korrekturen über eine Qualitätsprüfung in das gemeinsame Repository.'
      : 'Three teams of agents create tests, report errors and deliver fixes through a quality gate to the shared repository.');
    const links = within(article).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', src);
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0]).toHaveAccessibleName(lang === 'de' ? /Grafik in voller Größe öffnen/ : /Open full-size diagram/);
    expect(within(article).queryByRole('heading', { name: /^(Quellen|Sources)$/ })).not.toBeInTheDocument();
    expect(article).not.toHaveTextContent(/\[\d+(?:[–-]\d+)?\]|todo|not available in English/i);
    expect(article.querySelector('[id^="topic-source-"]')).toBeNull();
  });

  it('zeigt die vollständige englische Fassung und wechselt Artikel und Grafik mit der Sprache', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/de/themen/softwareentwicklung');
    await screen.findByRole('article');
    await user.click(screen.getByRole('button', { name: 'English' }));
    await screen.findByRole('heading', { level: 1, name: 'AI in Software Development' });
    const article = screen.getByRole('article');
    expect(router.state.location.pathname).toBe('/en/themen/softwareentwicklung');
    expect(article).toHaveAttribute('lang', 'en');
    expect(within(article).getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Developing software with AI', 'What could an AI development pipeline look like?', 'Guardrails',
      'Tips for useful guardrails', 'How do you handle the flood of AI changes and findings?',
    ]);
    expect(article).toHaveTextContent('mainly creates new queues.');
    expect(article).not.toHaveTextContent('Software entwickeln mit KI');
    expect(screen.getByText('Develop with AI, verify results, manage changes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Newest article/ })).toHaveAttribute('href', '/en/blog/neu');
    expect(within(article).getByRole('img')).toHaveAttribute('src', topicImages['../ressources/grafiken/AgenticSWDevProcess_en.png']);
    await user.click(screen.getByRole('button', { name: 'Deutsch' }));
    await screen.findByRole('heading', { level: 1, name: 'KI in der Softwareentwicklung' });
    expect(within(screen.getByRole('article')).getByRole('img')).toHaveAttribute('src', topicImages['../ressources/grafiken/AgenticSWDevProcess_de.png']);
  });

  it('lässt Themen ohne statischen Inhalt unverändert', () => {
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
