import { describe, expect, it } from 'vitest';
import { i18n } from '../i18n';
import { footerNotes, footerPages, footerTopics, footerYearLine } from './footer';

// Anforderung #54: Öffentlicher Footer „Kompakt mit Themen“.
// Sollwerte laut Ticket #54 und Mock mock/footer/index.html; Fidelity-Tests: app/e2e/tests/54-footer.spec.ts.
const SOLL = {
  de: {
    notes: ['Perspektiven und Erfahrungen rund um künstliche Intelligenz.', 'Diese Website wurde mit Unterstützung von KI erstellt.'],
    heading: 'Themen',
    topics: ['KI in der Softwareentwicklung', 'KI Readiness', 'Vibe Coding'],
    pages: ['Blog', 'Kontakt', 'Impressum', 'Datenschutz'],
    cookies: 'Cookie-Einstellungen',
  },
  en: {
    notes: ['Perspectives and experiences around artificial intelligence.', 'This website was created with the help of AI.'],
    heading: 'Topics',
    topics: ['AI in Software Development', 'AI Readiness', 'Vibe Coding'],
    pages: ['Blog', 'Contact', 'Legal notice', 'Privacy'],
    cookies: 'Cookie settings',
  },
} as const;

describe.each(['de', 'en'] as const)('Footer (%s)', (lang) => {
  const t = i18n.getFixedT(lang);
  const soll = SOLL[lang];

  it('REQ-54-AC2: Kurztext besteht aus genau den zwei vorgegebenen Sätzen in dieser Reihenfolge', () => {
    expect(footerNotes(t)).toEqual(soll.notes);
  });

  it('REQ-54-AC3: drei Themen in fester Reihenfolge mit Pfaden innerhalb derselben Sprachfassung', () => {
    expect(t('nav.topics')).toBe(soll.heading);
    expect(footerTopics(lang, t)).toEqual([
      { label: soll.topics[0], to: `/${lang}/themen/softwareentwicklung` },
      { label: soll.topics[1], to: `/${lang}/themen/ai-audit` },
      { label: soll.topics[2], to: `/${lang}/themen/vibe-coding` },
    ]);
  });

  it('REQ-54-AC1/AC3: Seitenlinks Blog, Kontakt, Impressum, Datenschutz in dieser Reihenfolge, danach Cookie-Einstellungen', () => {
    expect(footerPages(lang, t)).toEqual([
      { label: soll.pages[0], to: `/${lang}/blog` },
      { label: soll.pages[1], to: `/${lang}/kontakt` },
      { label: soll.pages[2], to: `/${lang}/impressum` },
      { label: soll.pages[3], to: `/${lang}/datenschutz` },
    ]);
    expect(t('cookies.open')).toBe(soll.cookies);
  });
});

describe('REQ-54-AC1: Jahreszeile', () => {
  it('nennt Jahr und Markenname ohne Copyright-Zeichen', () => {
    expect(footerYearLine(2026, 'KI Perspektiven')).toBe('2026 KI Perspektiven');
    expect(footerYearLine(2031, 'KI Perspektiven')).toBe('2031 KI Perspektiven');
    expect(footerYearLine(2026, 'KI Perspektiven')).not.toContain('©');
  });
});
