import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePostFeed } from '../api/client';
import { PostList } from '../components/PostRow';
import { EmptyPosts, LoadError, Loading } from '../components/Status';
import { useLang } from '../lib/lang';
import { useHead, usePageFocus } from '../lib/page';

/**
 * Blogübersicht: veröffentlichte Beiträge, neueste zuerst (Anforderung 4). Seit Ticket #75 portionsweise:
 * Am Listenende lädt die Seite automatisch nach; alternativ per Schaltfläche.
 */
export function Blog() {
  const { lang, t } = useLang();
  const h1 = usePageFocus<HTMLHeadingElement>();
  const feed = usePostFeed(lang);
  useHead(t('blog.title'), t('blog.description'));
  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);

  return (
    <div className="container">
      <section className="intro">
        <h1 className="page-title" tabIndex={-1} ref={h1}>
          {t('blog.title')}
        </h1>
        <p className="lead">{t('blog.lead')}</p>
      </section>
      {feed.isPending ? (
        <Loading />
      ) : feed.data === undefined ? (
        <LoadError onRetry={() => void feed.refetch()} />
      ) : posts.length > 0 ? (
        <Feed feed={feed} count={posts.length}>
          <PostList posts={posts} headingLevel={2} />
        </Feed>
      ) : (
        <EmptyPosts text={t('empty.blogText')} showBlogLink={false} />
      )}
    </div>
  );
}

type FeedQuery = ReturnType<typeof usePostFeed>;

/** Liste mit Nachladen am Listenende, Lade-Schaltfläche, Ladestatus und Fehlermeldung (REQ-75-AC3 bis AC6). */
function Feed({ feed, count, children }: { feed: FeedQuery; count: number; children: ReactNode }) {
  const { t } = useLang();
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = feed;
  const listRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  // Synchrone Sperre: Mehrere Meldungen „Listenende erreicht“ vor dem nächsten Rendern lösen nur einen Abruf aus.
  const inflight = useRef(false);
  // Nach Laden per Schaltfläche erhält der erste neue Beitrag den Fokus (Index in der Gesamtliste).
  const [focusAt, setFocusAt] = useState<number | null>(null);

  const load = useCallback(
    (viaButton: boolean) => {
      if (inflight.current || !hasNextPage) return;
      inflight.current = true;
      const before = count;
      // cancelRefetch: false – ein laufender Abruf wird weder abgebrochen noch doppelt gestartet.
      void fetchNextPage({ cancelRefetch: false }).then((r) => {
        inflight.current = false;
        if (viaButton && !r.isFetchNextPageError) setFocusAt(before);
      });
    },
    [count, fetchNextPage, hasNextPage],
  );
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  // Automatisches Nachladen nur, solange weitere Beiträge folgen und kein Fehler ansteht. Nach jeder neuen
  // Portion wird neu beobachtet, damit ein weiterhin sichtbares Listenende erneut auslöst.
  const auto = hasNextPage && !isFetchNextPageError;
  useEffect(() => {
    const el = sentinel.current;
    if (!auto || !el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadRef.current(false);
      },
      { rootMargin: '0px 0px 200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [auto, count]);

  useEffect(() => {
    if (focusAt === null) return;
    const link = listRef.current?.querySelectorAll<HTMLAnchorElement>('a.post-row')[focusAt];
    if (link) {
      link.focus();
      setFocusAt(null);
    }
  }, [focusAt, count]);

  return (
    <div ref={listRef}>
      {children}
      <div className="feed-more">
        <p className="loading" role="status">
          {isFetchingNextPage ? t('blog.loadingMore') : ''}
        </p>
        {isFetchNextPageError ? (
          <div className="feed-error" role="alert">
            <p>{t('blog.moreError')}</p>
            <button className="btn btn-secondary press" type="button" onClick={() => load(true)}>
              {t('error.retry')}
            </button>
          </div>
        ) : (
          hasNextPage && (
            <>
              <div ref={sentinel} className="feed-sentinel" aria-hidden="true" />
              <button
                className="btn btn-secondary press"
                type="button"
                aria-disabled={isFetchingNextPage || undefined}
                onClick={() => load(true)}
              >
                {t('blog.more')}
              </button>
            </>
          )
        )}
      </div>
    </div>
  );
}
