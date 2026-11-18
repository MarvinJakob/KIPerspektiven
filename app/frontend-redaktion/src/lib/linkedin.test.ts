import { describe, expect, it } from 'vitest';
import { canRetry, enableBlocker, shareLabel, type LinkedInSettings, type LinkedInShare } from './linkedin';
import { can, type Role } from './permissions';

// Ticket #85: LinkedIn-Einstellungen und LinkedIn-Status am Beitrag. Sollwerte aus der Spezifikation REQ-85.
// Fidelity-Test: app/e2e/tests/85-linkedin.spec.ts.

const connected: LinkedInSettings = {
  appConfigured: true,
  connected: true,
  expired: false,
  enabled: false,
  profileName: 'Marvin Jakob',
  preferredLang: 'de',
};

describe('Einschalten nur mit gültiger Verbindung', () => {
  it('REQ-85-AC2: ohne App-Konfiguration nennt die Oberfläche die fehlende Einrichtung', () => {
    expect(enableBlocker({ ...connected, appConfigured: false, connected: false })).toMatch(/LINKEDIN_CLIENT_ID/);
  });
  it('REQ-85-AC2: ohne verbundenes Profil', () => {
    expect(enableBlocker({ ...connected, connected: false, profileName: undefined })).toMatch(/kein LinkedIn-Profil verbunden/);
  });
  it('REQ-85-AC2: mit abgelaufener Autorisierung', () => {
    expect(enableBlocker({ ...connected, expired: true })).toMatch(/abgelaufen/);
  });
  it('REQ-85-AC1: gültige Verbindung lässt das Einschalten zu', () => {
    expect(enableBlocker(connected)).toBeNull();
  });
});

describe('LinkedIn-Status am Beitrag', () => {
  const share = (state: LinkedInShare['state']): LinkedInShare => ({ state, lang: 'de', updatedAt: '2026-11-18T10:00:00Z' });
  it('REQ-85-AC8: Bezeichnungen der Zustände', () => {
    expect(['pending', 'sending', 'succeeded', 'failed', 'unknown'].map((s) => shareLabel(share(s as LinkedInShare['state'])))).toEqual([
      'Wird gesendet',
      'Wird gesendet',
      'Geteilt',
      'Fehlgeschlagen',
      'Ausgang unklar',
    ]);
  });
  it('REQ-85-AC12 AC13: nur ein eindeutig abgelehnter Versand lässt sich wiederholen', () => {
    expect(['pending', 'sending', 'succeeded', 'failed', 'unknown'].map((s) => canRetry(share(s as LinkedInShare['state'])))).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
  });
});

describe('Einstellungen je Rolle', () => {
  it('REQ-85-AC4: nur Admins sehen die Einstellungen', () => {
    const roles: Role[][] = [['editor'], ['marketing'], ['editor', 'marketing'], ['admin']];
    expect(roles.map((r) => can(r, 'settings'))).toEqual([false, false, false, true]);
  });
});
