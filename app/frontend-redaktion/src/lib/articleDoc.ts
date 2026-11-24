import type { components } from '../api/schema';

/**
 * Umwandlung zwischen den gespeicherten Bausteinen eines Themenartikels und dem Dokument des WYSIWYG-Editors
 * (Ticket #136). Die Bausteine bleiben das gespeicherte Format; Öffnen und Speichern ohne Änderung ergibt wieder
 * dieselben Bausteine (REQ-136-AC5). Die Knotennamen entsprechen den Erweiterungen in components/editor.
 */
type Block = components['schemas']['ArticleBlock'];
type Entry = components['schemas']['ArticleEntry'];
type Span = components['schemas']['ArticleSpan'];

export interface DocMark {
  type: string;
  attrs?: Record<string, unknown>;
}
export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: DocMark[];
}

type Format = Omit<Span, 'start' | 'end'>;

/** Entfernt nicht gesetzte Angaben, damit optionale Felder im Baustein fehlen statt leer zu sein. */
function compact<T extends object>(value: T): T {
  const out = {} as Record<string, unknown>;
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    if (Array.isArray(v) && v.length === 0 && key !== 'blocks') continue;
    out[key] = v;
  }
  return out as T;
}

const marksOf = (format: Format): DocMark[] => [
  ...(format.bold ? [{ type: 'bold' }] : []),
  ...(format.italic ? [{ type: 'italic' }] : []),
  ...(format.underline ? [{ type: 'underline' }] : []),
  ...(format.href ? [{ type: 'link', attrs: { href: format.href } }] : []),
];

function formatOf(marks: DocMark[] = []): Format {
  const format: Format = {};
  for (const mark of marks) {
    if (mark.type === 'bold') format.bold = true;
    else if (mark.type === 'italic') format.italic = true;
    else if (mark.type === 'underline') format.underline = true;
    else if (mark.type === 'link' && typeof mark.attrs?.href === 'string') format.href = mark.attrs.href;
  }
  return format;
}

const sameFormat = (a: Format, b: Format) => !a.bold === !b.bold && !a.italic === !b.italic && !a.underline === !b.underline && (a.href ?? '') === (b.href ?? '');
const hasFormat = (f: Format) => Boolean(f.bold || f.italic || f.underline || f.href);

/** Text mit Formatierungsbereichen als Inhalt eines Textknotens; Zeilenumbrüche werden zu harten Umbrüchen. */
function inline(text = '', spans: Span[] = []): DocNode[] | undefined {
  const nodes: DocNode[] = [];
  const push = (part: string, format: Format) => {
    part.split('\n').forEach((line, index) => {
      if (index) nodes.push({ type: 'hardBreak' });
      if (!line) return;
      const marks = marksOf(format);
      nodes.push({ type: 'text', text: line, ...(marks.length && { marks }) });
    });
  };
  let at = 0;
  for (const span of spans) {
    if (span.start < at || span.end <= span.start || span.end > text.length) continue;
    push(text.slice(at, span.start), {});
    push(text.slice(span.start, span.end), span);
    at = span.end;
  }
  push(text.slice(at), {});
  return nodes.length ? nodes : undefined;
}

/** Text und Formatierungsbereiche eines Textknotens. Positionen zählen UTF-16-Codeeinheiten. */
function readInline(nodes: DocNode[] = []): { text: string; spans: Span[] } {
  let text = '';
  const spans: Span[] = [];
  let open: (Span & Format) | undefined;
  const close = () => {
    if (open) spans.push(open);
    open = undefined;
  };
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      close();
      text += '\n';
      continue;
    }
    if (node.type !== 'text' || !node.text) continue;
    const format = formatOf(node.marks);
    if (open && sameFormat(open, format)) open.end += node.text.length;
    else {
      close();
      if (hasFormat(format)) open = { start: text.length, end: text.length + node.text.length, ...format };
    }
    text += node.text;
  }
  close();
  return { text, spans };
}

const plain = (node?: DocNode) => readInline(node?.content).text.trim();
const label = (role: string, text?: string): DocNode => ({ type: 'labelSlot', attrs: { role }, ...(text && { content: [{ type: 'text', text }] }) });
const rich = (role: string, text?: string, spans?: Span[]): DocNode => {
  const content = inline(text, spans);
  return { type: 'richSlot', attrs: { role }, ...(content && { content }) };
};
const attrs = (value: Record<string, unknown>) => {
  const set = compact(value);
  return Object.keys(set).length ? { attrs: set } : {};
};
const paragraph = (text?: string, spans?: Span[], extra: Record<string, unknown> = {}): DocNode => {
  const content = inline(text, spans);
  return { type: 'paragraph', ...attrs(extra), ...(content && { content }) };
};

