import { describe, expect, it } from 'vitest';
import styles from '../styles.css?raw';
import type { Role } from './permissions';
import { NARROW_MAX_WIDTH, SIDEBAR_KEY, navItems, readSidebarCollapsed, storeSidebarCollapsed } from './navigation';

// Anforderung #103: einklappbare Seitenleiste der Redaktion. Sollwerte aus der Spezifikation REQ-103
// (Rollentabelle aus #64). Fidelity-Test: app/e2e/tests/103-seitenleiste.spec.ts.

const labels = (roles: Role[]) => navItems(roles).map((i) => i.label);

describe('REQ-103-AC5: Ziele je Rolle in fester Reihenfolge', () => {
  it('Redakteur: Beiträge, Themenartikel, Profil', () => {
    expect(labels(['editor'])).toEqual(['Beiträge', 'Themenartikel', 'Profil']);
  });
  it('Marketing: Statistik, Beratungsanfragen, Nachrichten, Profil', () => {
    expect(labels(['marketing'])).toEqual(['Statistik', 'Beratungsanfragen', 'Nachrichten', 'Profil']);
  });
  it('Redakteur und Marketing: Rechte addieren sich, ohne Benutzer und Einstellungen', () => {
    expect(labels(['marketing', 'editor'])).toEqual(['Beiträge', 'Themenartikel', 'Statistik', 'Beratungsanfragen', 'Nachrichten', 'Profil']);
  });
  it('Admin: alle acht Ziele', () => {
    const all = ['Beiträge', 'Themenartikel', 'Statistik', 'Beratungsanfragen', 'Nachrichten', 'Benutzer', 'Einstellungen', 'Profil'];
    expect(labels(['admin'])).toEqual(all);
    expect(labels(['editor', 'admin'])).toEqual(all);
  });
  it('Konto ohne Rolle sieht nur das Profil', () => {
    expect(labels([])).toEqual(['Profil']);
  });
  it('Ziele führen zu den bisherigen Routen; nur die Beitragsliste ist exakt', () => {
    expect(navItems(['admin']).map((i) => [i.to, !!i.end])).toEqual([
      ['/', true],
      ['/themenartikel', false],
      ['/statistik', false],
      ['/beratungsanfragen', false],
      ['/nachrichten', false],
      ['/benutzer', false],
      ['/einstellungen', false],
      ['/profil', false],
    ]);
  });
  it('jedes Ziel hat ein eigenes Kurzzeichen für die eingeklappte Leiste (REQ-103-AC2)', () => {
    const icons = navItems(['admin']).map((i) => i.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

/** Minimaler Speicher wie localStorage; `broken` simuliert gesperrten Speicher (privates Fenster). */
function memory(broken = false) {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => {
      if (broken) throw new Error('blockiert');
      return data.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (broken) throw new Error('blockiert');
      data.set(k, v);
    },
  };
}

describe('REQ-103-AC2: gewählter Zustand der Seitenleiste bleibt erhalten', () => {
  it('ohne gespeicherte Wahl ist die Leiste ausgeklappt', () => {
    expect(readSidebarCollapsed(memory())).toBe(false);
  });
  it('eingeklappt und wieder ausgeklappt wird gespeichert und gelesen', () => {
    const s = memory();
    storeSidebarCollapsed(true, s);
    expect(s.data.get(SIDEBAR_KEY)).toBe('collapsed');
    expect(readSidebarCollapsed(s)).toBe(true);
    storeSidebarCollapsed(false, s);
    expect(readSidebarCollapsed(s)).toBe(false);
  });
  it('unbekannte Werte gelten als ausgeklappt', () => {
    const s = memory();
    s.data.set(SIDEBAR_KEY, 'irgendwas');
    expect(readSidebarCollapsed(s)).toBe(false);
  });
  it('gesperrter Speicher führt nicht zu einem Fehler', () => {
    const s = memory(true);
    expect(readSidebarCollapsed(s)).toBe(false);
    expect(() => storeSidebarCollapsed(true, s)).not.toThrow();
  });
});

describe('REQ-103-AC3: Wechselpunkt zur schmalen Ansicht', () => {
  it('liegt bei 899 px und ist in Skript und CSS gleich', () => {
    expect(NARROW_MAX_WIDTH).toBe(899);
    expect(styles).toContain(`@media (max-width: ${NARROW_MAX_WIDTH}px)`);
  });
});
