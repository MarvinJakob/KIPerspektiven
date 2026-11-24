import { useParams } from 'react-router';
import { isNotFound, useArticle } from '../api/client';
import { ArticleView } from '../components/ArticleView';
import { LoadError, Loading, TranslationNotice } from '../components/Status';
import { useLang } from '../lib/lang';
import { useHead, usePageFocus } from '../lib/page';
import { NotFound } from './NotFound';

export function ArticlePage() {
  const { id } = useParams();
  const { lang, t } = useLang();
  const article = useArticle(Number(id), lang);
  const heading = usePageFocus<HTMLHeadingElement>();
  useHead(article.data?.content.title, article.data?.content.subtitle ?? '');
  if (article.isPending) return <Loading />;
  if (isNotFound(article.error)) return <NotFound />;
  if (!article.data) return <LoadError onRetry={() => void article.refetch()} />;
  const language = article.data.lang;
  return (
    <ArticleView
      article={article.data}
      titleRef={heading}
      notice={language !== lang && (
        <div className="article" lang={lang}>
          <TranslationNotice text={t('fallbackPost', { language: t(`langName.${language}`) })} />
        </div>
      )}
    />
  );
}
