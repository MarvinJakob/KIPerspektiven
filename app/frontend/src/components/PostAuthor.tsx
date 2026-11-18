import type { components } from '../api/schema';
import { useLang } from '../lib/lang';

export type Author = components['schemas']['PostAuthor'];

const LABEL = { de: 'Autor:', en: 'Author:' } as const;

/**
 * Autorenzeile redaktioneller Beiträge (Ticket #64): rundes Profilbild und gepflegter Name. Die API liefert keine
 * E-Mail-Adresse. Ohne Autor oder ohne Namen erscheint nichts, ohne Profilbild nur der Name.
 */
export function PostAuthor({ author }: { author?: Author }) {
  const { lang } = useLang();
  const name = author?.name.trim();
  if (!author || !name) return null;
  return (
    <p className="post-author byline">
      {author.avatar && <img src={author.avatar.src} alt="" width={44} height={44} loading="lazy" decoding="async" />}
      <span>
        <span className="sr-only">{LABEL[lang]} </span>
        <strong>{name}</strong>
      </span>
    </p>
  );
}
