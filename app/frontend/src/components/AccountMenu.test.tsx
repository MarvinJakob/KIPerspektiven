// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../i18n';
import { de } from '../i18n/de';
import { en } from '../i18n/en';
import { LangContext, type Lang } from '../lib/lang';
import { AccountMenu } from './AccountMenu';

// Tests auf Komponentenebene zu REQ-121-AC1, -AC3, -AC4, -AC6, -AC7, -AC8 und -AC9 (Ticket #121).
// Sollwerte und Texte stammen aus der Tabelle „Aufbau des Menüs“ und den Akzeptanzkriterien im Ticket.
// Lage und Fläche, das Zusammenspiel mit Themen- und Hauptmenü sowie den Weg über die Anmeldeseite mit echtem
// Backend prüft app/e2e/tests/121-kontomenue.spec.ts.
//
// Ticket #130 streicht Hinweis und Trennlinie aus der Vorlage (REQ-130-AC1 bis -AC4). Der Hinweis entfällt damit in
// REQ-121-AC1 und -AC7 sowie als Beschreibung des Eintrags in REQ-121-AC6.

const TEXT = {
  de: {
    account: 'Anmeldung für die Redaktion',
    label: 'Redaktion',
    title: 'Anmelden',
    desc: 'Zur Anmeldeseite der Redaktion',
  },
  en: {
    account: 'Sign in for editors',
    label: 'Editorial team',
    title: 'Sign in',
    desc: 'Go to the editorial sign-in page',
  },
} as const;

/** Mit #130 entfallener Hinweis, wörtlich aus dem Ticket. Er darf in keiner Sprache mehr im Menü stehen. */
const REMOVED_NOTES = [
  'Der Zugang ist Mitgliedern der Redaktion vorbehalten. Konten richtet die Administration ein.',
  'Access is reserved for members of the editorial team. Accounts are set up by the administrators.',
] as const;

let root: Root;
let host: HTMLElement;
let outside: HTMLButtonElement;
let fetched: ReturnType<typeof vi.fn>;
let onOpen: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  fetched = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetched);
  onOpen = vi.fn<() => void>();
  host = document.createElement('div');
  outside = document.createElement('button');
  document.body.append(host, outside);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  outside.remove();
  vi.unstubAllGlobals();
});

function render(lang: Lang) {
  root = createRoot(host);
  act(() =>
    root.render(
      <LangContext.Provider value={{ lang, t: i18n.getFixedT(lang) }}>
        <AccountMenu onOpen={onOpen} />
      </LangContext.Provider>,
    ),
  );
}

const until = (fn: () => void) => vi.waitFor(fn, { timeout: 2000, interval: 5 });
const account = () => host.querySelector<HTMLButtonElement>('button')!;
const menu = () => document.getElementById(account().getAttribute('aria-controls') ?? '')!;
const link = () => menu().querySelector<HTMLAnchorElement>('a')!;
const isOpen = () => account().getAttribute('aria-expanded') === 'true';
/** `detail` 1 entspricht einem Mausklick, 0 der Aktivierung per Enter oder Leertaste. */
const activate = (detail: 0 | 1) =>
  act(() => void account().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail })));

