// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../i18n';
import { LangContext, type Lang } from '../lib/lang';
import { Blog } from './Blog';

// Fidelity-Tests zu REQ-75-AC1 und REQ-75-AC3 bis REQ-75-AC6 (Ticket #75) über die Blogübersicht mit
// simulierter API. Sollwerte und Texte stammen aus Ticket und Spezifikation, nicht aus dem Anwendungscode.

const TEXT = {
  de: { more: 'Weitere Beiträge laden', loading: 'Weitere Beiträge werden geladen …', error: 'Weitere Beiträge konnten nicht geladen werden.', retry: 'Erneut versuchen' },
  en: { more: 'Load more posts', loading: 'Loading more posts …', error: 'More posts could not be loaded.', retry: 'Try again' },
} as const;

const summary = (n: number) => ({
  slug: `beitrag-${n}`,
  lang: 'de',
  title: `Titel ${n}`,
  summary: `Kurztext ${n}`,
  publishedAt: new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString(),
  featured: false,
  topics: [],
  translations: ['de'],
});
/** Beiträge from, from-1, …, to (neueste zuerst). */
const range = (from: number, to: number) => Array.from({ length: from - to + 1 }, (_, i) => summary(from - i));

// --- IntersectionObserver: Tests lösen „Listenende erreicht“ gezielt aus ---------------------------------
class FakeObserver {
  static all = new Set<FakeObserver>();
  targets = new Set<Element>();
  constructor(private cb: IntersectionObserverCallback) {
    FakeObserver.all.add(this);
  }
  observe(el: Element) {
    this.targets.add(el);
  }
  unobserve(el: Element) {
    this.targets.delete(el);
  }
  disconnect() {
    this.targets.clear();
    FakeObserver.all.delete(this);
  }
  takeRecords() {
    return [];
  }
}
const observed = () => [...FakeObserver.all].flatMap((o) => [...o.targets].filter((t) => t.isConnected));
function reachEnd() {
  for (const o of [...FakeObserver.all]) {
    const entries = [...o.targets]
      .filter((t) => t.isConnected)
      .map((target) => ({ target, isIntersecting: true, intersectionRatio: 1 }) as unknown as IntersectionObserverEntry);
    if (entries.length) act(() => o['cb'](entries, o as unknown as IntersectionObserver));
  }
}

// --- simulierte API ---------------------------------------------------------------------------------------
type Reply = { status: number; body?: unknown } | Promise<{ status: number; body?: unknown }>;
let calls: URL[] = [];
let replies: Reply[] = [];
function deferred() {
  let resolve!: (r: { status: number; body?: unknown }) => void;
  const promise = new Promise<{ status: number; body?: unknown }>((r) => (resolve = r));
  return { promise, resolve };
}

let root: Root;
let host: HTMLElement;

beforeEach(() => {
  calls = [];
  replies = [];
  FakeObserver.all.clear();
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (req: Request) => {
      const url = new URL(req.url);
      calls.push(url);
      const next = replies.shift();
      if (!next) throw new Error(`unerwarteter Abruf ${url.search}`);
      const r = await next;
      return new Response(JSON.stringify(r.body ?? { message: 'Fehler' }), {
        status: r.status,
        headers: { 'Content-Type': 'application/json' },
      });
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

function render(lang: Lang) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  root = createRoot(host);
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[`/${lang}/blog`]}>
        <LangContext.Provider value={{ lang, t: i18n.getFixedT(lang) }}>
          <QueryClientProvider client={client}>
            <Blog />
          </QueryClientProvider>
        </LangContext.Provider>
      </MemoryRouter>,
    ),
  );
}

