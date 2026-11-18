import type { Ref } from 'react';
import { Link } from 'react-router';
import portrait from '../assets/marvin-jakob.jpg';
import harness from '../assets/topics/harness.png';
import { ArticleByline } from '../components/ArticleByline';
import { Diagram } from '../components/Diagram';
import { VIBE_CODING_QUOTE, vibeCoding, vibeCodingMeta, vibeCodingReadingText } from '../i18n/vibeCoding';
import { jumpTo } from '../lib/jump';
import { href, useLang } from '../lib/lang';
import './VibeCoding.css';

function Example({ id, label, text }: { id: string; label: string; text: string }) {
  return (
    <figure className="vc-example" aria-labelledby={`${id}-caption`}>
      <figcaption id={`${id}-caption`}>{label}</figcaption>
      <p><em>{text}</em></p>
    </figure>
  );
}

/** #29: Complete bilingual article, following the approved Vibe Coding mock. #38: the article ends with the conclusion. */
export function VibeCoding({ titleRef }: { titleRef: Ref<HTMLHeadingElement> }) {
  const { lang } = useLang();
  const c = vibeCoding[lang];
  return (
    <article className="vc-page" lang={lang}>
      <header className="vc-hero">
        <div className="container">
          <nav className="crumbs" aria-label={c.breadcrumb}>
            <Link to={href(lang)}>{c.home}</Link><span aria-hidden="true">/</span>
            <Link to={`${href(lang)}#themen`}>{c.topics}</Link><span aria-hidden="true">/</span>
            <span aria-current="page">Vibe Coding</span>
          </nav>
          <div className="vc-hero-copy">
            <h1 ref={titleRef} tabIndex={-1}>Vibe Coding</h1>
            <p className="vc-subtitle">{c.subtitle}</p>
            <ArticleByline {...vibeCodingMeta} portrait={portrait} text={vibeCodingReadingText(c)} />
          </div>
        </div>
      </header>
      <section className="container vc-intro" aria-label={c.introLabel}>
        <div className="vc-reading">
          {c.intro.map((p) => <p key={p}>{p}</p>)}
          <Example id="vc-story" label={c.storyLabel} text={c.story} />
          <p>{c.abundance}</p>
          <blockquote className="vc-quote"><p>{VIBE_CODING_QUOTE}</p></blockquote>
          <p>{c.transition}</p>
          <ol className="vc-index">
            {c.perspectives.map((p, i) => (
              <li key={p.id}>
                <a href={`#vc-${p.id}`} onClick={(e) => jumpTo(e, `vc-${p.id}`)}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <strong>{p.name}<small>{p.heading}</small></strong>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <div className="vc-perspectives">
        {c.perspectives.map((p, i) => (
          <section key={p.id} className="container vc-split vc-perspective" id={`vc-${p.id}`} tabIndex={-1} aria-labelledby={`vc-${p.id}-title`}>
            <header className="vc-split-head">
              <span className="vc-number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <p className="eyebrow">{p.name}</p>
              <h2 id={`vc-${p.id}-title`}>{p.heading}</h2>
            </header>
            <div className="vc-body">
              <p>{p.body}</p>
              {p.id === 'harness' && (
                <Diagram src={harness} alt={c.harnessDiagram.alt} width={1685} height={542} />
              )}
              <Example id={`vc-${p.id}-example`} label={i === 0 ? c.example : c.formLabel} text={p.example} />
              <p>{p.closing}</p>
            </div>
          </section>
        ))}
      </div>
      <section className="container vc-split vc-conclusion" aria-labelledby="vc-conclusion-title">
        <header className="vc-split-head">
          <p className="eyebrow">{c.conclusionLabel}</p>
          <h2 id="vc-conclusion-title">{c.conclusionTitle}</h2>
        </header>
        <div className="vc-body">{c.conclusion.map((p) => <p key={p}>{p}</p>)}</div>
      </section>
    </article>
  );
}