describe.each(['de', 'en'] as const)('Kontomenü am Kontosymbol (%s)', (lang) => {
  const T = TEXT[lang];

  it('REQ-130-AC1 REQ-121-AC1 REQ-121-AC7: Aktivieren öffnet das Menü mit genau Kennzeile, „Anmelden“ und Zeile darunter; der Hinweis fehlt auch im Markup', () => {
    render(lang);
    expect(account().getAttribute('aria-label'), 'Beschriftung des Kontosymbols').toBe(T.account);
    expect(isOpen(), 'anfangs geschlossen').toBe(false);

    activate(1);
    expect(isOpen()).toBe(true);
    expect(menu().classList.contains('is-open'), 'Menüfläche ist eingeblendet').toBe(true);
    const text = menu().textContent ?? '';
    const positions = [T.label, T.title, T.desc].map((part) => text.indexOf(part));
    expect(positions.every((p) => p >= 0), `alle Texte vorhanden in „${text}“`).toBe(true);
    expect(positions, 'Reihenfolge der Vorlage').toEqual([...positions].sort((a, b) => a - b));
    expect(text.replace(/\s+/g, ''), 'keine weiteren Texte oder Einträge').toBe(
      [T.label, T.title, T.desc].join('').replace(/\s+/g, ''),
    );
    for (const note of REMOVED_NOTES) expect(menu().innerHTML, 'Hinweis steht nicht mehr im Markup des Menüs').not.toContain(note);
    expect(menu().querySelectorAll('a, button'), 'genau ein Eintrag').toHaveLength(1);
    expect(fetched, 'Öffnen fragt keine Sitzung ab und sendet nichts').not.toHaveBeenCalled();
  });

  it('REQ-121-AC4 REQ-121-AC9: „Anmelden“ ist ein Link zur Anmeldeseite im selben Tab; es gibt keinen Dialog und keine Eingabefelder', () => {
    render(lang);
    activate(1);
    expect(link().getAttribute('href')).toBe('/redaktion/anmelden');
    expect(link().hasAttribute('target'), 'öffnet im selben Tab').toBe(false);
    expect(link().textContent).toContain(T.title);
    expect(host.querySelector('dialog, [role="dialog"], input, form'), 'kein Anmeldedialog').toBeNull();
    expect(account().getAttribute('aria-haspopup'), 'kündigt keinen Dialog an').not.toBe('dialog');
  });

  it('REQ-130-AC2: nach dem Eintrag „Anmelden“ folgt kein weiteres Element und keine Trennlinie', () => {
    render(lang);
    activate(1);
    expect(menu().lastElementChild, 'der Eintrag ist das letzte Element der Fläche').toBe(link());
    expect(menu().querySelector('hr, .account-note'), 'weder Trennlinie noch Hinweisabsatz').toBeNull();
    expect([...menu().children].map((el) => el.tagName), 'genau Kennzeile und Eintrag').toEqual(['P', 'A']);
  });

  it('REQ-130-AC3 REQ-121-AC6: Button mit aria-expanded und aria-controls; der Eintrag verweist auf keine Beschreibung und nennt „Anmelden“ samt Zeile darunter', () => {
    render(lang);
    expect(account().tagName).toBe('BUTTON');
    expect(account().getAttribute('type')).toBe('button');
    expect(account().getAttribute('aria-expanded')).toBe('false');
    expect(menu(), 'aria-controls verweist auf das Menü').not.toBeNull();
    expect(link().hasAttribute('aria-describedby'), 'kein Verweis auf eine Beschreibung').toBe(false);
    expect(link().hasAttribute('aria-label'), 'der Name ergibt sich aus dem sichtbaren Text').toBe(false);
    const name = link().textContent ?? '';
    expect(name).toContain(T.title);
    expect(name).toContain(T.desc);
  });
});

describe('Kontomenü: Texte', () => {
  it('REQ-130-AC1: die Texte des Kontomenüs enthalten in keiner Sprache mehr einen Hinweis', () => {
    for (const messages of [de, en]) {
      expect(Object.keys(messages.account).sort(), 'nur Kennzeile, Eintrag und Zeile darunter').toEqual(['desc', 'label', 'title']);
      for (const note of REMOVED_NOTES) expect(Object.values(messages.account)).not.toContain(note);
    }
  });
});

describe('Kontomenü: Bedienung', () => {
  it('REQ-121-AC6: per Tastatur geöffnet liegt der Fokus auf „Anmelden“, per Maus bleibt er auf dem Kontosymbol', async () => {
    render('de');
    account().focus();
    activate(1);
    await new Promise((r) => setTimeout(r, 40));
    expect(document.activeElement, 'Mausklick verschiebt den Fokus nicht').toBe(account());
    activate(1);
    expect(isOpen()).toBe(false);

    activate(0);
    await until(() => expect(document.activeElement).toBe(link()));
  });

  it('REQ-121-AC3: erneutes Aktivieren des Kontosymbols schließt das Menü', () => {
    render('de');
    activate(1);
    activate(1);
    expect(isOpen()).toBe(false);
    expect(menu().classList.contains('is-open')).toBe(false);
  });

  it('REQ-121-AC3: Klick außerhalb schließt das Menü, Klick im Menü auf die Kennzeile nicht', () => {
    render('de');
    activate(1);
    act(() => void menu().querySelector('p')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(isOpen(), 'Klick im Menü lässt es offen').toBe(true);
    act(() => void outside.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(isOpen()).toBe(false);
  });

  it('REQ-121-AC3: Esc schließt das Menü und setzt den Fokus auf das Kontosymbol', async () => {
    render('de');
    activate(0);
    await until(() => expect(document.activeElement).toBe(link()));
    act(() => void link().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(account());
  });

  it('REQ-121-AC3: verlässt der Fokus das Menü, schließt es', async () => {
    render('de');
    activate(0);
    await until(() => expect(document.activeElement).toBe(link()));
    act(() => void link().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside })));
    expect(isOpen()).toBe(false);
  });

  it('REQ-121-AC8: beim Öffnen meldet das Kontomenü der Kopfzeile, dass andere Menüs schließen sollen; beim Schließen nicht', () => {
    render('de');
    activate(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    activate(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
