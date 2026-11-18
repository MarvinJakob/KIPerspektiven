import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../components/Icon';
import { useArticles } from '../api/client';
import { home, type CheckAnswer } from '../i18n/home';
import { auditPath } from '../lib/audit';
import { jumpTo, prefersReducedMotion } from '../lib/jump';
import { href, useLang } from '../lib/lang';
import { useHead, usePageFocus } from '../lib/page';

/** Sprungziele der Hero-Einstiege: Überschrift der Themenliste und aktuelle Überschrift des Kurzchecks. */
const TOPICS_ID = 'themen-title';
const CHECK_ID = 'kurzcheck-title';
/** Dauer der Überblendung zwischen zwei Leitfragen (mock/home/script.js). */
const SWITCH_MS = 300;

const number = (i: number) => String(i + 1).padStart(2, '0');

/**
 * Startseite nach dem Home-Mock mock/home/ (Ticket #34): typografischer Hero, zwei nummerierte Themenzeilen,
 * KI-Readiness-Kurzcheck (Variante 7) als letzter Abschnitt. Den Profilteaser „Über mich“ hat #47 entfernt; das Profil
 * bleibt über die Hauptnavigation erreichbar. Ohne Bilder und Illustrationen.
 * Sprunglinks nutzen jumpTo: Sie scrollen zur Überschrift und setzen dort den Fokus, ohne die URL zu ändern.
 */
export function Home() {
  const { lang } = useLang();
  const c = home[lang];
  const articles = useArticles(lang);
  const h1 = usePageFocus<HTMLHeadingElement>();
  useHead(c.title, c.description);

  return (
    <div className="home">
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="container">
          <p className="eyebrow">{c.hook}</p>
          <h1 className="home-title" id="hero-title" tabIndex={-1} ref={h1}>
            {c.display1}
            <br />
            <span>{c.display2}</span>
          </h1>
          <div className="home-hero-foot">
            <p className="home-lead">{c.lead}</p>
            <div className="hero-actions">
              <a className="btn btn-primary press" href={`#${TOPICS_ID}`} onClick={(e) => jumpTo(e, TOPICS_ID)}>
                {c.ctaTopics}
                <Icon name="arrowRight" />
              </a>
              <a className="btn btn-secondary press" href={`#${CHECK_ID}`} onClick={(e) => jumpTo(e, CHECK_ID)}>
                {c.ctaCheck}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section" id="themen" aria-labelledby={TOPICS_ID}>
        <div className="container">
          <p className="eyebrow">{c.topicsEyebrow}</p>
          <h2 className="home-section-title" id={TOPICS_ID} tabIndex={-1} data-toc-label={c.topicsTitle.join(' ')}>
            {c.topicsTitle[0]}
            <br />
            {c.topicsTitle[1]}
          </h2>
          <ol className="home-topics" id="themen-liste">
            {c.topics.map((topic, i) => (
              <li key={topic.slug}>
                <span className="topic-number">{number(i)}</span>
                <div className="home-topic-copy">
                  <p className="home-topic-kicker">{topic.title}</p>
                  <h3>
                    <Link className="home-topic-link" to={href(lang, `/themen/${topic.slug}`)}>
                      {topic.question}
                    </Link>
                  </h3>
                  <p>{topic.text}</p>
                </div>
                <span className="home-topic-go" aria-hidden="true">
                  <Icon name="arrowRight" />
                </span>
              </li>
            ))}
            {articles.data?.map((entry, i) => <li key={entry.id}>
              <span className="topic-number">{number(c.topics.length + i)}</span>
              <div className="home-topic-copy"><h3>
                <Link className="home-topic-link" to={href(lang, '/themenartikel/' + entry.id)}>{entry.title}</Link>
              </h3>{entry.subtitle && <p>{entry.subtitle}</p>}</div>
              <span className="home-topic-go" aria-hidden="true"><Icon name="arrowRight" /></span>
            </li>)}
          </ol>
        </div>
      </section>

      <section className="home-section home-check-section" id="ki-readiness" aria-label={c.check.label}>
        <div className="container">
          <ReadinessCheck />
        </div>
      </section>
    </div>
  );
}

