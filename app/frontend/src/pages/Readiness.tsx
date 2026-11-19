import { useState, type CSSProperties, type Ref } from 'react';
import { Link } from 'react-router';
import { useAudit } from '../api/client';
import { Icon } from '../components/Icon';
import { LoadError, Loading } from '../components/Status';
import { overviewDimensions, readiness, toggled, type OverviewDimension } from '../i18n/readiness';
import { AUDIT_TOPIC, auditPath } from '../lib/audit';
import { useLang } from '../lib/lang';
import { topicColor } from '../lib/topicStyle';
import './Readiness.css';

/**
 * KI-Readiness-Übersicht nach Mock readiness_v1 (Ticket #115): typografischer Hero, Einführung, Reifegrade mit
 * Einordnung, aufklappbare Dimensionsliste und Aufruf zur Selbsteinschätzung. Die Seitentexte stehen in
 * i18n/readiness.ts; welche Dimensionen freigegeben sind und in welcher Reihenfolge, bestimmt der Katalog.
 */
export function Readiness({ titleRef }: { titleRef: Ref<HTMLHeadingElement> }) {
  const { lang, t } = useLang();
  const audit = useAudit(lang);
  const c = readiness[lang];

  if (audit.isPending) return <Loading />;
  if (audit.isError) return <LoadError onRetry={() => void audit.refetch()} />;

  const dimensions = overviewDimensions(audit.data.dimensions, lang);
  const first = dimensions[0];
  const start = first && (
    <Link className="btn btn-primary press" to={auditPath(lang, first.slug)}>
      {t('audit.start')} <Icon name="arrowRight" />
    </Link>
  );

  return (
    <>
      <section className="rd-hero" aria-labelledby="page-title">
        <div className="container">
          <p className="eyebrow">{c.hero.eyebrow}</p>
          <h1 className="rd-title" id="page-title" tabIndex={-1} ref={titleRef}>
            {c.hero.title}
          </h1>
          <p className="rd-question">{c.hero.question}</p>
          <div className="rd-hero-foot">
            <div>
              <p className="rd-lead">
                {c.hero.lead[0]}
                <br />
                {c.hero.lead[1]}
              </p>
              <p className="rd-stand">{c.hero.updated}</p>
            </div>
            {start}
          </div>
        </div>
      </section>

      <div className="container">
        <section className="rd-intro" aria-label={c.introLabel}>
          <div className="rd-copy">
            {c.intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </section>

        <section className="section rd-section" aria-labelledby="faehigkeiten" id="reifegrade">
          <p className="eyebrow">{c.levels.eyebrow}</p>
          <h2 className="section-title" id="faehigkeiten">
            {c.levels.title}
          </h2>
          <p className="rd-section-intro">{c.levels.intro}</p>
          <ol className="level-list rd-levels">
            {c.levels.items.map((l, i) => (
              <li key={l.name} className="level-item">
                <span className="level-badge" aria-hidden="true">
                  {i + 1}
                </span>
                <strong>{l.name}</strong>
                <span>{l.text}</span>
              </li>
            ))}
          </ol>
          <p className="rd-after">{c.levels.after}</p>

          <aside className="rd-note" aria-labelledby="hoechste-stufe">
            <h3 id="hoechste-stufe">{c.note.title}</h3>
            {c.note.text.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </aside>
        </section>

        <section className="section rd-section" aria-labelledby="dimensionen-titel" id="dimensionen">
          <p className="eyebrow">{c.dimensionSection.eyebrow}</p>
          <h2 className="section-title" id="dimensionen-titel">
            {c.dimensionSection.title}
          </h2>
          <p className="rd-section-intro">{c.dimensionSection.intro}</p>

          <h3 className="subhead" id="ueberblick">
            {t('audit.dimensionsTitle')}
          </h3>
          <DimensionAccordion dimensions={dimensions} />

          <div className="rd-cta">
            <p>{c.closing}</p>
            {start}
          </div>
        </section>
      </div>
    </>
  );
}

/**
 * Dimensionen in fester Reihenfolge, jede mit aufklappbarer Erklärung (Accordion-Muster der WAI-ARIA Authoring
 * Practices: Button in Überschrift, aria-expanded und aria-controls). Mehrere Erklärungen dürfen gleichzeitig
 * offen sein. Aufklappen liest nur; es bewertet nichts.
 */
function DimensionAccordion({ dimensions }: { dimensions: OverviewDimension[] }) {
  const { lang, t } = useLang();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  return (
    <ol className="dim-accordion" aria-labelledby="ueberblick">
      {dimensions.map((d, i) => {
        const expanded = open.has(d.slug);
        const ids = { button: `dimension-${d.slug}`, panel: `dimension-${d.slug}-erklaerung` };
        return (
          <li key={d.slug} className="dim-acc-item" data-open={expanded || undefined}>
            <h4 className="dim-acc-heading">
              <button
                type="button"
                className="dim-acc-toggle"
                id={ids.button}
                aria-expanded={expanded}
                aria-controls={ids.panel}
                onClick={() => setOpen((prev) => toggled(prev, d.slug))}
              >
                <span className="dim-acc-no" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="dim-acc-text" lang={d.contentLang}>
                  <span className="dim-acc-title">{d.title}</span>{' '}
                  <span className="dim-acc-summary">{d.question}</span>
                </span>
                <span className="dim-acc-icon" aria-hidden="true">
                  <Icon name="chevDown" />
                </span>
              </button>
            </h4>
            <div className="dim-acc-panel" id={ids.panel} hidden={!expanded}>
              <span className="chip" style={{ '--c': topicColor(AUDIT_TOPIC) } as CSSProperties}>
                <i aria-hidden="true" />
                {t(`audit.category.${d.category}`)}
              </span>
              <div className="dim-acc-copy" lang={d.contentLang}>
                {d.description.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
              <Link className="text-link" to={auditPath(lang, d.slug)}>
                {t('audit.toDimension', { title: d.title })} <Icon name="arrowRight" />
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
