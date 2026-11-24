import Markdown from 'react-markdown';
import { Link, useParams } from 'react-router';
import { isNotFound, usePost, useTopic } from '../api/client';
import { Art } from '../components/Art';
import { Icon } from '../components/Icon';
import { PostAuthor } from '../components/PostAuthor';
import { PostList, TopicChip } from '../components/PostRow';
import { LoadError, Loading, TranslationNotice } from '../components/Status';
import { href, useLang } from '../lib/lang';
import { formatDate, useHead, usePageFocus } from '../lib/page';
import { NotFound } from './NotFound';

/** Beitragsseite mit Titel, Datum und vollständigem Inhalt (Anforderungen 4 und 7). */
export function PostPage() {
  const { slug = '' } = useParams();
  const { lang, t } = useLang();
  const h1 = usePageFocus<HTMLHeadingElement>();
  const post = usePost(slug, lang);
  useHead(post.data?.title, post.data?.summary);

  if (post.isPending) return <Loading />;
  // Entwürfe liefert das Backend wie unbekannte Beiträge mit 404 (Anforderung 4).
  if (isNotFound(post.error)) return <NotFound />;
  if (post.isError) return <LoadError onRetry={() => void post.refetch()} />;

  const p = post.data;
  const fallback = p.lang !== lang;
  const contentLang = fallback ? p.lang : undefined;
  const main = p.topics[0];

  return (
    <>
      {/* Kopf, Titelbild und Text nutzen den Inhaltsrahmen der Seite (.container, Ticket #138). */}
      <article>
        <div className="container">
          <Link className="back-link" to={href(lang, '/blog')}>
            <Icon name="chevLeft" /> {t('backToBlog')}
          </Link>
          <header className="post-head">
            <div className="chips">
              {p.topics.map((tp) => (
                <TopicChip key={tp.slug} topic={tp} />
              ))}
            </div>
            <h1 className="page-title" tabIndex={-1} ref={h1} lang={contentLang}>
              {p.title}
            </h1>
            <p className="article-meta">
              <time dateTime={p.publishedAt}>{formatDate(p.publishedAt, lang)}</time>
              <span aria-hidden="true">·</span>
              <span>{t('minRead', { n: p.readingMinutes })}</span>
            </p>
            <PostAuthor author={p.author} />
          </header>
          {fallback && <TranslationNotice text={t('fallbackPost', { language: t(`langName.${p.lang}`) })} />}
        </div>
        {/* Ohne Titelbild entfällt die Bildfläche ersatzlos (REQ-138-AC4). */}
        {p.cover && (
          <div className="container post-cover">
            <Art image={p.cover} eager sizes="(max-width: 1336px) 100vw, 1240px" />
          </div>
        )}
        <div className="container prose" lang={contentLang}>
          {/* Markdown ohne rohes HTML (ARCHITECTURE.md, Abschnitt 3) */}
          <Markdown skipHtml>{p.bodyMarkdown}</Markdown>
        </div>
      </article>
      {main && <Related topicSlug={main.slug} topicLabel={main.label} currentSlug={p.slug} />}
    </>
  );
}

function Related({ topicSlug, topicLabel, currentSlug }: { topicSlug: string; topicLabel: string; currentSlug: string }) {
  const { lang, t } = useLang();
  const topic = useTopic(topicSlug, lang);
  const related = (topic.data?.posts ?? []).filter((p) => p.slug !== currentSlug).slice(0, 2);
  if (related.length === 0) return null;
  return (
    <section className="container section" aria-labelledby="relatedHeading">
      <div className="section-head">
        <h2 className="section-title" id="relatedHeading">
          {t('related', { topic: topicLabel })}
        </h2>
        <Link className="text-link" to={href(lang, `/themen/${topicSlug}`)}>
          {t('toTopic')} <Icon name="arrowRight" />
        </Link>
      </div>
      <PostList posts={related} />
    </section>
  );
}
