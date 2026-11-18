import type { Lang } from './lang';

/**
 * Lesetempo für die Lesezeit der Themenartikel (#56, Entscheidung vom 18.11.2026). Es reproduziert die Referenz
 * „ca. 4 Min.“ für „KI in der Softwareentwicklung“. Blogbeiträge schätzen serverseitig mit 200 Wörtern pro Minute.
 */
export const WORDS_PER_MINUTE = 120;

/** Durch Leerraum getrennte Wörter aller Textabschnitte; weiche Trennstriche trennen keine Wörter. */
export function countWords(texts: readonly string[]): number {
  return texts.reduce((sum, text) => sum + (text.replace(/­/g, '').match(/\S+/g)?.length ?? 0), 0);
}

/** Geschätzte Lesezeit in ganzen Minuten, aufgerundet, mindestens eine Minute. */
export function readingMinutes(texts: readonly string[]): number {
  return Math.max(1, Math.ceil(countWords(texts) / WORDS_PER_MINUTE));
}

const LOCALE: Record<Lang, string> = { de: 'de-DE', en: 'en-GB' };
const UPDATED: Record<Lang, string> = { de: 'Stand', en: 'Updated' };

/** „Stand: 16. November 2026“ bzw. „Updated: 16 November 2026“ für ein ISO-Datum (JJJJ-MM-TT). */
export function formatUpdated(isoDate: string, lang: Lang): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)));
  return `${UPDATED[lang]}: ${date}`;
}

/** „ca. 4 Min. Lesezeit“ bzw. „approx. 4 min read“. */
export function formatReadingTime(minutes: number, lang: Lang): string {
  return lang === 'de' ? `ca. ${minutes} Min. Lesezeit` : `approx. ${minutes} min read`;
}
