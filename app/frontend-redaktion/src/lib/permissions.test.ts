import { describe, expect, it } from 'vitest';
import { can, homeFor, rolesLabel, type Role } from './permissions';

// Anforderung #64: Oberfläche der Redaktion je Rolle (Navigation, Seitenschutz, Startseite).
// Sollwerte aus der Rollentabelle der Spezifikation REQ-64. Das Backend prüft dieselben Regeln
// (Fidelity-Test: app/e2e/tests/64-rollen-profile.spec.ts).

const editor: Role[] = ['editor'];
const marketing: Role[] = ['marketing'];
const both: Role[] = ['editor', 'marketing'];
const admin: Role[] = ['admin'];

describe('Rechte je Rolle', () => {
  it('REQ-64-AC4: Redakteur verwaltet nur Beiträge', () => {
    expect([can(editor, 'posts'), can(editor, 'insights'), can(editor, 'deleteConsultations'), can(editor, 'users')]).toEqual([true, false, false, false]);
  });
  it('REQ-64-AC5: Marketing sieht nur Statistik, Nachrichten und Beratungsanfragen und löscht nichts', () => {
    expect([can(marketing, 'posts'), can(marketing, 'insights'), can(marketing, 'deleteConsultations'), can(marketing, 'users')]).toEqual([false, true, false, false]);
  });
  it('REQ-64-AC6: Mehrfachrollen addieren Rechte, ohne Benutzerverwaltung und Löschen', () => {
    expect([can(both, 'posts'), can(both, 'insights'), can(both, 'deleteConsultations'), can(both, 'users')]).toEqual([true, true, false, false]);
  });
  it('REQ-64-AC3: Admin hat alle Rechte, auch mit weiteren Rollen', () => {
    for (const roles of [admin, ['marketing', 'admin'] as Role[]]) {
      expect([can(roles, 'posts'), can(roles, 'insights'), can(roles, 'deleteConsultations'), can(roles, 'users')]).toEqual([true, true, true, true]);
    }
  });
  it('REQ-64-AC8: jedes Konto erreicht sein Profil', () => {
    for (const roles of [editor, marketing, both, admin]) expect(can(roles, 'profile')).toBe(true);
  });
});

describe('Startseite und Rollenbezeichnung', () => {
  it('führt Admin zur Benutzerverwaltung, Redakteure zu den Beiträgen und Marketing zur Statistik', () => {
    expect(homeFor(admin)).toBe('/benutzer');
    expect(homeFor(editor)).toBe('/');
    expect(homeFor(both)).toBe('/');
    expect(homeFor(marketing)).toBe('/statistik');
  });
  it('benennt Rollen in fester Reihenfolge auf Deutsch', () => {
    expect(rolesLabel(['marketing', 'admin', 'editor'])).toBe('Admin, Redakteur, Marketing');
    expect(rolesLabel(['editor'])).toBe('Redakteur');
  });
});
