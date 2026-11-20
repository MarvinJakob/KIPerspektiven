import { describe, expect, it } from 'vitest';
import { profile } from './profile';

// Anforderung #119: Schwerpunkt „Conference Speaker“ auf der Profilseite.
// Sollwerte aus Ticket #119 (vier bestehende Schwerpunkte, danach „Conference Speaker“ in beiden Sprachen).
// Fidelity-Tests: app/e2e/tests/119-profil-conference-speaker.spec.ts.
const SOLL = {
  de: ['Projekt Management', 'Business Analyse', 'Software Architektur', 'Software Entwicklung', 'Conference Speaker'],
  en: ['Project Management', 'Business Analysis', 'Software Architecture', 'Software Development', 'Conference Speaker'],
} as const;

describe('Schwerpunkte der Profilseite', () => {
  it('REQ-119-AC1: deutsche Schwerpunkte enden mit „Conference Speaker“ nach den vier bestehenden', () => {
    expect(profile.de.tags).toEqual(SOLL.de);
  });

  it('REQ-119-AC2: englische Schwerpunkte enden mit „Conference Speaker“ nach den vier bestehenden', () => {
    expect(profile.en.tags).toEqual(SOLL.en);
  });
});
