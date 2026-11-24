import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { components } from '../api/schema';
import { articleReadingText } from './articleText';
import { countWords, formatReadingTime, formatUpdated, readingMinutes } from './articleMeta';

// Anforderung #56: Autor, Stand und Lesezeit in jedem Themenartikel.
// Regel (Entscheidung vom 18.11.2026): max(1, ⌈Wörter / 120⌉). Sollwerte unabhängig per Wortzählung ermittelt.
// Seit #136 liegen die Artikel als überführte Themenartikel im Backend; Vitest läuft im Verzeichnis des Frontends.
type Text = components['schemas']['ArticleText'];
const imported = (slug: string) =>
  JSON.parse(readFileSync(`../backend/internal/service/topicarticles/${slug}.json`, 'utf8')) as Record<'de' | 'en', Text>;
const softwareDevelopment = imported('softwareentwicklung');
const vibeCoding = imported('vibe-coding');
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

describe('REQ-56-AC3: Lesezeit-Regel', () => {
  it('zählt durch Leerraum getrennte Wörter über alle Abschnitte, ohne weiche Trennstriche zu trennen', () => {
    expect(countWords(['KI in der Software­entwicklung', '  zwei\nWörter  '])).toBe(6);
    expect(countWords([])).toBe(0);
  });

  it.each([
    [0, 1],
    [1, 1],
    [120, 1],
    [121, 2],
    [240, 2],
    [241, 3],
  ])('%i Wörter → %i Min.', (n, minutes) => {
    expect(readingMinutes([words(n)])).toBe(minutes);
  });

  it('ergibt für „KI in der Softwareentwicklung“ die Referenz aus dem Screenshot: 4 Min. (DE 443, EN 476 Wörter)', () => {
    expect(countWords(articleReadingText(softwareDevelopment.de))).toBe(443);
    expect(countWords(articleReadingText(softwareDevelopment.en))).toBe(476);
    expect(readingMinutes(articleReadingText(softwareDevelopment.de))).toBe(4);
    expect(readingMinutes(articleReadingText(softwareDevelopment.en))).toBe(4);
  });

  // Seit #136 zählen Beschriftungen von Beispielkästen einheitlich nicht mit: ohne „Stell dir vor“ (3 Wörter)
  // und „Imagine this“ (2 Wörter) der Einleitung. Die Lesezeit bleibt gleich.
  it('ergibt für „Vibe Coding“ 9 Min. (DE, 1075 Wörter) und 10 Min. (EN, 1132 Wörter)', () => {
    expect(countWords(articleReadingText(vibeCoding.de))).toBe(1075);
    expect(countWords(articleReadingText(vibeCoding.en))).toBe(1132);
    expect(readingMinutes(articleReadingText(vibeCoding.de))).toBe(9);
    expect(readingMinutes(articleReadingText(vibeCoding.en))).toBe(10);
  });

  it('beschriftet die Lesezeit in der Sprache der Seite', () => {
    expect(formatReadingTime(4, 'de')).toBe('ca. 4 Min. Lesezeit');
    expect(formatReadingTime(10, 'en')).toBe('approx. 10 min read');
  });
});

describe('REQ-56-AC2: Stand in der Sprache der Seite', () => {
  it('formatiert den 16.11.2026 deutsch und englisch', () => {
    expect(formatUpdated('2026-11-16', 'de')).toBe('Stand: 16. November 2026');
    expect(formatUpdated('2026-11-16', 'en')).toBe('Updated: 16 November 2026');
  });

  it('verschiebt das Datum nicht durch Zeitzonen (Monats- und Jahresgrenze)', () => {
    expect(formatUpdated('2027-01-01', 'de')).toBe('Stand: 1. Januar 2027');
    expect(formatUpdated('2026-12-31', 'en')).toBe('Updated: 31 December 2026');
  });
});
