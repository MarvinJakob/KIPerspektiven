import { describe, expect, it } from 'vitest';
import { softwareDevelopment, softwareDevelopmentReadingText } from '../i18n/softwareDevelopment';
import { vibeCoding, vibeCodingReadingText } from '../i18n/vibeCoding';
import { countWords, formatReadingTime, formatUpdated, readingMinutes } from './articleMeta';

// Anforderung #56: Autor, Stand und Lesezeit in jedem Themenartikel.
// Regel (Entscheidung vom 18.11.2026): max(1, ⌈Wörter / 120⌉). Sollwerte unabhängig per Wortzählung ermittelt.
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
    expect(countWords(softwareDevelopmentReadingText(softwareDevelopment.de))).toBe(443);
    expect(countWords(softwareDevelopmentReadingText(softwareDevelopment.en))).toBe(476);
    expect(readingMinutes(softwareDevelopmentReadingText(softwareDevelopment.de))).toBe(4);
    expect(readingMinutes(softwareDevelopmentReadingText(softwareDevelopment.en))).toBe(4);
  });

  it('ergibt für „Vibe Coding“ 9 Min. (DE, 1078 Wörter) und 10 Min. (EN, 1134 Wörter)', () => {
    expect(countWords(vibeCodingReadingText(vibeCoding.de))).toBe(1078);
    expect(countWords(vibeCodingReadingText(vibeCoding.en))).toBe(1134);
    expect(readingMinutes(vibeCodingReadingText(vibeCoding.de))).toBe(9);
    expect(readingMinutes(vibeCodingReadingText(vibeCoding.en))).toBe(10);
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
