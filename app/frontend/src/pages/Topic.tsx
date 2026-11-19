import { useParams } from 'react-router';
import { isNotFound, useTopic } from '../api/client';
import { Art } from '../components/Art';
import { TopicContent } from '../components/TopicContent';
import { AUDIT_TOPIC } from '../lib/audit';
import { PostList } from '../components/PostRow';
import { EmptyPosts, LoadError, Loading, TranslationNotice } from '../components/Status';
import { useLang } from '../lib/lang';
import { useHead, usePageFocus } from '../lib/page';
import { getTopicContent } from '../lib/topicContent';
import { NotFound } from './NotFound';
import { Readiness } from './Readiness';
import { SoftwareDevelopment } from './SoftwareDevelopment';
import { VibeCoding } from './VibeCoding';

/** Thema mit eigener Artikelseite nach Mock (#7) statt Einführung, Markdown-Inhalt und Beitragsliste. */
const SOFTWARE_DEVELOPMENT = 'softwareentwicklung';

/** Erlaubt nach „/“ einen Zeilenumbruch, etwa in „Preis-/Leistungsverhältnis“, ohne den Text zu verändern. */
const breakAfterSlash = (text: string) =>
  text.split(/(?<=\/)/).flatMap((part, i) => (i ? [<wbr key={i} />, part] : [part]));

/**
 * Themenseite mit Titel, Einführung und zugeordneten veröffentlichten Beiträgen (Anforderung 3).
 * Das Thema `ai-audit` (KI Readiness) hat wie die Artikelthemen eine eigene Seite (Ticket #115).
 */
export function TopicPage() {
  const { slug = '' } = useParams();
  const { lang, t } = useLang();
  const h1 = usePageFocus<HTMLHeadingElement>();
  const topic = useTopic(slug, lang);
  useHead(topic.data?.title, topic.data?.intro);

  if (topic.isPending) return <Loading />;
  if (isNotFound(topic.error)) return <NotFound />;
  if (topic.isError) return <LoadError onRetry={() => void topic.refetch()} />;

  const tp = topic.data;
  if (tp.slug === SOFTWARE_DEVELOPMENT) return <SoftwareDevelopment titleRef={h1} />;
  if (tp.slug === 'vibe-coding') return <VibeCoding titleRef={h1} />;
  if (tp.slug === AUDIT_TOPIC) return <Readiness titleRef={h1} />;
  const fallback = tp.lang !== lang;
  const contentLang = fallback ? tp.lang : undefined;
  const content = getTopicContent(tp.slug, lang);

  return (
    <div className="container">
      <section className="topic-hero">
        <div lang={contentLang}>
          <p className="eyebrow">{t('topic.eyebrow')}</p>
          <h1 className="page-title" tabIndex={-1} ref={h1}>
            {breakAfterSlash(tp.title)}
          </h1>
          {content?.subtitle && <p className="topic-subtitle">{breakAfterSlash(content.subtitle)}</p>}
          <p className="lead">{tp.intro}</p>
          {fallback && <TranslationNotice text={t('fallbackTopic', { language: t(`langName.${tp.lang}`) })} />}
        </div>
        <Art topic={tp.slug} seed={1} />
      </section>
      {content && <TopicContent content={content} />}
      <section className="section" aria-labelledby="topicPosts">
        <div className="section-head">
          <h2 className="section-title" id="topicPosts">
            {t('topic.posts')}
          </h2>
          {tp.posts.length > 0 && <p className="count">{t('count', { count: tp.posts.length })}</p>}
        </div>
        {tp.posts.length > 0 ? <PostList posts={tp.posts} /> : <EmptyPosts text={t('empty.topicText')} />}
      </section>
    </div>
  );
}
