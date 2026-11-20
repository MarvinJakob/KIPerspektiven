// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../i18n';
import { LangContext, type Lang } from '../lib/lang';
import STYLES from '../styles.css?raw';
import { Home } from './Home';

// Unit-Tests zu Ticket #132: Der Pfeil eines Themenblocks öffnet den Artikel.
// Sollwerte stammen aus dem Ticket: Ziele `/themen/<slug>` und `/themenartikel/<id>` je Sprache (AC1, AC2, AC4),
// genau ein Link je Block (AC5). Der Pfeil bleibt Schmuck; den Klick erhält die Klickfläche des Links.

const ARTICLE = { id: 4711, title: 'Redaktioneller Themenartikel', subtitle: 'Unterzeile' };
const SLUGS = ['softwareentwicklung', 'vibe-coding'] as const;

let root: Root;
let host: HTMLElement;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (req: Request) => {
      const url = new URL(req.url);
      if (url.pathname !== '/api/articles') throw new Error(`unerwarteter Abruf ${url.pathname}`);
      return new Response(JSON.stringify({ items: [ARTICLE] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function render(lang: Lang) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  root = createRoot(host);
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[`/${lang}`]}>
        <LangContext.Provider value={{ lang, t: i18n.getFixedT(lang) }}>
          <QueryClientProvider client={client}>
            <Home />
          </QueryClientProvider>
        </LangContext.Provider>
      </MemoryRouter>,
    ),
  );
  // Zwei feste Themen plus der redaktionelle Themenartikel aus der simulierten API
  await vi.waitFor(() => expect(rows()).toHaveLength(3), { timeout: 2000, interval: 5 });
}

const rows = () => [...host.querySelectorAll<HTMLLIElement>('#themen-liste > li')];

describe.each(['de', 'en'] as const)('Themenliste der Startseite %s', (lang) => {
  it('REQ-132-AC1 REQ-132-AC2 REQ-132-AC4: jeder Block mit Pfeil führt zum Artikel in der Sprache der Seite', async () => {
    await render(lang);
    const targets = rows().map((li) => li.querySelector('a')?.getAttribute('href'));
    expect(targets).toEqual([...SLUGS.map((slug) => `/${lang}/themen/${slug}`), `/${lang}/themenartikel/${ARTICLE.id}`]);
    for (const li of rows()) expect(li.querySelector('.home-topic-go'), 'Block zeigt einen Pfeil').not.toBeNull();
  });

  it('REQ-132-AC5: je Block genau ein Link; der Pfeil ist weder Link noch Fokusstopp und für Screenreader verborgen', async () => {
    await render(lang);
    for (const li of rows()) {
      expect(li.querySelectorAll('a, button, [role="link"], [role="button"], [tabindex]'), 'genau ein bedienbares Element').toHaveLength(1);
      const arrow = li.querySelector('.home-topic-go')!;
      expect(arrow.getAttribute('aria-hidden')).toBe('true');
      expect(arrow.closest('a'), 'Pfeil liegt nicht in einem Link').toBeNull();
      expect(arrow.querySelector('a, button, [role], [tabindex]'), 'Pfeil enthält kein bedienbares Element').toBeNull();
    }
  });
});

/** Deklarationen aller Regeln, deren Selektorliste genau diesen Selektor enthält (ohne Kommentare, in Dateireihenfolge). */
function declarations(selector: string): string[] {
  const css = STYLES.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(',').some((s) => s.trim() === selector))
    .flatMap((m) => m[2].split(';').map((d) => d.trim().replace(/\s+/g, ' ')).filter(Boolean));
}

describe('Gestaltungsregeln der Themenliste', () => {
  it('REQ-132-AC1 REQ-132-AC3: der Pfeil fängt keine Zeigerereignisse ab, Klick und Link-Zeiger gehören der Klickfläche des Links', () => {
    expect(declarations('.home-topic-go')).toContain('pointer-events: none');
    expect(declarations('.home-topic-link::after'), 'Klickfläche des Links spannt den ganzen Block auf').toEqual(
      expect.arrayContaining(['position: absolute', 'inset: 0']),
    );
  });

  it('REQ-132-AC3: der hervorgehobene Zustand des Pfeils hängt am Hover des Blocks, nicht am Pfeil selbst', () => {
    expect(declarations('.home-topics li:hover .home-topic-go')).toContain('background: var(--brand)');
  });
});
