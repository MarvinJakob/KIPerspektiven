// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../i18n';
import { editorial } from '../lib/editorialLogin';
import { LangContext, type Lang } from '../lib/lang';
import { AccountLogin } from './AccountLogin';

// Fidelity-Tests auf Komponentenebene zu REQ-109-AC1 bis REQ-109-AC3 (Ticket #109) mit simulierter API.
// Sollwerte und Texte stammen aus der Spezifikation im Ticket. Das Zusammenspiel mit echtem Backend, Sitzung,
// Weiterleitung und Bildschirmgrößen prüft app/e2e/tests/109-anmeldedialog.spec.ts.

const TEXT = {
  de: {
    account: 'Anmeldung für die Redaktion',
    title: 'Anmelden',
    email: 'E-Mail-Adresse',
    password: 'Passwort',
    close: 'Schließen',
    submit: 'Anmelden',
    missing: 'Bitte E-Mail-Adresse und Passwort eingeben.',
    invalid:
      'E-Mail-Adresse oder Passwort ist falsch, oder das Konto ist deaktiviert. Bitte Eingaben prüfen oder an die Administration wenden.',
    locked: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.',
    busy: 'Die Anmeldung ist gerade ausgelastet. Bitte in einigen Sekunden erneut versuchen.',
    unavailable: 'Die Anmeldung ist gerade nicht möglich. Bitte später erneut versuchen.',
  },
  en: {
    account: 'Sign in for editors',
    title: 'Sign in',
    email: 'Email address',
    password: 'Password',
    close: 'Close',
    submit: 'Sign in',
    missing: 'Please enter your email address and password.',
    invalid:
      'The email address or password is incorrect, or the account is deactivated. Please check your entries or contact the administrators.',
    locked: 'Too many failed attempts. Please try again in 15 minutes.',
    busy: 'Sign-in is busy at the moment. Please try again in a few seconds.',
    unavailable: 'Sign-in is not possible at the moment. Please try again later.',
  },
} as const;

const ME = { id: 7, email: 'redaktion@example.test', displayName: '', roles: ['editor'], csrfToken: 'csrf' };

// --- simulierte API ---------------------------------------------------------------------------------------
let sessionStatus = 401;
let loginStatus: number | 'offline' = 200;
let logins: unknown[] = [];
let sessionChecks = 0;

let root: Root;
let host: HTMLElement;
let opened: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sessionStatus = 401;
  loginStatus = 200;
  logins = [];
  sessionChecks = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request | string, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(new URL(input, 'http://localhost'), init);
      const { pathname } = new URL(req.url, 'http://localhost');
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
      if (pathname === '/api/auth/me') {
        sessionChecks++;
        return sessionStatus === 200 ? json(200, ME) : json(401, { message: 'Anmeldung erforderlich.' });
      }
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        logins.push(await req.json());
        if (loginStatus === 'offline') throw new TypeError('Failed to fetch');
        return loginStatus === 200 ? json(200, ME) : json(loginStatus, { message: 'Meldung des Backends' });
      }
      throw new Error(`unerwarteter Abruf ${req.method} ${pathname}`);
    }),
  );
  opened = vi.spyOn(editorial, 'open').mockImplementation(() => {});
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function render(lang: Lang) {
  root = createRoot(host);
  act(() =>
    root.render(
      <LangContext.Provider value={{ lang, t: i18n.getFixedT(lang) }}>
        <AccountLogin />
      </LangContext.Provider>,
    ),
  );
}

