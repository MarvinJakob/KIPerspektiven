/**
 * Zulässige Linkziele in Themenartikeln (REQ-136-AC9): Adressen mit https://, http:// oder mailto: sowie Pfade der
 * eigenen Webseite, die mit / beginnen. Liefert die bereinigte Adresse oder null. Das Backend prüft dieselbe Regel.
 */
export function normalizeHref(input: string): string | null {
  const href = input.trim();
  if (!href || /\s/.test(href)) return null;
  const scheme = /^(https?:\/\/|mailto:)/i.exec(href);
  if (scheme) return href.length > scheme[0].length ? href : null;
  return href.startsWith('/') && !href.startsWith('//') ? href : null;
}

export const HREF_HINT = 'Bitte eine Adresse mit https://, http:// oder mailto: angeben oder einen Pfad der Webseite, der mit / beginnt.';
