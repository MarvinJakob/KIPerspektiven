import type { ReactNode, Ref } from 'react';
import type { components } from '../api/schema';
import { articleReadingText } from '../lib/articleText';
import { ArticleBlocks } from './ArticleBlocks';
import { ArticleByline } from './ArticleByline';
import { ArticleHeader } from './ArticleHeader';
import '../pages/Article.css';

type Article = components['schemas']['PublishedArticle'];

/**
 * Veröffentlichter Themenartikel (#67, #136): gemeinsamer Artikelkopf mit Autor, Stand und Lesezeit (#56),
 * darunter der Inhalt im Layout des Artikels. `notice` erscheint zwischen Kopf und Inhalt, etwa beim Sprach-Fallback.
 */
export function ArticleView({ article, titleRef, notice }: { article: Article; titleRef: Ref<HTMLHeadingElement>; notice?: ReactNode }) {
  const { content, lang, authorName, authorAvatar, updated } = article;
  return (
    <article lang={lang}>
      <ArticleHeader
        title={content.title}
        titleRef={titleRef}
        subtitle={content.subtitle}
        byline={<ArticleByline author={authorName} portrait={authorAvatar?.src} updated={updated} text={articleReadingText(content)} />}
      />
      {notice}
      <ArticleBlocks blocks={content.blocks} layout={content.layout} />
    </article>
  );
}
