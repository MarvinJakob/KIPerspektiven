import { formatReadingTime, formatUpdated, readingMinutes } from '../lib/articleMeta';
import { useLang } from '../lib/lang';

/**
 * Metadatenblock im Kopf eines Themenartikels (#56): links rundes Porträt, rechts der Name,
 * darunter Stand und Lesezeit des angezeigten Artikeltexts, getrennt durch einen Mittelpunkt.
 */
export function ArticleByline({ author, portrait, updated, text }: {
  author: string;
  portrait: string;
  /** Datum des veröffentlichten redaktionellen Stands, ISO JJJJ-MM-TT. */
  updated: string;
  /** Sichtbare Textabschnitte des Artikels, aus denen die Lesezeit geschätzt wird. */
  text: readonly string[];
}) {
  const { lang } = useLang();
  return (
    <div className="byline">
      <img src={portrait} alt="" width={44} height={44} />
      <p>
        <strong>{author}</strong>
        <span className="byline-meta">
          <time dateTime={updated}>{formatUpdated(updated, lang)}</time>
          <span aria-hidden="true"> · </span>
          <span>{formatReadingTime(readingMinutes(text), lang)}</span>
        </span>
      </p>
    </div>
  );
}
