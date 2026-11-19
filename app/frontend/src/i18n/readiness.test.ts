import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { overviewDimensions, readiness, toggled } from './readiness';

// Unit-Tests zu Ticket #115 (KI-Readiness-Übersicht nach Mock readiness_v1). Sollwerte stammen aus dem
// Ticket und dem Readiness-Katalog, nicht aus dem Anwendungscode.

const catalog = (
  JSON.parse(readFileSync(new URL('../../../backend/internal/audit/content.json', import.meta.url), 'utf8')) as {
    dimensions: { slug: string; released: boolean; texts: { de: { title: string; summary: string; intro: string[] } } }[];
  }
).dimensions.filter((d) => d.released);

const api = (slug: string, title: string) => ({
  slug,
  lang: 'de' as const,
  title,
  summary: `Leitfrage ${title}?`,
  category: 'technical' as const,
  intro: [`Beschreibung ${title}.`],
});

describe('Dimensionen der Übersicht', () => {
  it('REQ-115-AC2: Deutsch übernimmt Titel, Leitfrage und Beschreibung des Katalogs in dessen Reihenfolge', () => {
    const out = overviewDimensions([api('betrieb', 'Betrieb'), api('daten-und-wissen', 'Daten und Wissen')], 'de');
    expect(out).toEqual([
      { slug: 'betrieb', title: 'Betrieb', question: 'Leitfrage Betrieb?', category: 'technical', description: ['Beschreibung Betrieb.'], contentLang: undefined },
      { slug: 'daten-und-wissen', title: 'Daten und Wissen', question: 'Leitfrage Daten und Wissen?', category: 'technical', description: ['Beschreibung Daten und Wissen.'], contentLang: undefined },
    ]);
  });

  it('REQ-115-AC5: Englisch ersetzt die deutschen Katalogtexte je Dimension durch die Übersetzung', () => {
    const [d] = overviewDimensions([api('betrieb', 'Betrieb')], 'en');
    expect(d).toMatchObject({ slug: 'betrieb', title: 'Operations', category: 'technical', contentLang: undefined });
    expect(d.question).toBe(readiness.en.dimensions.betrieb.question);
    expect(d.description).toEqual(readiness.en.dimensions.betrieb.description);
  });

  it('REQ-115-AC5: eine Dimension ohne Übersetzung erscheint mit Katalogtext und Sprachkennzeichnung', () => {
    const [d] = overviewDimensions([api('neue-dimension', 'Neue Dimension')], 'en');
    expect(d).toMatchObject({ title: 'Neue Dimension', question: 'Leitfrage Neue Dimension?', description: ['Beschreibung Neue Dimension.'], contentLang: 'de' });
  });

  it('REQ-115-AC5: jede freigegebene Dimension des Katalogs hat vollständige englische Übersichtstexte', () => {
    expect(catalog).toHaveLength(8);
    for (const d of catalog) {
      const en = readiness.en.dimensions[d.slug];
      expect(en, d.slug).toBeDefined();
      expect(en.title.trim(), d.slug).not.toBe('');
      expect(en.question, d.slug).toMatch(/\?$/);
      expect(en.question, d.slug).not.toBe(d.texts.de.summary);
      expect(en.description, d.slug).toHaveLength(d.texts.de.intro.length);
      expect(en.description[0], d.slug).not.toBe(d.texts.de.intro[0]);
    }
  });
});

describe('Aufklappen der Dimensionen', () => {
  it('REQ-115-AC3: öffnet einen geschlossenen und schließt einen offenen Eintrag, ohne andere zu verändern', () => {
    const one = toggled(new Set(), 'betrieb');
    expect([...one]).toEqual(['betrieb']);
    const two = toggled(one, 'daten-und-wissen');
    expect([...two].sort()).toEqual(['betrieb', 'daten-und-wissen']);
    expect([...toggled(two, 'betrieb')]).toEqual(['daten-und-wissen']);
    expect([...one], 'Eingabe bleibt unverändert').toEqual(['betrieb']);
  });
});

describe('Seitentexte', () => {
  it('REQ-115-AC2 REQ-115-AC5: beide Sprachen führen drei Einführungsabsätze, drei Reifegrade und zwei Absätze der Einordnung', () => {
    for (const lang of ['de', 'en'] as const) {
      const c = readiness[lang];
      expect(c.intro, lang).toHaveLength(3);
      expect(c.levels.items, lang).toHaveLength(3);
      expect(c.note.text, lang).toHaveLength(2);
    }
    expect(readiness.de.levels.items.map((l) => l.name)).toEqual(['Einfach', 'Strukturiert', 'Intelligent']);
    expect(readiness.de.hero.updated).toBe('Stand: 19. November 2026');
  });
});
