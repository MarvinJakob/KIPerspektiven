// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../i18n';
import { LangContext, type Lang } from '../lib/lang';
import { Home } from './Home';

// Unit-Tests zu Ticket #131 (REQ-131-AC1 bis REQ-131-AC4): Aufbau des Einstiegs der Startseite.
// Sollwerte stammen aus dem Ticket: Beschriftung je Sprache, genau eine Schaltfläche, primäre Darstellung
// mit Pfeilsymbol, Ziel ist die Seite „KI Readiness“ (/<sprache>/themen/ai-audit wie in der Hauptnavigation).

const SOLL = {
  de: { label: 'KI Readiness einschätzen', removed: 'Themen entdecken', target: '/de/themen/ai-audit' },
  en: { label: 'Assess your AI readiness', removed: 'Explore topics', target: '/en/themen/ai-audit' },
} as const;

let root: Root;
let host: HTMLElement;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
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
      <MemoryRouter initialEntries={[`/${lang}`]}>
        <LangContext.Provider value={{ lang, t: i18n.getFixedT(lang) }}>
          <QueryClientProvider client={client}>
            <Home />
          </QueryClientProvider>
        </LangContext.Provider>
      </MemoryRouter>,
    ),
  );
}

/** Alle Schaltflächen und Links im Einstieg (Abschnitt mit der H1). */
const heroActions = () => [...host.querySelectorAll<HTMLElement>('.home-hero a, .home-hero button')];

describe.each(['de', 'en'] as const)('Einstieg der Startseite %s', (lang) => {
  const S = SOLL[lang];

  it('REQ-131-AC1: der Einstieg enthält keinen Themenlink', () => {
    render(lang);
    const labels = heroActions().map((el) => el.textContent?.trim());
    expect(labels, `keine Schaltfläche „${S.removed}“`).not.toContain(S.removed);
    expect(host.querySelector('.home-hero')?.textContent ?? '').not.toContain(S.removed);
  });

  it('REQ-131-AC2: genau eine Schaltfläche mit der Beschriftung der Sprache', () => {
    render(lang);
    expect(heroActions().map((el) => el.textContent?.trim())).toEqual([S.label]);
  });

  it('REQ-131-AC3: die Schaltfläche ist der Primärbutton mit Pfeilsymbol und Druckzustand', () => {
    render(lang);
    const cta = heroActions().find((el) => el.textContent?.trim() === S.label)!;
    expect([...cta.classList], 'primäre Darstellung').toEqual(expect.arrayContaining(['btn', 'btn-primary', 'press']));
    expect(cta.classList.contains('btn-secondary'), 'nicht mehr grau').toBe(false);
    expect(cta.querySelectorAll('svg'), 'Pfeilsymbol').toHaveLength(1);
  });

  it('REQ-131-AC4: die Schaltfläche ist ein Link zur Seite „KI Readiness“ der Sprache statt einer Sprungmarke', () => {
    render(lang);
    const cta = heroActions().find((el) => el.textContent?.trim() === S.label)!;
    expect(cta.tagName).toBe('A');
    expect(cta.getAttribute('href')).toBe(S.target);
  });
});
