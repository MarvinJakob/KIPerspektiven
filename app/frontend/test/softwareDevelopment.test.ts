// Unit-Tests der Seitentexte „Softwareentwicklung“ (node:test, Node-Type-Stripping; `npm run test:unit`).
// Anforderung #37: Der Beitrag endet mit dem Meinungsabschnitt; der Abschnitt „Weitere Perspektiven /
// Mehr Themen.“ mit den Karten „Vibe Coding“ und „KI Readiness“ sowie „Alle Themen“ entfällt in DE und EN.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { softwareDevelopment } from '../src/i18n/softwareDevelopment.ts';

/** Sollwerte aus Ticket #37 (Screenshot) und der englischen Entsprechung, unabhängig vom Anwendungscode. */
const removed = {
  de: ['Weitere Perspektiven', 'Mehr Themen.', 'Zum Thema', 'Alle Themen', 'KI Readiness', 'Verantwortung für schnellen Code übernehmen'],
  en: ['More perspectives', 'More topics.', 'Go to topic', 'All topics', 'AI Readiness', 'Taking responsibility for fast code'],
} as const;

/** Alle Textwerte eines Inhaltsobjekts, auch aus verschachtelten Objekten und Listen. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

/** Listeneinträge, die wie Themenkarten aussehen (Objekte mit Slug). */
function topicEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap((v) => (v && typeof v === 'object' && 'slug' in v ? [v] : topicEntries(v)));
  if (value && typeof value === 'object') return Object.values(value).flatMap(topicEntries);
  return [];
}

for (const lang of ['de', 'en'] as const) {
  test(`REQ-37-AC1: Texte „${removed[lang][0]}“ und „${removed[lang][1]}“ sind entfernt (${lang})`, () => {
    const texts = strings(softwareDevelopment[lang]).map((s) => s.trim());
    for (const text of removed[lang].slice(0, 2)) assert.ok(!texts.includes(text), `„${text}“ ist noch im Seiteninhalt (${lang})`);
  });

  test(`REQ-37-AC2: keine Themenkarten, kein „${removed[lang][2]}“ und kein „${removed[lang][3]}“ (${lang})`, () => {
    const texts = strings(softwareDevelopment[lang]).map((s) => s.trim());
    for (const text of removed[lang].slice(2)) assert.ok(!texts.includes(text), `„${text}“ ist noch im Seiteninhalt (${lang})`);
    assert.deepEqual(topicEntries(softwareDevelopment[lang]), [], `Themenkarten im Seiteninhalt (${lang})`);
  });

  test(`REQ-37-AC1: Meinungsabschnitt mit Kontaktmöglichkeit bleibt erhalten (${lang})`, () => {
    const c = softwareDevelopment[lang];
    assert.equal(c.opinionTitle, lang === 'de' ? 'Würdest du auch so entwickeln?' : 'Would you develop like this too?');
    assert.equal(c.contact, lang === 'de' ? 'Zum Kontaktformular' : 'Go to the contact form');
  });
}
