// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import START_SCRIPT from '../../public/theme.js?raw';
import { THEME_KEY, currentTheme } from './theme';

// REQ-104-AC10: Ohne gespeicherte Wahl folgt die Darstellung der Systemeinstellung (prefers-color-scheme);
// eine gespeicherte Wahl hat Vorrang (Entscheidung im Ticket #104 vom 19.11.2026).

function systemPrefers(scheme: 'dark' | 'light' | null) {
  if (scheme === null) {
    vi.stubGlobal('matchMedia', undefined);
    return;
  }
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.replace(/\s/g, '') === `(prefers-color-scheme:${scheme})`,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

const runStartScript = () => new Function(START_SCRIPT)();
const attr = () => document.documentElement.getAttribute('data-theme');

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => vi.unstubAllGlobals());

describe('REQ-104-AC10: Startskript public/theme.js', () => {
  it('REQ-104-AC10: ohne Wahl und dunkle Systemeinstellung startet dunkel', () => {
    systemPrefers('dark');
    runStartScript();
    expect(attr()).toBe('dark');
  });
  it('REQ-104-AC10: ohne Wahl und helle Systemeinstellung startet hell', () => {
    systemPrefers('light');
    runStartScript();
    expect(attr()).toBe('light');
  });
  it('REQ-104-AC10: gespeicherte Wahl hell hat Vorrang vor dunkler Systemeinstellung', () => {
    systemPrefers('dark');
    localStorage.setItem(THEME_KEY, 'light');
    runStartScript();
    expect(attr()).toBe('light');
  });
  it('REQ-104-AC10: gespeicherte Wahl dunkel hat Vorrang vor heller Systemeinstellung', () => {
    systemPrefers('light');
    localStorage.setItem(THEME_KEY, 'dark');
    runStartScript();
    expect(attr()).toBe('dark');
  });
  it('REQ-104-AC10: ungültiger gespeicherter Wert wird ignoriert', () => {
    systemPrefers('dark');
    localStorage.setItem(THEME_KEY, 'blau');
    runStartScript();
    expect(attr()).toBe('dark');
  });
  it('REQ-104-AC10: ohne matchMedia startet hell', () => {
    systemPrefers(null);
    runStartScript();
    expect(attr()).toBe('light');
  });
  it('REQ-104-AC10: bei blockiertem Speicher folgt die Darstellung der Systemeinstellung', () => {
    systemPrefers('dark');
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blockiert', 'SecurityError');
    });
    runStartScript();
    spy.mockRestore();
    expect(attr()).toBe('dark');
  });
});

describe('REQ-104-AC10: currentTheme', () => {
  it('REQ-104-AC10: ohne Attribut und ohne Wahl folgt sie der Systemeinstellung', () => {
    systemPrefers('dark');
    expect(currentTheme()).toBe('dark');
    systemPrefers('light');
    expect(currentTheme()).toBe('light');
  });
  it('REQ-104-AC10: das gesetzte Attribut hat Vorrang', () => {
    systemPrefers('dark');
    document.documentElement.setAttribute('data-theme', 'light');
    expect(currentTheme()).toBe('light');
  });
});