/**
 * Kurzcheck mit den acht Leitfragen (mock/home/script.js, Variante 7). Ja, Nein oder Überspringen führt genau einen
 * Schritt weiter; nur Ja zählt. Die Antworten bleiben im Arbeitsspeicher der Seite und werden weder gespeichert
 * noch übertragen. Nach jeder Antwort liegt der Fokus auf der nächsten Leitfrage bzw. dem Ergebnis.
 */
function ReadinessCheck() {
  const { lang } = useLang();
  const t = home[lang].check;
  const total = t.items.length;
  const [answers, setAnswers] = useState<CheckAnswer[]>([]);
  const [index, setIndex] = useState(0);
  const [switching, setSwitching] = useState(false);
  const [feedback, setFeedback] = useState<{ answer: CheckAnswer; step: number } | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const focusTitle = useRef(false);
  const timer = useRef<number>(undefined);
  const done = index >= total;

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!focusTitle.current) return;
    focusTitle.current = false;
    titleRef.current?.focus({ preventScroll: false });
  }, [index]);

  const answer = (value: CheckAnswer) => {
    // Während der Überblendung keine Antwort annehmen, sonst gälte sie für die noch unsichtbare Frage.
    if (switching || done) return;
    setAnswers((a) => [...a.slice(0, index), value]);
    setFeedback({ answer: value, step: index });
    focusTitle.current = true;
    const next = index + 1;
    if (next >= total || prefersReducedMotion()) {
      setIndex(next);
      return;
    }
    setSwitching(true);
    timer.current = window.setTimeout(() => {
      setSwitching(false);
      setIndex(next);
    }, SWITCH_MS);
  };

  const restart = () => {
    window.clearTimeout(timer.current);
    setAnswers([]);
    setFeedback(null);
    setSwitching(false);
    focusTitle.current = true;
    setIndex(0);
  };

  const yes = answers.filter((a) => a === 'yes').length;
  const open = total - yes;
  const message = done
    ? t.resultNote
    : feedback
      ? t.feedback[feedback.answer][feedback.step % t.feedback[feedback.answer].length]
      : t.intro;

  return (
    <div className={`check${switching ? ' is-switching' : ''}`}>
      <div className="check-top">
        <p className="eyebrow">{t.eyebrow}</p>
        <p className="check-meta">
          <span>{done ? t.resultDimension : t.items[index].dimension}</span>
          <span className="check-count">{done ? t.resultCount : t.count(index + 1, total)}</span>
        </p>
      </div>

      {done ? (
        <div className="check-done">
          <h2 className="check-question" id={CHECK_ID} tabIndex={-1} ref={titleRef} data-toc-label={t.label}>
            {t.result(yes, total)}
          </h2>
          <p className="check-summary">{open === 0 ? t.resultAllYes : t.resultOpen(open)}</p>
        </div>
      ) : (
        <div className="check-ask">
          <h2 className="check-question" id={CHECK_ID} tabIndex={-1} ref={titleRef} data-toc-label={t.label}>
            {t.items[index].question}
          </h2>
          <p className="check-hint">{t.hint}</p>
          <div className="check-answers" role="group" aria-label={t.answersLabel}>
            <button className="btn check-answer press" type="button" onClick={() => answer('yes')}>
              {t.answers.yes}
            </button>
            <button className="btn check-answer press" type="button" onClick={() => answer('no')}>
              {t.answers.no}
            </button>
            <button className="check-skip" type="button" onClick={() => answer('skip')}>
              {t.answers.skip}
            </button>
          </div>
        </div>
      )}

      <ol className="check-progress" aria-label={t.progressLabel}>
        {t.items.map((item, i) => {
          const state = answers[i];
          const current = !done && !state && i === index;
          return (
            <li key={item.dimension} className={state ? `is-${state}` : current ? 'is-current' : undefined}>
              <span className="sr-only">
                {item.dimension}: {t.progressState[state ?? 'open']}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="check-foot">
        <p className="check-feedback" aria-live="polite">
          {message}
        </p>
        <div className="hero-actions">
          {done && (
            <button className="btn btn-secondary press" type="button" onClick={restart}>
              {t.restart}
            </button>
          )}
          <Link className="btn btn-primary press" to={auditPath(lang)}>
            {t.start}
            <Icon name="arrowRight" />
          </Link>
        </div>
      </div>
    </div>
  );
}