/** Listeneintrag: Titel und Kurzbeschreibung stehen in einem Absatz, getrennt durch einen Zeilenumbruch. */
function entryNode(entry: Entry): DocNode {
  if (!entry.description) return { type: 'listItem', content: [paragraph(entry.title, entry.spans)] };
  const offset = entry.title.length + 1;
  const spans = [...(entry.spans ?? []), ...(entry.descriptionSpans ?? []).map((s) => ({ ...s, start: s.start + offset, end: s.end + offset }))];
  return { type: 'listItem', content: [paragraph(entry.title + '\n' + entry.description, spans)] };
}

function blockNode(block: Block): DocNode {
  const body = (): DocNode => ({ type: 'bodySlot', content: block.blocks?.length ? block.blocks.map(blockNode) : [{ type: 'paragraph' }] });
  switch (block.kind) {
    case 'paragraph': return paragraph(block.text, block.spans);
    case 'lead': return paragraph(block.text, block.spans, { lead: true });
    case 'h1':
    case 'h2':
    case 'h3': {
      const content = inline(block.text);
      return { type: 'heading', attrs: compact({ level: Number(block.kind[1]), anchor: block.anchor }), ...(content && { content }) };
    }
    case 'info': {
      const content = inline(block.text, block.spans);
      return { type: 'infoBox', ...(content && { content }) };
    }
    case 'quote': return { type: 'quote', content: [rich('quote', block.text, block.spans), label('source', block.attribution)] };
    case 'image': return { type: 'image', attrs: compact({ src: block.src, alt: block.alt, caption: block.caption, width: block.width, height: block.height, anchor: block.anchor }) };
    case 'ordered':
    case 'unordered': return { type: block.kind === 'ordered' ? 'orderedList' : 'bulletList', content: (block.items ?? []).map(entryNode) };
    case 'example': return { type: 'example', ...attrs({ anchor: block.anchor }), content: [label('label', block.label), rich('text', block.text, block.spans)] };
    case 'statement': {
      const content = inline(block.text);
      return { type: 'statement', ...(content && { content }) };
    }
    case 'outline': return { type: 'outline' };
    case 'section':
    case 'conclusion': return { type: block.kind, ...attrs({ anchor: block.anchor }), content: [label('eyebrow', block.eyebrow), label('heading', block.text), body()] };
    case 'related': return { type: 'related', ...attrs({ href: block.href }), content: [label('label', block.label), label('title', block.text)] };
    case 'quoteheading': return { type: 'quoteHeading', ...attrs({ anchor: block.anchor }), content: [label('text', block.text), label('source', block.attribution)] };
    case 'cta': return { type: 'cta', ...attrs({ href: block.href, anchor: block.anchor }), content: [label('heading', block.text), label('text', block.description), label('button', block.label)] };
  }
}

/** Dokument des Editors für gespeicherte Bausteine. Ein leerer Artikel erhält einen leeren Absatz. */
export function blocksToDoc(blocks: Block[]): DocNode {
  return { type: 'doc', content: blocks.length ? blocks.map(blockNode) : [{ type: 'paragraph' }] };
}

const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
const number = (value: unknown) => (typeof value === 'number' && value > 0 ? value : undefined);
const slot = (node: DocNode, role: string) => node.content?.find((child) => child.attrs?.role === role);

function readEntry(item: DocNode): Entry | undefined {
  const [first, ...rest] = (item.content ?? []).filter((child) => child.type === 'paragraph');
  const head = readInline(first?.content);
  // Die erste Zeile ist der Eintragstitel. Weitere Zeilen und Absätze bilden die Kurzbeschreibung;
  // ihre Formatierungsbereiche verschieben sich um den Text davor.
  const cut = head.text.indexOf('\n');
  const title = cut < 0 ? head.text : head.text.slice(0, cut);
  if (!title.trim()) return undefined;
  const parts = [
    ...(cut < 0 ? [] : [{ text: head.text.slice(cut + 1), spans: head.spans.filter((s) => s.start > cut).map((s) => ({ ...s, start: s.start - cut - 1, end: s.end - cut - 1 })) }]),
    ...rest.map((p) => readInline(p.content)),
  ].filter((part) => part.text.trim());
  let description = '';
  const descriptionSpans: Span[] = [];
  for (const part of parts) {
    if (description) description += '\n';
    descriptionSpans.push(...part.spans.map((s) => ({ ...s, start: s.start + description.length, end: s.end + description.length })));
    description += part.text;
  }
  return compact({ title, description, spans: cut < 0 ? head.spans : head.spans.filter((s) => s.end <= cut), descriptionSpans });
}

