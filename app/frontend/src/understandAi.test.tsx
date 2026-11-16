import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import source from '../../../content/topics/understanding/KI verstehen v2.md?raw';
import published from './content/features/ki-verstehen.de.md?raw';
import { topicImages } from './lib/topicImages';
import { understandAiBody, understandAiDescription } from './pages/UnderstandAi';
import { installFakeApi, renderApp } from './test/fakeApi';

beforeEach(() => { installFakeApi(); });

it('zeigt die vollständige Vorlage mit geordneten Überschriften, Leitsätzen und Quellen', async () => {
  expect(published).toBe(source);
  expect(understandAiBody).toBe(source.slice(source.indexOf('\n') + 1).trim());
  renderApp('/de/ki-verstehen');
  await screen.findByRole('heading', { level: 1, name: 'KI verstehen' });
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  const article = screen.getByRole('article');
  expect(article).toHaveAttribute('lang', 'de');
  expect(within(article).getAllByRole('heading').map((h) => h.textContent)).toEqual(
    [...source.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1].trim()),
  );
  expect(within(article).getAllByRole('heading', { level: 3 })).toHaveLength(5);
  expect(article.querySelectorAll('blockquote')).toHaveLength(2);
  expect(article).toHaveTextContent('„Vibe Coding ist der einfachste Weg, Slop zu erzeugen.“');
  expect(article).toHaveTextContent('„Humans should review ideas, not code.“');
  expect(article).toHaveTextContent('Neben der Umsetzung müssen auch Zweck, Annahmen und Auswirkungen beurteilt werden.');
  const expectedSources = [...source.matchAll(/(?<!!)\[[^\]]+\]\((https:[^)]+)\)/g)].map((m) => m[1]);
  expect(within(article).getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('https:')).map((a) => a.getAttribute('href'))).toEqual(expectedSources);
  expect(article.querySelector('details')).toBeNull();
  expect(document.title).toBe('KI verstehen · KI Perspektiven');
  expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', understandAiDescription);
});

it('zeigt die lokale Originalgrafik als zugänglichen Vollbildlink', async () => {
  renderApp('/de/ki-verstehen');
  const image = await screen.findByRole('img', { name: /^Aufbau eines KI-Agenten:/ });
  const asset = topicImages['../ressources/grafiken/Agent.png'];
  expect(image).toHaveAttribute('src', asset);
  const link = screen.getByRole('link', { name: /^Grafik in voller Größe öffnen/ });
  expect(link).toContainElement(image);
  expect(link).toHaveAttribute('href', asset);
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

it('öffnet den Startseitenlink per Tastatur und behält beim Sprachwechsel dieselbe Seite mit Sprachhinweis', async () => {
  const user = userEvent.setup();
  const { router } = renderApp('/de');
  const link = await screen.findByRole('link', { name: 'KI verstehen' });
  expect(link).toHaveAttribute('href', '/de/ki-verstehen');
  link.focus();
  await user.keyboard('{Enter}');
  await screen.findByRole('article');
  expect(router.state.location.pathname).toBe('/de/ki-verstehen');
  await user.click(screen.getByRole('button', { name: 'English' }));
  expect(router.state.location.pathname).toBe('/en/ki-verstehen');
  expect(screen.getByRole('article')).toHaveAttribute('lang', 'de');
  expect(screen.getByText(/This topic is not available in English/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Deutsch' }));
  expect(router.state.location.pathname).toBe('/de/ki-verstehen');
  expect(screen.queryByText(/This topic is not available/)).not.toBeInTheDocument();
});

it('unterstützt den direkten englischen Aufruf mit deutschem Fallback', async () => {
  renderApp('/en/ki-verstehen');
  await screen.findByRole('heading', { name: 'KI verstehen', level: 1 });
  expect(screen.getByText(/This topic is not available in English/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute('href', '/en');
});
