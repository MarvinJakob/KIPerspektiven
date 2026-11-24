import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { components } from '../api/schema';
import { blocksToDoc, docToBlocks, type DocNode } from './articleDoc';
import { normalizeHref } from './links';

// Unit-Tests zu Ticket #136: Umwandlung zwischen gespeicherten Bausteinen und dem Dokument des WYSIWYG-Editors.
// Sollwerte: Der gespeicherte Inhalt bleibt beim Öffnen und Speichern gleich (REQ-136-AC5, AC12); Formatierungen
// stehen als Bereiche mit Positionen in UTF-16-Codeeinheiten im Baustein (REQ-136-AC8, API-Beschreibung ArticleSpan).

type Block = components['schemas']['ArticleBlock'];
type Text = components['schemas']['ArticleText'];

const imported = (slug: string) =>
  JSON.parse(readFileSync(new URL(`../../../backend/internal/service/topicarticles/${slug}.json`, import.meta.url), 'utf8')) as Record<'de' | 'en', Text>;
const roundTrip = (blocks: Block[]) => docToBlocks(blocksToDoc(blocks));
const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content });
const text = (value: string, ...marks: NonNullable<DocNode['marks']>): DocNode => ({ type: 'text', text: value, ...(marks.length && { marks }) });
const paragraph = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content });

describe('REQ-136-AC5: Öffnen und Speichern verändert den gespeicherten Inhalt nicht', () => {
  for (const slug of ['vibe-coding', 'softwareentwicklung']) {
    for (const lang of ['de', 'en'] as const) {
      it(`${slug} (${lang})`, () => {
        const { blocks } = imported(slug)[lang];
        expect(blocks.length).toBeGreaterThan(5);
        expect(roundTrip(blocks)).toEqual(blocks);
      });
    }
  }

  it('REQ-136-AC12: Bausteine aus #67 einschließlich Zeilenumbrüchen', () => {
    const blocks: Block[] = [
      { kind: 'paragraph', text: 'Anfang\nzweite Zeile' }, { kind: 'h1', text: 'Abschnitt' }, { kind: 'h2', text: 'Teil' }, { kind: 'h3', text: 'Detail' },
      { kind: 'image', src: '/media/1234567890abcdef1234567890abcdef-960.png', alt: 'Grafik', caption: 'Skizze' },
      { kind: 'image', src: '/media/1234567890abcdef1234567890abcdef-960.jpg', alt: 'Ohne Unterschrift' },
      { kind: 'info', text: 'Merksatz' }, { kind: 'quote', text: 'Wortlaut', attribution: 'Ada' }, { kind: 'quote', text: 'Ohne Quelle' },
      { kind: 'ordered', items: [{ title: 'A', description: 'Eins' }, { title: 'B' }] },
      { kind: 'unordered', items: [{ title: 'C' }] },
    ];
    expect(roundTrip(blocks)).toEqual(blocks);
  });

  it('alle Layout-Elemente mit und ohne optionale Angaben', () => {
    const blocks: Block[] = [
      { kind: 'lead', text: 'Einleitung' }, { kind: 'statement', text: 'Kernaussage' }, { kind: 'outline' },
      { kind: 'example', label: 'Beispiel', text: 'Fall' }, { kind: 'example', anchor: 'bsp', label: 'Beispiel', text: 'Fall' },
      { kind: 'section', eyebrow: 'Dach', text: 'Überschrift', blocks: [{ kind: 'paragraph', text: 'Inhalt' },
        { kind: 'image', src: '/artikelbild-harness.png', alt: 'Grafik', width: 1685, height: 542 }, { kind: 'unordered', items: [{ title: 'Punkt' }] }] },
      { kind: 'section', anchor: 'teil', text: 'Ohne Dachzeile', blocks: [{ kind: 'paragraph', text: 'Inhalt' }] },
      { kind: 'conclusion', anchor: 'fazit', eyebrow: 'Fazit', text: 'Schluss', blocks: [{ kind: 'paragraph', text: 'Ende' }] },
      { kind: 'related', label: 'Weiterlesen', text: 'Ziel', href: '/de/themen/vibe-coding' },
      { kind: 'quoteheading', anchor: 'weg', text: 'Zitat', attribution: 'Quelle' }, { kind: 'quoteheading', text: 'Zitat' },
      { kind: 'h1', anchor: 'kopf', text: 'Mit Sprungziel' },
      { kind: 'cta', anchor: 'meinung', text: 'Frage', description: 'Text', label: 'Los', href: '/de/kontakt' },
    ];
    expect(roundTrip(blocks)).toEqual(blocks);
  });
});

