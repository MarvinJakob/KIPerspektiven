// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../i18n';
import { LangContext, type Lang } from '../lib/lang';
import { MobileToc } from './MobileToc';

// Fidelity-Tests auf Komponentenebene zu REQ-98-AC1 bis REQ-98-AC6 (Ticket #98). Das Zusammenspiel mit echter
// Seitenhöhe und echtem Scrollen prüft app/e2e/tests/98-mobiles-inhaltsverzeichnis.spec.ts.

const TEXT = {
  de: { label: 'Inhaltsverzeichnis', current: 'aktueller Abschnitt' },
  en: { label: 'Contents', current: 'current section' },
} as const;

let host: HTMLDivElement;
let main: HTMLElement;
let root: Root;
let mobile = true;
const listeners = new Set<() => void>();

function setMobile(value: boolean) {
  mobile = value;
  act(() => listeners.forEach((l) => l()));
}

beforeEach(() => {
  mobile = true;
  listeners.clear();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === '(max-width: 650px)' ? mobile : false;
    },
    media: query,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  }));
  document.body.innerHTML = '';
  main = document.createElement('main');
  main.id = 'main';
  host = document.createElement('div');
  document.body.append(main, host);
});

afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

function render(lang: Lang, html: string, path = `/${lang}/blog/beitrag`) {
  main.innerHTML = html;
  root = createRoot(host);
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <LangContext.Provider value={{ lang, t: i18n.getFixedT(lang) }}>
          <MobileToc />
        </LangContext.Provider>
      </MemoryRouter>,
    ),
  );
}

const nav = () => host.querySelector('nav');
const toggle = () => host.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
const links = () => [...host.querySelectorAll<HTMLAnchorElement>('nav a')];
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 20))));

const TWO = '<h1>Titel</h1><h2>Vom Schreiben zum Prüfen</h2><p>Text</p><h2>Was gleich bleibt</h2><p>Text</p>';

describe.each(['de', 'en'] as const)('Mobiles Inhaltsverzeichnis %s', (lang) => {
  it('REQ-98-AC1/AC6: mobil erscheint eine beschriftete Navigation mit den Abschnitten in Seitenreihenfolge', async () => {
    render(lang, TWO);
    await settle();
    expect(nav()?.getAttribute('aria-label')).toBe(TEXT[lang].label);
    expect(links().map((a) => a.textContent)).toEqual(['Vom Schreiben zum Prüfen', 'Was gleich bleibt']);
    const ids = [...main.querySelectorAll('h2')].map((h) => `#${h.id}`);
    expect(links().map((a) => a.getAttribute('href'))).toEqual(ids);
    expect(toggle().textContent).toContain(TEXT[lang].label);
  });

  it('REQ-98-AC3: Aktivieren eines Eintrags fokussiert die Überschrift, markiert sie als aktuell und schließt die Liste', async () => {
    render(lang, TWO);
    await settle();
    const scrolled = vi.fn();
    const target = main.querySelectorAll('h2')[1];
    target.scrollIntoView = scrolled;
    act(() => toggle().click());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    act(() => links()[1].click());
    await settle();
    expect(scrolled).toHaveBeenCalled();
    expect(document.activeElement).toBe(target);
    expect(links()[1].getAttribute('aria-current')).toBe('location');
    expect(links()[0].hasAttribute('aria-current')).toBe(false);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().textContent, 'Leiste nennt den aktuellen Abschnitt').toContain('Was gleich bleibt');
  });

  it('REQ-98-AC2: der aktive Eintrag ist zusätzlich sichtbar ausgezeichnet, nicht nur über Farbe', async () => {
    render(lang, TWO);
    await settle();
    act(() => toggle().click());
    act(() => links()[0].click());
    await settle();
    const current = links()[0];
    expect(current.querySelector('.toc-marker'), 'Positionsmarke vor dem aktiven Eintrag').not.toBeNull();
    expect(current.textContent).toBe('Vom Schreiben zum Prüfen');
    expect(host.querySelector('.toc-rail .is-active'), 'hervorgehobene Marke in der Leiste').not.toBeNull();
    expect(host.querySelector('.toc-rail')?.getAttribute('aria-hidden')).toBe('true');
    expect(host.textContent).toContain(TEXT[lang].current);
  });

  it('REQ-98-AC4: über 650 CSS-Pixel wird nichts gerendert, auch nach Vergrößern aus der Mobilansicht', async () => {
    render(lang, TWO);
    await settle();
    expect(nav()).not.toBeNull();
    setMobile(false);
    await settle();
    expect(host.innerHTML).toBe('');
    setMobile(true);
    await settle();
    expect(nav(), 'erscheint beim Verkleinern wieder').not.toBeNull();
  });

  it('REQ-98-AC4: auf dem Desktop geladen erscheint kein Inhaltsverzeichnis', async () => {
    mobile = false;
    render(lang, TWO);
    await settle();
    expect(host.innerHTML).toBe('');
  });

  it.each([
    ['ohne Abschnitt', '<h1>Titel</h1><p>Text</p>'],
    ['mit einem Abschnitt', '<h1>Titel</h1><h2>Einziger Abschnitt</h2><p>Text</p>'],
  ])('REQ-98-AC5: %s erscheint kein Inhaltsverzeichnis', async (_, html) => {
    render(lang, html);
    await settle();
    expect(host.innerHTML).toBe('');
  });

  it('REQ-98-AC5: erscheint, sobald nachgeladene Inhalte den zweiten Abschnitt ergänzen', async () => {
    render(lang, '<h2>Erster</h2>');
    await settle();
    expect(nav()).toBeNull();
    act(() => main.insertAdjacentHTML('beforeend', '<h2>Zweiter</h2>'));
    await settle();
    expect(links().map((a) => a.textContent)).toEqual(['Erster', 'Zweiter']);
  });

  it('REQ-98-AC1: außerhalb des Geltungsbereichs erscheint kein Inhaltsverzeichnis', async () => {
    render(lang, TWO, `/${lang}/blog`);
    await settle();
    expect(host.innerHTML).toBe('');
  });

  it('Escape schließt die geöffnete Liste und gibt den Fokus an die Leiste zurück', async () => {
    render(lang, TWO);
    await settle();
    act(() => toggle().click());
    links()[0].focus();
    act(() => links()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle());
  });
});
