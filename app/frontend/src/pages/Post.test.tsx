// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../i18n';
import { LangContext } from '../lib/lang';
import { PostPage } from './Post';

// Anforderung #138, REQ-138-AC3 und REQ-138-AC4: Die Beitragsseite zeigt zwischen Kopf und Text nur dann ein Bild,
// wenn der Beitrag ein Titelbild hat. Beitragsseite mit simulierter API; Breiten und Abstände prüft der
// Fidelity-Test app/e2e/tests/138-news-desktop-layout.spec.ts im Browser.
const cover = { src: '/media/abc-960.jpg', srcset: '/media/abc-480.jpg 480w, /media/abc-960.jpg 960w', width: 960, height: 720, alt: 'Stadion von oben' };
const post = (extra: object = {}) => ({
  slug: 'heimspiel',
  lang: 'de',
  title: 'Anpfiff für KI-Agenten',
  summary: 'Kurztext',
  publishedAt: '2026-11-24T08:00:00Z',
  featured: false,
  topics: [],
  translations: ['de'],
  readingMinutes: 3,
  bodyMarkdown: 'Erster Absatz des Beitrags.\n\nZweiter Absatz.',
  author: { name: 'Erika Muster', avatar: { src: '/media/avatar-480.jpg', width: 480, height: 480 } },
  ...extra,
});

let root: Root;
let host: HTMLElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function open(body: object) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  root = createRoot(host);
  act(() =>
    root.render(
      <MemoryRouter initialEntries={['/de/blog/heimspiel']}>
        <LangContext.Provider value={{ lang: 'de', t: i18n.getFixedT('de') }}>
          <QueryClientProvider client={client}>
            <Routes>
              <Route path="/:lang/blog/:slug" element={<PostPage />} />
            </Routes>
          </QueryClientProvider>
        </LangContext.Provider>
      </MemoryRouter>,
    ),
  );
  await vi.waitFor(() => expect(host.querySelector('h1')?.textContent).toBe('Anpfiff für KI-Agenten'), { timeout: 2000, interval: 5 });
  const article = host.querySelector('article')!;
  const header = article.querySelector('header')!;
  const text = [...article.querySelectorAll('p')].find((p) => p.textContent === 'Erster Absatz des Beitrags.')!;
  /** Elemente, die im Dokument nach dem Kopf und vor dem Beitragstext stehen. */
  const between = (selector: string) =>
    [...article.querySelectorAll(selector)].filter(
      (el) =>
        !header.contains(el) &&
        header.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING &&
        el.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  return { article, header, text, between };
}

describe('Beitragsseite', () => {
  it('REQ-138-AC4: ohne Titelbild steht zwischen Kopf und Text weder Bild noch Platzhaltergrafik', async () => {
    const { article, header, between } = await open(post());
    expect(between('img'), 'kein Bild zwischen Kopf und Text').toHaveLength(0);
    expect(between('svg'), 'keine Platzhaltergrafik zwischen Kopf und Text').toHaveLength(0);
    expect(between('[aria-hidden="true"]'), 'keine dekorative Bildfläche zwischen Kopf und Text').toHaveLength(0);
    // Das Autorenbild im Kopf ist kein Titelbild und bleibt erhalten.
    expect([...article.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual(['/media/avatar-480.jpg']);
    expect(header.textContent).toContain('Erika Muster');
  });

  it('REQ-138-AC3: mit Titelbild steht das Bild mit Alternativtext zwischen Kopf und Text', async () => {
    const { between } = await open(post({ cover }));
    const images = between('img');
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toBe('/media/abc-960.jpg');
    expect(images[0].getAttribute('alt')).toBe('Stadion von oben');
    expect(between('svg'), 'keine Platzhaltergrafik neben dem Titelbild').toHaveLength(0);
  });
});