const until = (fn: () => void) => vi.waitFor(fn, { timeout: 2000, interval: 5 });
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 20))));
const account = () => host.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
const dialog = () => host.querySelector<HTMLDialogElement>('dialog');
const button = (label: string) => [...(dialog()?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.trim() === label);
const field = (label: string) => {
  const l = [...(dialog()?.querySelectorAll('label') ?? [])].find((e) => e.textContent?.trim() === label);
  return l ? (dialog()!.querySelector(`#${CSS.escape(l.htmlFor)}`) as HTMLInputElement | null) : null;
};
const alertText = () => dialog()?.querySelector('[role="alert"]')?.textContent?.trim() ?? '';

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function open() {
  act(() => account().click());
  await until(() => expect(dialog()?.open, 'Anmeldedialog ist geöffnet').toBe(true));
}

async function submit(lang: Lang, email: string, password: string) {
  const T = TEXT[lang];
  if (email) type(field(T.email)!, email);
  if (password) type(field(T.password)!, password);
  act(() => void dialog()!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await settle();
}

describe.each(['de', 'en'] as const)('Anmeldedialog am Kontosymbol (%s)', (lang) => {
  const T = TEXT[lang];

  it('REQ-109-AC1: Kontosymbol ohne Sitzung öffnet den Dialog mit E-Mail-Adresse, Passwort und Schließen', async () => {
    render(lang);
    expect(account().getAttribute('aria-label')).toBe(T.account);
    expect(dialog(), 'vor dem Aktivieren ist kein Dialog vorhanden').toBeNull();
    await open();

    const d = dialog()!;
    expect(d.open, 'Dialog ist modal geöffnet').toBe(true);
    const title = d.querySelector(`#${CSS.escape(d.getAttribute('aria-labelledby') ?? '')}`);
    expect(title?.textContent?.trim()).toBe(T.title);
    expect(field(T.email)?.type).toBe('email');
    expect(field(T.email)?.autocomplete).toBe('username');
    expect(field(T.password)?.type, 'Passwort ist maskiert').toBe('password');
    expect(field(T.password)?.autocomplete).toBe('current-password');
    expect(button(T.close), 'Schließen-Schaltfläche').toBeDefined();
    expect(button(T.submit), 'Anmelden-Schaltfläche').toBeDefined();
    expect(document.activeElement, 'Fokus steht im ersten Feld').toBe(field(T.email));
    expect(opened, 'Öffnen wechselt nicht zur Redaktion').not.toHaveBeenCalled();
    expect(logins, 'Öffnen sendet keine Anmeldung').toHaveLength(0);
  });

  it('REQ-109-AC2: Schließen-Schaltfläche schließt den Dialog und gibt den Fokus an das Kontosymbol zurück', async () => {
    render(lang);
    await open();
    act(() => button(T.close)!.click());
    await until(() => expect(dialog()).toBeNull());
    expect(document.activeElement).toBe(account());
    expect(opened).not.toHaveBeenCalled();
  });

  it('REQ-109-AC2: Escape schließt den Dialog und gibt den Fokus an das Kontosymbol zurück', async () => {
    render(lang);
    await open();
    const input = field(T.password)!;
    input.focus();
    act(() => void input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    await until(() => expect(dialog()).toBeNull());
    expect(document.activeElement).toBe(account());
    expect(opened).not.toHaveBeenCalled();
  });

  it('REQ-109-AC2: nach dem Schließen sind die Eingaben verworfen (Abgrenzung A3)', async () => {
    render(lang);
    await open();
    type(field(T.email)!, 'jemand@example.test');
    type(field(T.password)!, 'geheim-geheim');
    act(() => button(T.close)!.click());
    await until(() => expect(dialog()).toBeNull());
    await open();
    expect(field(T.email)!.value).toBe('');
    expect(field(T.password)!.value).toBe('');
  });

  it('REQ-109-AC3: gültige Zugangsdaten werden gesendet und die Redaktion öffnet sich', async () => {
    render(lang);
    await open();
    await submit(lang, 'redaktion@example.test', 'redaktion-test');
    await until(() => expect(opened).toHaveBeenCalledTimes(1));
    expect(logins).toEqual([{ email: 'redaktion@example.test', password: 'redaktion-test' }]);
    expect(alertText(), 'keine Fehlermeldung nach erfolgreicher Anmeldung').toBe('');
  });

  it.each([
    [401, 'invalid'],
    [429, 'locked'],
    [503, 'busy'],
    [500, 'unavailable'],
  ] as const)('REQ-109-AC3: Ablehnung mit Status %i zeigt die Meldung „%s“, der Dialog bleibt offen, kein Wechsel zur Redaktion', async (status, key) => {
    loginStatus = status;
    render(lang);
    await open();
    await submit(lang, 'redaktion@example.test', 'falsches-passwort');
    await until(() => expect(alertText()).toBe(T[key]));
    expect(dialog()?.open, 'Dialog bleibt offen').toBe(true);
    expect(opened).not.toHaveBeenCalled();
    expect(field(T.email)!.value, 'Eingabe bleibt zum Korrigieren erhalten').toBe('redaktion@example.test');
    // Fehler ist mit den Feldern verknüpft
    const alert = dialog()!.querySelector('[role="alert"]')!;
    expect(field(T.email)!.getAttribute('aria-describedby')).toBe(alert.id);
    expect(field(T.password)!.getAttribute('aria-invalid')).toBe('true');
  });

  it('REQ-109-AC3: ohne Antwort des Servers erscheint die allgemeine Meldung, der Dialog bleibt offen', async () => {
    loginStatus = 'offline';
    render(lang);
    await open();
    await submit(lang, 'redaktion@example.test', 'redaktion-test');
    await until(() => expect(alertText()).toBe(T.unavailable));
    expect(dialog()?.open).toBe(true);
    expect(opened).not.toHaveBeenCalled();
  });

  it('REQ-109-AC3: nach einer Ablehnung führt ein zweiter Versuch mit gültigen Daten in die Redaktion', async () => {
    loginStatus = 401;
    render(lang);
    await open();
    await submit(lang, 'redaktion@example.test', 'falsches-passwort');
    await until(() => expect(alertText()).toBe(T.invalid));
    loginStatus = 200;
    await submit(lang, '', 'redaktion-test');
    await until(() => expect(opened).toHaveBeenCalledTimes(1));
    expect(logins).toHaveLength(2);
    expect(logins[1]).toEqual({ email: 'redaktion@example.test', password: 'redaktion-test' });
  });

  it.each([
    ['ohne Eingaben', '', ''],
    ['ohne Passwort', 'redaktion@example.test', ''],
    ['nur mit Leerzeichen als E-Mail-Adresse', '   ', 'redaktion-test'],
  ])('REQ-109-AC3: %s erscheint eine Meldung und es wird nichts gesendet', async (_, email, password) => {
    render(lang);
    await open();
    await submit(lang, email, password);
    expect(alertText()).toBe(T.missing);
    expect(logins).toHaveLength(0);
    expect(dialog()?.open).toBe(true);
    expect(opened).not.toHaveBeenCalled();
  });

  it('Annahme A1: mit bestehender Sitzung öffnet das Kontosymbol ohne Dialog die Redaktion', async () => {
    sessionStatus = 200;
    render(lang);
    act(() => account().click());
    await until(() => expect(opened).toHaveBeenCalledTimes(1));
    expect(dialog()).toBeNull();
    expect(sessionChecks).toBe(1);
    expect(logins).toHaveLength(0);
  });
});