function readBlock(node: DocNode): Block | undefined {
  const a = node.attrs ?? {};
  const body = () => (slot(node, 'body')?.content ?? node.content?.find((c) => c.type === 'bodySlot')?.content ?? []).map(readBlock).filter((b): b is Block => Boolean(b));
  switch (node.type) {
    case 'paragraph': {
      const { text: value, spans } = readInline(node.content);
      return value.trim() ? compact({ kind: a.lead ? 'lead' as const : 'paragraph' as const, text: value, spans }) : undefined;
    }
    case 'heading': {
      const value = readInline(node.content).text;
      const level = Math.min(3, Math.max(1, Number(a.level) || 1));
      return value.trim() ? compact({ kind: `h${level}` as 'h1' | 'h2' | 'h3', anchor: text(a.anchor), text: value }) : undefined;
    }
    case 'infoBox': {
      const { text: value, spans } = readInline(node.content);
      return value.trim() ? compact({ kind: 'info' as const, text: value, spans }) : undefined;
    }
    case 'quote': {
      const { text: value, spans } = readInline(slot(node, 'quote')?.content);
      const attribution = plain(slot(node, 'source'));
      return value.trim() || attribution ? compact({ kind: 'quote' as const, text: value, attribution, spans }) : undefined;
    }
    case 'image':
      return text(a.src) ? compact({ kind: 'image' as const, src: text(a.src), alt: text(a.alt), caption: text(a.caption), width: number(a.width), height: number(a.height), anchor: text(a.anchor) }) : undefined;
    case 'bulletList':
    case 'orderedList': {
      const items = (node.content ?? []).map(readEntry).filter((item): item is Entry => Boolean(item));
      return items.length ? { kind: node.type === 'orderedList' ? 'ordered' : 'unordered', items } : undefined;
    }
    case 'example': {
      const { text: value, spans } = readInline(slot(node, 'text')?.content);
      const caption = plain(slot(node, 'label'));
      return value.trim() || caption ? compact({ kind: 'example' as const, anchor: text(a.anchor), label: caption, text: value, spans }) : undefined;
    }
    case 'statement': {
      const value = readInline(node.content).text;
      return value.trim() ? { kind: 'statement', text: value } : undefined;
    }
    case 'outline': return { kind: 'outline' };
    case 'section':
    case 'conclusion': {
      const blocks = body();
      const eyebrow = plain(slot(node, 'eyebrow')), heading = plain(slot(node, 'heading'));
      if (!eyebrow && !heading && !blocks.length) return undefined;
      return { ...compact({ kind: node.type, anchor: text(a.anchor), eyebrow, text: heading }), blocks };
    }
    case 'related': {
      const caption = plain(slot(node, 'label')), title = plain(slot(node, 'title'));
      return caption || title || text(a.href) ? compact({ kind: 'related' as const, label: caption, text: title, href: text(a.href) }) : undefined;
    }
    case 'quoteHeading': {
      const value = plain(slot(node, 'text')), attribution = plain(slot(node, 'source'));
      return value || attribution ? compact({ kind: 'quoteheading' as const, anchor: text(a.anchor), text: value, attribution }) : undefined;
    }
    case 'cta': {
      const heading = plain(slot(node, 'heading')), description = plain(slot(node, 'text')), button = plain(slot(node, 'button'));
      return heading || description || button || text(a.href)
        ? compact({ kind: 'cta' as const, anchor: text(a.anchor), text: heading, description, label: button, href: text(a.href) })
        : undefined;
    }
    default: return undefined;
  }
}

/** Bausteine für das Dokument des Editors. Leere Absätze, Überschriften und Elemente entfallen. */
export function docToBlocks(doc: DocNode): Block[] {
  return (doc.content ?? []).map(readBlock).filter((block): block is Block => Boolean(block));
}
