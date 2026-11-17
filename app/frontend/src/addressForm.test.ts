import { describe, expect, it } from 'vitest';
import imprintDe from './content/legal/impressum.de.md?raw';
import privacyDe from './content/legal/datenschutz.de.md?raw';
import { de } from './i18n/de';

// Issue #40 (REQ-8): Die deutsche Website spricht Besucher mit „du“ an, auch in Oberflächentexten,
// Formularrückmeldungen, Cookie-Hinweis und Rechtstexten.

const FORMAL = new Set(['Sie', 'Ihnen', 'Ihr', 'Ihre', 'Ihren', 'Ihrem', 'Ihrer', 'Ihres']);
const POSSESSIVE = new Set(['Ihr', 'Ihre', 'Ihren', 'Ihrem', 'Ihrer', 'Ihres']);

/**
 * Sätze mit Höflichkeitsform. Großgeschriebene Formen mitten im Satz sind Anrede. Am Satzanfang ist „Sie“
 * mehrdeutig (sie/Sie) und zählt nicht; ein Possessiv vor einem Substantiv („Ihr Nutzen“) zählt.
 */
function formalSentences(text: string): string[] {
  const hits: string[] = [];
  for (const raw of text.split(/(?<=[.!?:;])\s+|\n+|\s[–—]\s/)) {
    const sentence = raw.replace(/^[\s\d.|*#>•·„“"'»«()[\]–—-]+/, '').trim();
    const words = sentence.split(/\s+/).map((w) => w.replace(/^[„“"'»«(*]+|[,.;:!?“"'»«)*]+$/g, ''));
    if (words.some((w, i) => FORMAL.has(w) && (i > 0 || (POSSESSIVE.has(w) && /^[A-ZÄÖÜ]/.test(words[1] ?? ''))))) {
      hits.push(sentence);
    }
  }
  return hits;
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('Du-Ansprache auf der deutschen Website (#40)', () => {
  it('erkennt Sie-Ansprache, aber nicht „sie“ am Satzanfang', () => {
    expect(formalSentences('Wählen Sie einen Reifegrad.')).toHaveLength(1);
    expect(formalSentences('Ihr Nutzen')).toHaveLength(1);
    expect(formalSentences('Die Werte sind historisch. Sie zeigen einen Trend.')).toEqual([]);
    expect(formalSentences('Wähle einen Reifegrad. Dein Ergebnis bleibt im Browser.')).toEqual([]);
  });

  it('Oberflächentexte enthalten keine Sie-Ansprache', () => {
    expect(strings(de).flatMap(formalSentences)).toEqual([]);
  });

  it.each([['Impressum', imprintDe], ['Datenschutz', privacyDe]])('%s enthält keine Sie-Ansprache', (_, text) => {
    expect(formalSentences(text)).toEqual([]);
  });
});
