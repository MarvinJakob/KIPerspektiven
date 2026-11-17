import type { Ref } from 'react';
import { Link } from 'react-router';
import portrait from '../assets/marvin-jakob.jpg';
import processDE from '../assets/topics/development-process_de.png';
import processEN from '../assets/topics/development-process_en.png';
import releaseDE from '../assets/topics/releasegate_de.png';
import releaseEN from '../assets/topics/releasegate_en.png';
import { Icon } from '../components/Icon';
import { CONTACT_PATH, softwareDevelopment, VIBE_CODING_PATH } from '../i18n/softwareDevelopment';
import { href, useLang, type Lang } from '../lib/lang';

/** Sprungziel der Startseite für „Themen“ und „Alle Themen“ (Home.tsx). */
const TOPICS_ID = 'themen';

/** Unveränderte Originalgrafiken (res/) als Vite-Assets mit Dateihash, je Sprache. */
export const softwareDevelopmentImages: Record<Lang, { process: string; release: string }> = {
  de: { process: processDE, release: releaseDE },
  en: { process: processEN, release: releaseEN },
};

/** Grafik mit Link zur Originalgröße in einem neuen Tab, wie im Mock. */
function Diagram({ src, alt, open, width, height }: { src: string; alt: string; open: string; width: number; height: number }) {
  return (
    <figure className="article-figure">
      <a href={src} target="_blank" rel="noopener" aria-label={open}>
        <img src={src} alt={alt} width={width} height={height} loading="lazy" />
      </a>
    </figure>
  );
}

/**
 * Themenseite Softwareentwicklung nach mock/software_development (#7): Hero mit Breadcrumb, Autor, Stand und
 * Lesezeit → Artikel mit beiden Grafiken → Meinungsaufruf → weitere Themen.
 */
export function SoftwareDevelopment({ titleRef }: { titleRef: Ref<HTMLHeadingElement> }) {
  const { lang } = useLang();
  const c = softwareDevelopment[lang];
  const images = softwareDevelopmentImages[lang];
  const topicsHref = `${href(lang)}#${TOPICS_ID}`;

  return (
    <div className="sd-page" lang={lang}>
      <section className="article-hero" aria-labelledby="sd-title">
        <div className="container">
          <nav className="article-crumbs" aria-label={c.breadcrumbLabel}>
            <Link to={topicsHref}>{c.topics}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{c.current}</span>
          </nav>
          <div className="article-hero-copy">
            <p className="eyebrow">
              <span className="topic-number">02</span> {c.eyebrow}
            </p>
            <h1 id="sd-title" tabIndex={-1} ref={titleRef}>
              {c.title}
            </h1>
            <div className="byline">
              <img src={portrait} alt="" width={44} height={44} />
              <p>
                <strong>{c.author}</strong>
                <span className="byline-meta">
                  <span>{c.updated}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{c.readingTime}</span>
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container article-layout">
        <article className="article-body">
          <section aria-labelledby="moderne-softwareentwicklung">
            <h2 id="moderne-softwareentwicklung">{c.modernTitle}</h2>
            <p className="article-lead">{c.modern[0]}</p>
            <Link className="related-link" to={href(lang, VIBE_CODING_PATH)}>
              <span className="related-label">{c.relatedLabel}</span>
              <span className="related-title">{c.relatedTitle}</span>
              <Icon name="arrowRight" />
            </Link>
            <p>{c.modern[1]}</p>
          </section>

          <section aria-labelledby="der-weg">
            <h2 id="der-weg" className="quote-heading">
              <span className="quote-mark" aria-hidden="true">“</span>
              {c.wayTitle}
              <small>{c.wayAuthor}</small>
            </h2>
            <p>{c.way}</p>
          </section>

          <Diagram src={images.process} {...c.processFigure} width={1602} height={833} />

          <section id="drei-teams" aria-label={c.teamsLabel}>
            <p>{c.teams}</p>
          </section>

          <Diagram src={images.release} {...c.releaseFigure} width={1521} height={576} />

          <section id="release-gate" aria-label={c.releaseLabel}>
            <p>{c.release}</p>
          </section>

          <section className="opinion" id="meinung" aria-labelledby="opinion-title">
            <svg className="opinion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true">
              <path d="M4 5h16v11H9l-5 4V5Z" />
            </svg>
            <div>
              <h2 id="opinion-title">{c.opinionTitle}</h2>
              <p>{c.opinionText}</p>
            </div>
            <Link className="btn opinion-button press" to={href(lang, CONTACT_PATH)}>
              {c.contact} <Icon name="arrowRight" />
            </Link>
          </section>
        </article>
      </div>

      <section className="more-topics" aria-labelledby="more-title">
        <div className="container">
          <div className="more-head">
            <p className="eyebrow">{c.moreEyebrow}</p>
            <h2 id="more-title">{c.moreTitle}</h2>
          </div>
          <div className="more-grid">
            {c.more.map((topic) => (
              <Link key={topic.slug} className="more-card" to={href(lang, `/themen/${topic.slug}`)}>
                <span className="more-top">
                  <span>{topic.number}</span>
                </span>
                <strong>{topic.title}</strong>
                <span className="more-teaser">{topic.teaser}</span>
                <span className="more-link">
                  {c.moreLink} <Icon name="arrowRight" />
                </span>
              </Link>
            ))}
          </div>
          <Link className="text-link all-topics" to={topicsHref}>
            <Icon name="chevLeft" />
            {c.allTopics}
          </Link>
        </div>
      </section>
    </div>
  );
}
