import type { components } from '../api/schema';

type Block = components['schemas']['ArticleBlock'];
type ArticleText = components['schemas']['ArticleText'];

/**
 * Zulässige Linkziele in Themenartikeln (REQ-136-AC9): https, http, mailto und Pfade der eigenen Webseite.
 * Das Backend prüft dieselbe Regel beim Speichern; die Darstellung gibt andere Ziele nicht als Link aus.
 */
export function safeHref(href: string): string | null {
  if (!href || /\s/.test(href)) return null;
  const scheme = /^(https?:\/\/|mailto:)/i.exec(href);
  if (scheme) return href.length > scheme[0].length ? href : null;
  return href.startsWith('/') && !href.startsWith('//') ? href : null;
}

function blockText(block: Block): string[] {
  // Beschriftungen von Beispielkästen und Schaltflächen sowie Alternativtexte zählen nicht zum Lesetext.
  const label = block.kind === 'related' ? block.label : undefined;
  return [
    block.eyebrow, label, block.text, block.attribution, block.description, block.caption,
    ...(block.items ?? []).flatMap((item) => [item.title, item.description]),
    ...(block.blocks ?? []).flatMap(blockText),
  ].filter((part): part is string => Boolean(part));
}

/** Sichtbarer Text eines Themenartikels für die Lesezeit (#56, REQ-136-AC15): Titel, Untertitel und Bausteine. */
export function articleReadingText(content: ArticleText): string[] {
  return [content.title, content.subtitle ?? '', ...content.blocks.flatMap(blockText)].filter(Boolean);
}