const links = () => [...host.querySelectorAll<HTMLAnchorElement>('a.post-row')].map((a) => a.getAttribute('href'));
const button = (label: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
const cursorOf = (u: URL) => u.searchParams.get('cursor');
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
const until = (fn: () => void) => vi.waitFor(fn, { timeout: 2000, interval: 5 });

describe.each(['de', 'en'] as const)('Blogübersicht %s', (lang) => {
  const T = TEXT[lang];

  it('REQ-75-AC1: Erstabruf ohne cursor zeigt die 20 neuesten mit Detail-Links, lädt ohne Listenende nichts nach', async () => {
    replies.push({ status: 200, body: { items: range(45, 26), nextCursor: 'c1' } });
    render(lang);
    await until(() => expect(links()).toHaveLength(20));
    expect(cursorOf(calls[0]), 'Erstabruf ohne cursor').toBeNull();
    expect(calls[0].searchParams.get('lang')).toBe(lang);
    expect(links()[0]).toBe(`/${lang}/blog/beitrag-45`);
    expect(links()[19]).toBe(`/${lang}/blog/beitrag-26`);
    await settle();
    expect(calls, 'kein Folgeabruf ohne Listenende').toHaveLength(1);
    expect(observed().length, 'Listenende wird beobachtet').toBeGreaterThan(0);
  });

  it('REQ-75-AC3: Listenende lädt die nächste Portion einmal, zeigt Ladestatus und hängt unten an', async () => {
    replies.push({ status: 200, body: { items: range(45, 26), nextCursor: 'c1' } });
    const second = deferred();
    replies.push(second.promise);
    render(lang);
    await until(() => expect(links()).toHaveLength(20));

    reachEnd();
    await until(() => expect(calls).toHaveLength(2));
    expect(cursorOf(calls[1])).toBe('c1');
    const status = host.querySelector('[role="status"]');
    expect(status?.textContent).toContain(T.loading);
    expect(links(), 'bisherige Beiträge bleiben während des Abrufs').toHaveLength(20);

    reachEnd();
    reachEnd();
    await settle();
    expect(calls, 'kein paralleler Abruf derselben Portion').toHaveLength(2);

    await act(async () => second.resolve({ status: 200, body: { items: range(25, 6), nextCursor: 'c2' } }));
    await until(() => expect(links()).toHaveLength(40));
    expect(links()[0]).toBe(`/${lang}/blog/beitrag-45`);
    expect(links()[20]).toBe(`/${lang}/blog/beitrag-25`);
    expect(host.querySelector('[role="status"]')?.textContent ?? '').not.toContain(T.loading);
  });

  it('REQ-75-AC4: nach der letzten Portion weder Beobachtung noch Schaltfläche noch weiterer Abruf', async () => {
    replies.push({ status: 200, body: { items: range(45, 26), nextCursor: 'c1' } });
    replies.push({ status: 200, body: { items: range(25, 6), nextCursor: 'c2' } });
    replies.push({ status: 200, body: { items: range(5, 1) } });
    render(lang);
    await until(() => expect(links()).toHaveLength(20));
    reachEnd();
    await until(() => expect(links()).toHaveLength(40));
    reachEnd();
    await until(() => expect(links()).toHaveLength(45));
    expect(cursorOf(calls[2])).toBe('c2');
    expect(button(T.more), 'keine Lade-Schaltfläche').toBeUndefined();
    expect(observed(), 'kein Beobachtungspunkt').toHaveLength(0);
    reachEnd();
    await settle();
    expect(calls).toHaveLength(3);
  });

  it('REQ-75-AC4: ohne Beiträge erscheint der Leerzustand ohne Folgeabruf', async () => {
    replies.push({ status: 200, body: { items: [] } });
    render(lang);
    await until(() => expect(host.textContent).toContain(i18n.getFixedT(lang)('empty.blogText')));
    reachEnd();
    await settle();
    expect(calls).toHaveLength(1);
    expect(button(T.more)).toBeUndefined();
  });

  it('REQ-75-AC5: Fehler beim Erstabruf zeigt Meldung mit erneutem Laden', async () => {
    replies.push({ status: 500 });
    replies.push({ status: 200, body: { items: range(3, 1) } });
    render(lang);
    await until(() => expect(host.querySelector('[role="alert"]')).not.toBeNull());
    const retry = button(T.retry);
    expect(retry).toBeDefined();
    act(() => retry!.click());
    await until(() => expect(links()).toHaveLength(3));
    expect(cursorOf(calls[1])).toBeNull();
  });

  it('REQ-75-AC5: Fehler beim Folgeabruf behält Beiträge, meldet am Listenende und lädt dieselbe Portion genau einmal', async () => {
    replies.push({ status: 200, body: { items: range(45, 26), nextCursor: 'c1' } });
    replies.push({ status: 500 });
    replies.push({ status: 200, body: { items: range(25, 6), nextCursor: 'c2' } });
    render(lang);
    await until(() => expect(links()).toHaveLength(20));
    reachEnd();
    await until(() => expect(host.querySelector('[role="alert"]')?.textContent).toContain(T.error));
    expect(links(), 'bisherige Beiträge bleiben').toHaveLength(20);
    const alert = host.querySelector('[role="alert"]')!;
    const list = host.querySelector('ul.post-list')!;
    expect(list.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING, 'Meldung steht nach der Liste').toBeTruthy();

    reachEnd();
    await settle();
    expect(calls, 'kein automatischer Abruf im Fehlerzustand').toHaveLength(2);

    const retry = [...alert.querySelectorAll('button')].find((b) => b.textContent?.trim() === T.retry);
    expect(retry, 'Erneut-versuchen-Schaltfläche in der Meldung').toBeDefined();
    act(() => retry!.click());
    await until(() => expect(links()).toHaveLength(40));
    expect(cursorOf(calls[2]), 'erneuter Versuch lädt dieselbe Portion').toBe('c1');
    expect(new Set(links()).size, 'jeder Beitrag genau einmal').toBe(40);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('REQ-75-AC6: Schaltfläche lädt per Tastatur, Status ist wahrnehmbar, automatisches Nachladen verschiebt den Fokus nicht', async () => {
    replies.push({ status: 200, body: { items: range(65, 46), nextCursor: 'c1' } });
    const second = deferred();
    replies.push(second.promise);
    replies.push({ status: 200, body: { items: range(25, 6), nextCursor: 'c3' } });
    render(lang);
    await until(() => expect(links()).toHaveLength(20));

    // Schaltfläche ist ein echtes, fokussierbares Bedienelement in der gewählten Sprache
    const more = button(T.more)!;
    expect(more, `Schaltfläche „${T.more}“`).toBeDefined();
    expect(more.getAttribute('type')).toBe('button');
    expect(more.tabIndex).toBe(0);
    more.focus();
    expect(document.activeElement).toBe(more);
    act(() => more.click());
    await until(() => expect(calls).toHaveLength(2));
    const status = host.querySelector('[role="status"]')!;
    expect(status.textContent).toContain(T.loading);
    expect(more.disabled || more.getAttribute('aria-disabled') === 'true', 'während des Abrufs deaktiviert').toBe(true);
    await act(async () => second.resolve({ status: 200, body: { items: range(45, 26), nextCursor: 'c2' } }));
    await until(() => expect(links()).toHaveLength(40));
    expect(document.activeElement?.getAttribute('href'), 'Fokus auf erstem neuen Beitrag').toBe(`/${lang}/blog/beitrag-45`);

    // Automatisches Nachladen: Fokus bleibt auf dem zuvor fokussierten Element
    const first = host.querySelector<HTMLAnchorElement>('a.post-row')!;
    first.focus();
    reachEnd();
    await until(() => expect(links()).toHaveLength(60));
    expect(document.activeElement).toBe(first);
  });
});
