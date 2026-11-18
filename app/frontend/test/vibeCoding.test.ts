// Unit-Tests für die Texte der Themenseite „Vibe Coding“ (node --test, TypeScript per Type-Stripping).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { vibeCoding } from '../src/i18n/vibeCoding.ts';

// Anforderung #38: Kartentexte und Bereichsbezeichnung unter dem Fazit (Quelle: Ticket #38).
const CARDS = {
  de: ['Zur Themenübersicht', 'KI Readiness einschätzen', 'Weiterlesen'],
  en: ['Back to the topic overview', 'Assess your AI Readiness', 'Read on'],
} as const;

const strings = (value: unknown): string[] =>
  typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];

for (const lang of ['de', 'en'] as const) {
  test(`REQ-38-AC1/AC3 (${lang}): Seitentexte enthalten keine Linkkarten und keinen „Weiterlesen“-Bereich`, () => {
    const texts = strings(vibeCoding[lang]);
    for (const card of CARDS[lang]) {
      assert.ok(!texts.includes(card), `${lang}: Text „${card}“ ist noch Teil der Seite`);
    }
  });

  test(`REQ-38-AC2 (${lang}): Beitrag endet mit einem vollständigen Fazit`, () => {
    const c = vibeCoding[lang];
    assert.equal(c.conclusionLabel, lang === 'de' ? 'Fazit' : 'Conclusion');
    assert.ok(c.conclusionTitle.trim().length > 0, `${lang}: Fazit-Überschrift fehlt`);
    assert.ok(c.conclusion.length > 0 && c.conclusion.every((p) => p.trim().length > 0), `${lang}: Fazit ohne Absätze`);
  });
}
