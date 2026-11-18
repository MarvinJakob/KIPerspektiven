import type { ReactNode, Ref } from 'react';

/**
 * Gemeinsamer Kopf redaktioneller Themenartikel (#61, DESIGN.md „Redaktionelle Themenartikel“):
 * zentrierter Titel nach der Vibe-Coding-Referenz, optionaler Untertitel und Autorenblock (#56).
 * Ohne Brotkrumen und ohne nummerierte Themenzeile; beim Öffnen erhält der Titel den Fokus (titleRef).
 */
export function ArticleHeader({ title, titleId, titleRef, subtitle, byline }: {
  title: string;
  titleId?: string;
  titleRef: Ref<HTMLHeadingElement>;
  subtitle?: string;
  /** Autorenblock (ArticleByline). */
  byline: ReactNode;
}) {
  return (
    <header className="article-head">
      <div className="container">
        <div className="article-head-copy">
          <h1 id={titleId} ref={titleRef} tabIndex={-1}>{title}</h1>
          {subtitle && <p className="article-subtitle">{subtitle}</p>}
          {byline}
        </div>
      </div>
    </header>
  );
}
