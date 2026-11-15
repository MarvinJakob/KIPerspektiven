import { Link } from 'react-router';
import { Icon } from '../components/Icon';
import { TopicContent } from '../components/TopicContent';
import source from '../content/features/ki-verstehen.de.md?raw';
import { href, useLang } from '../lib/lang';
import { useHead, usePageFocus } from '../lib/page';

export const understandAiTitle = 'KI verstehen';
export const understandAiDescription = 'Wie Sprachmodelle und KI-Agenten funktionieren und wie fünf Disziplinen helfen, bessere KI-Ergebnisse zu erreichen.';

// Die H1 steht im Seitenkopf; der übrige Text bleibt vollständig wie in der Vorlage.
export const understandAiBody = source.slice(source.indexOf('\n') + 1).trim();

/** Eigene Inhaltsseite; bis zur Übersetzung gilt auch unter /en der deutsche Sprach-Fallback. */
export function UnderstandAi() {
  const { lang, t } = useLang();
  const h1 = usePageFocus<HTMLHeadingElement>();
  useHead(understandAiTitle, understandAiDescription);

  return (
    <div className="container feature-page">
      <header className="intro feature-intro">
        <Link className="back-link" to={href(lang)}>
          <Icon name="chevLeft" /> {t('nav.home')}
        </Link>
        <h1 className="page-title" lang="de" tabIndex={-1} ref={h1}>{understandAiTitle}</h1>
      </header>
      <TopicContent content={{ body: understandAiBody, lang: 'de', subtitle: undefined }} />
    </div>
  );
}
