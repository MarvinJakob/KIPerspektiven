import type { Ref } from 'react';
import { Link } from 'react-router';
import portrait from '../assets/marvin-jakob.jpg';
import processDE from '../assets/topics/development-process_de.png';
import processEN from '../assets/topics/development-process_en.png';
import releaseDE from '../assets/topics/releasegate_de.png';
import releaseEN from '../assets/topics/releasegate_en.png';
import { Diagram } from '../components/Diagram';
import { Icon } from '../components/Icon';
import { CONTACT_PATH, softwareDevelopment, VIBE_CODING_PATH } from '../i18n/softwareDevelopment';
import { href, useLang, type Lang } from '../lib/lang';

/** Sprungziel der Startseite für den Brotkrumenverweis „Themen“ (Home.tsx). */
const TOPICS_ID = 'themen';

/** Unveränderte Originalgrafiken (res/) als Vite-Assets mit Dateihash, je Sprache. */
export const softwareDevelopmentImages: Record<Lang, { process: string; release: string }> = {
  de: { process: processDE, release: releaseDE },
  en: { process: processEN, release: releaseEN },
};

/**
 * Themenseite Softwareentwicklung nach mock/software_development (#7): Hero mit Breadcrumb, Autor, Stand und
 * Lesezeit → Artikel mit beiden Grafiken → Meinungsaufruf. Ohne Verweise auf weitere Themen am Beitragsende (#37).
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
              <span className="topic-number">01</span> {c.eyebrow}
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

    </div>
  );
}