describe('REQ-136-AC8/AC9: Formatierung wird als Bereich im Baustein gespeichert', () => {
  const bold = { type: 'bold' }, italic = { type: 'italic' }, underline = { type: 'underline' };
  const link = (href: string) => ({ type: 'link', attrs: { href } });

  it('fett, kursiv, unterstrichen und Link mit Positionen in UTF-16-Codeeinheiten', () => {
    const blocks = docToBlocks(doc(paragraph(
      text('Größe 😀 '), text('fett', bold, italic, underline), text(' und '), text('Link', link('https://example.org/x')),
    )));
    expect(blocks).toEqual([{ kind: 'paragraph', text: 'Größe 😀 fett und Link', spans: [
      { start: 9, end: 13, bold: true, italic: true, underline: true }, { start: 18, end: 22, href: 'https://example.org/x' },
    ] }]);
    expect(roundTrip(blocks)).toEqual(blocks);
  });

  it('fasst benachbarte Textstücke gleicher Formatierung zusammen und zählt Zeilenumbrüche mit', () => {
    const blocks = docToBlocks(doc(paragraph(text('ab', bold), text('cd', bold), { type: 'hardBreak' }, text('ef', italic))));
    expect(blocks).toEqual([{ kind: 'paragraph', text: 'abcd\nef', spans: [{ start: 0, end: 4, bold: true }, { start: 5, end: 7, italic: true }] }]);
    expect(roundTrip(blocks)).toEqual(blocks);
  });

  it('Formatierung in Infobox, Zitat, Beispielkasten und Listeneinträgen', () => {
    const blocks: Block[] = [
      { kind: 'info', text: 'Merke dies', spans: [{ start: 6, end: 10, bold: true }] },
      { kind: 'quote', text: 'So ist es', attribution: 'Ada', spans: [{ start: 0, end: 2, italic: true }] },
      { kind: 'example', label: 'Beispiel', text: 'Ein Fall', spans: [{ start: 4, end: 8, underline: true }] },
      { kind: 'ordered', items: [{ title: 'Punkt eins', description: 'Mehr dazu', spans: [{ start: 6, end: 10, bold: true }],
        descriptionSpans: [{ start: 0, end: 4, href: '/de/kontakt' }] }] },
    ];
    expect(roundTrip(blocks)).toEqual(blocks);
  });

  it('REQ-136-AC9: nur https, http, mailto und Pfade der eigenen Webseite sind Linkziele', () => {
    const valid = ['https://example.org/x?y=1', 'http://example.org', 'mailto:info@example.org', '/de/kontakt', '/de/themen/vibe-coding#vc-prompt'];
    for (const href of valid) expect(normalizeHref(`  ${href} `), href).toBe(href);
    const invalid = ['', '   ', 'example.org', 'www.example.org', 'javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,x', '//example.org', 'ftp://example.org', 'https://', 'mailto:', '#abschnitt', '/de/ mit leerzeichen'];
    for (const href of invalid) expect(normalizeHref(href), href).toBeNull();
  });
});

describe('REQ-136-AC6/AC11: Dokument des Editors wird zu Bausteinen', () => {
  it('Stilauswahl: Absatz, Einleitung und drei Überschriftenebenen', () => {
    expect(docToBlocks(doc(
      { type: 'paragraph', attrs: { lead: true }, content: [text('Einleitung')] }, paragraph(text('Absatz')),
      { type: 'heading', attrs: { level: 1 }, content: [text('Eins')] }, { type: 'heading', attrs: { level: 2 }, content: [text('Zwei')] },
      { type: 'heading', attrs: { level: 3 }, content: [text('Drei')] },
    ))).toEqual([
      { kind: 'lead', text: 'Einleitung' }, { kind: 'paragraph', text: 'Absatz' },
      { kind: 'h1', text: 'Eins' }, { kind: 'h2', text: 'Zwei' }, { kind: 'h3', text: 'Drei' },
    ]);
  });

  it('lässt leere Absätze und leere Überschriften weg, auch in Abschnitten', () => {
    const empty = { type: 'paragraph' };
    expect(docToBlocks(doc(empty, paragraph(text('  ')), { type: 'heading', attrs: { level: 1 } }, paragraph(text('Text')), empty))).toEqual([{ kind: 'paragraph', text: 'Text' }]);
    expect(docToBlocks(doc({ type: 'section', content: [
      { type: 'labelSlot', attrs: { role: 'eyebrow' } }, { type: 'labelSlot', attrs: { role: 'heading' }, content: [text('Überschrift')] },
      { type: 'bodySlot', content: [empty, paragraph(text('Inhalt')), empty] },
    ] }))).toEqual([{ kind: 'section', text: 'Überschrift', blocks: [{ kind: 'paragraph', text: 'Inhalt' }] }]);
    expect(docToBlocks(doc(empty))).toEqual([]);
  });

  it('Listen: erster Absatz ist der Eintragstitel, weitere Absätze die Kurzbeschreibung', () => {
    const item = (...content: DocNode[]): DocNode => ({ type: 'listItem', content });
    expect(docToBlocks(doc(
      { type: 'bulletList', content: [item(paragraph(text('A'))), item(paragraph(text('B')), paragraph(text('Mehr')), paragraph(text('Noch mehr')))] },
      { type: 'orderedList', content: [item(paragraph(text('Eins'))), item({ type: 'paragraph' })] },
    ))).toEqual([
      { kind: 'unordered', items: [{ title: 'A' }, { title: 'B', description: 'Mehr\nNoch mehr' }] },
      { kind: 'ordered', items: [{ title: 'Eins' }] },
    ]);
  });

  it('ein leeres Dokument enthält einen leeren Absatz, damit der Editor eine Schreibmarke hat', () => {
    expect(blocksToDoc([])).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });
});
