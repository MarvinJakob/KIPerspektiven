import { describe, expect, it } from 'vitest';
import { vibeCoding } from './vibeCoding';

// Anforderung #38: Unter dem Fazit der Themenseite „Vibe Coding“ stehen keine Linkkarten.
// Kartentexte und Bereichsbezeichnung laut Ticket #38; Fidelity-Tests: app/e2e/tests/38-vibe-coding-fazit.spec.ts.
const CARDS = {
  de: ['Zur Themenübersicht', 'KI Readiness einschätzen', 'Weiterlesen'],
  en: ['Back to the topic overview', 'Assess your AI Readiness', 'Read on'],
} as const;

const strings = (value: unknown): string[] =>
  typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];

describe.each(['de', 'en'] as const)('Vibe Coding (%s)', (lang) => {
  it('REQ-38-AC1/AC3: Seitentexte enthalten keine Linkkarten und keinen „Weiterlesen“-Bereich', () => {
    const texts = strings(vibeCoding[lang]);
    for (const card of CARDS[lang]) expect(texts, `${lang}: Text „${card}“ ist noch Teil der Seite`).not.toContain(card);
  });

  it('REQ-38-AC2: Beitrag endet mit einem vollständigen Fazit', () => {
    const c = vibeCoding[lang];
    expect(c.conclusionLabel).toBe(lang === 'de' ? 'Fazit' : 'Conclusion');
    expect(c.conclusionTitle.trim()).not.toBe('');
    expect(c.conclusion.length).toBeGreaterThan(0);
    for (const p of c.conclusion) expect(p.trim()).not.toBe('');
  });
});
