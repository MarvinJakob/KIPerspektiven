import { describe, expect, it } from 'vitest';
import { i18n } from '../i18n';
import { consentStatus, storageOptions } from './consentTexts';

// Anforderung #78: Speicherwahl im Cookie-Dialog verständlich beschriften.
// Sollwerte aus Ticket #78 (Spezifikation REQ-78-AC1 bis AC4); Fidelity-Tests: app/e2e/tests/78-speicherwahl.spec.ts.
const SOLL = {
  de: {
    remember: 'Sprache und Darstellung merken',
    visit: 'Nur für diesen Besuch',
    savedRemember:
      'Gewählt: Sprache und Darstellung merken. Die Website merkt sich deine Sprache und Darstellung in diesem Browser für spätere Besuche.',
    savedVisit: 'Gewählt: Nur für diesen Besuch. Die Website übernimmt deine Sprache und Darstellung beim nächsten Besuch nicht.',
    hint: 'Diese Wahl gilt nur, bis die Seite vollständig neu geladen wird. Danach kannst du sie hier erneut treffen.',
    old: ['Nur notwendige Cookies', 'Keine Cookies speichern'],
  },
  en: {
    remember: 'Remember language and appearance',
    visit: 'For this visit only',
    savedRemember:
      'Chosen: remember language and appearance. The website remembers your language and appearance in this browser for future visits.',
    savedVisit: 'Chosen: for this visit only. The website will not reuse your language and appearance on your next visit.',
    hint: 'This choice only lasts until the page is fully reloaded. You can make it again here afterwards.',
    old: ['Necessary cookies only', 'Store no cookies'],
  },
} as const;

describe.each(['de', 'en'] as const)('Speicherwahl im Cookie-Dialog (%s)', (lang) => {
  const t = i18n.getFixedT(lang);
  const soll = SOLL[lang];

  it(`REQ-78-${lang === 'de' ? 'AC1' : 'AC2'}: zwei Schaltflächen mit verständlicher Beschriftung je Speichermodus`, () => {
    const options = storageOptions(t, false);
    expect(options).toEqual([
      { mode: 'none', label: soll.visit },
      { mode: 'necessary', label: soll.remember },
    ]);
    for (const old of soll.old) expect(options.map((o) => o.label), `alter Text „${old}“`).not.toContain(old);
  });

  it('REQ-78-AC3: Statusmeldung nach „merken“ nennt Sprache und Darstellung für spätere Besuche', () => {
    expect(consentStatus(t, 'necessary')).toBe(soll.savedRemember);
  });

  it('REQ-78-AC4: Statusmeldung nach „nur für diesen Besuch“ verneint die Übernahme und erklärt die Gültigkeit', () => {
    expect(consentStatus(t, 'none')).toBe(`${soll.savedVisit} ${soll.hint}`);
  });
});
