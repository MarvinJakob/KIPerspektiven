import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Anforderung #61, REQ-61-AC4: DESIGN.md dokumentiert das vollständige Layout redaktioneller Themenartikel.
// Automatisiert geprüft werden Struktur und Vollständigkeit; den inhaltlichen Abgleich mit dem CSS
// dokumentiert das manuelle Prüfprotokoll im Ticket.
const design = readFileSync(new URL('../DESIGN.md', import.meta.url), 'utf8');

/** Text des Level-2-Abschnitts, dessen Überschrift den Titel enthält, bis zur nächsten Level-2-Überschrift. */
function section(title) {
  const start = design.search(new RegExp(`^## (?:\\d+\\. )?${title}\\s*$`, 'm'));
  assert.notEqual(start, -1, `Abschnitt „${title}“ fehlt`);
  const rest = design.slice(start + 3);
  const end = rest.search(/^## /m);
  return end === -1 ? rest : rest.slice(0, end);
}

const SUBSECTIONS = [
  'Seitenaufbau und Navigation',
  'Artikelkopf',
  'Typografie',
  'Farben',
  'Abstände',
  'Inhaltsrahmen und Lesespalte',
  'Abschnittsraster',
  'Inhaltsbausteine',
  'Responsives Verhalten',
  'Barrierefreiheit',
];

test('REQ-61-AC4: eigener Abschnitt mit allen geforderten Unterabschnitten', () => {
  const text = section('Redaktionelle Themenartikel');
  const headings = [...text.matchAll(/^### (.+)$/gm)].map((m) => m[1].trim());
  for (const name of SUBSECTIONS) assert.ok(headings.includes(name), `Unterabschnitt „${name}“ fehlt (vorhanden: ${headings.join(', ')})`);
  for (const name of SUBSECTIONS) {
    const start = text.indexOf(`### ${name}\n`);
    const body = text.slice(start + name.length + 5).split(/^### /m)[0];
    assert.ok(body.replace(/\s+/g, ' ').trim().length > 80, `Unterabschnitt „${name}“ ist leer oder zu knapp`);
  }
});

test('REQ-61-AC4: beide Artikel, optionale Bausteine sowie Desktop und Mobil werden beschrieben', () => {
  const text = section('Redaktionelle Themenartikel');
  for (const word of ['Vibe Coding', 'KI in der Softwareentwicklung', 'optional', 'Desktop', 'Mobil']) {
    assert.match(text, new RegExp(word, 'i'), `„${word}“ fehlt`);
  }
  const blocks = section('Redaktionelle Themenartikel').split('### Inhaltsbausteine')[1].split(/^### /m)[0];
  for (const block of ['Untertitel', 'Beispiel', 'Zitat', 'Grafik', 'Weiterlesen', 'Fazit', 'Meinung']) {
    assert.match(blocks, new RegExp(block, 'i'), `Baustein „${block}“ fehlt`);
  }
});

test('REQ-61-AC4: Dokumentation nennt die gemeinsamen Titelwerte und keine Brotkrumen', () => {
  const text = section('Redaktionelle Themenartikel');
  assert.match(text, /clamp\(3\.6rem, 8vw, 7rem\)/, 'Titelgröße fehlt');
  assert.match(text, /-\.06em/, 'Laufweite fehlt');
  assert.match(text, /Brotkrumen/i, 'Hinweis auf entfallene Brotkrumennavigation fehlt');
});
