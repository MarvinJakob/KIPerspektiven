import { useEffect } from 'react';
import Markdown from 'react-markdown';
import { Link } from 'react-router';
import { useAudit } from '../api/client';
import { AssessmentSteps } from '../components/AssessmentSteps';
import { ConsultationOffer } from '../components/ConsultationOffer';
import { Icon } from '../components/Icon';
import { ReadinessRadar } from '../components/ReadinessRadar';
import { ShareConsent } from '../components/ShareConsent';
import { LoadError, Loading, TranslationNotice } from '../components/Status';
import { useAssessment } from '../lib/assessment';
import { auditPath, progress } from '../lib/audit';
import { useLang } from '../lib/lang';
import { useHead, usePageFocus } from '../lib/page';

/**
 * Gesamtauswertung der Selbsteinschätzung (Tickets #113, #114): Netzdiagramm, Tabelle als Textfassung mit
 * „Ändern“-Links und die fachliche Einordnung aus #111. Ein Ergebnis erscheint erst, wenn alle freigegebenen
 * Dimensionen bewertet sind; sonst nennt die Seite die offenen Dimensionen. Es gibt keine Gesamtnote.
 * Mit Einwilligung speichert sie das Ergebnis anonym (Ticket #130); scheitert das, bleibt die Auswertung
 * vollständig sichtbar. Am Ende steht das freiwillige Angebot eines kostenlosen Beratungsgesprächs (Ticket #136).
 */
export function AuditResultPage() {
  const { lang, t } = useLang();
  const h1 = usePageFocus<HTMLHeadingElement>();
  const overview = useAudit(lang);
  const { ratings, saveResult } = useAssessment();
  useHead(t('assess.resultTitle'), t('assess.resultMeta'));

  // Ticket #130: Beim Anzeigen der vollständigen Auswertung wird das Ergebnis mit Einwilligung gespeichert,
  // nach Änderungen aktualisiert. saveResult prüft Einwilligung, Vollständigkeit und Änderungen selbst.
  const slugList = overview.data?.dimensions.map((d) => d.slug).join(' ') ?? '';
  useEffect(() => {
    if (slugList) saveResult(lang, slugList.split(' '));
  }, [slugList, lang, saveResult]);

  if (overview.isPending) return <Loading />;
  if (overview.isError) return <LoadError onRetry={() => void overview.refetch()} />;

  const o = overview.data;
  const contentLang = o.lang !== lang ? o.lang : undefined;
  const p = progress(o.dimensions.map((d) => d.slug), ratings);
  const levelName = (n: number) => o.levels.find((l) => l.level === n)?.name ?? String(n);

  return (
    <div className="container">
      <div className="assess-layout">
        <AssessmentSteps dimensions={o.dimensions} levels={o.levels} ratings={ratings} />

        <div className="assess-main">
          <header className="assess-head">
            <p className="eyebrow">{t('assess.resultEyebrow')}</p>
            <h1 className="page-title" tabIndex={-1} ref={h1}>
              {t('assess.resultTitle')}
            </h1>
            {contentLang && <TranslationNotice text={t('audit.fallback', { language: t(`langName.${o.lang}`) })} />}
          </header>

          {!p.complete ? (
            <div className="empty result-incomplete">
              <p>{t('assess.incomplete', { rated: p.rated, total: p.total })}</p>
              <ul lang={contentLang}>
                {o.dimensions
                  .filter((d) => p.open.includes(d.slug))
                  .map((d) => (
                    <li key={d.slug}>{d.title}</li>
                  ))}
              </ul>
              {p.firstOpen && (
                <Link className="btn btn-primary press" to={auditPath(lang, p.firstOpen)}>
                  {p.rated > 0 ? t('assess.continue') : t('audit.start')} <Icon name="arrowRight" />
                </Link>
              )}
            </div>
          ) : (
            <>
              <p className="lead">{t('assess.resultSelf')}</p>
              <ShareConsent />
              <section className="section result-chart" aria-labelledby="radarTitle">
                <h2 className="section-title" id="radarTitle">
                  {t('assess.radarTitle')}
                </h2>
                <figure className="radar-figure">
                  <ReadinessRadar
                    items={o.dimensions.map((d) => ({
                      slug: d.slug,
                      title: d.title,
                      lang: d.lang,
                      level: ratings[d.slug],
                      levelName: levelName(ratings[d.slug]),
                    }))}
                    levelNames={o.levels.map((l) => l.name)}
                  />
                  <figcaption className="radar-caption">
                    {t('assess.radarCaption', {
                      one: levelName(1),
                      two: levelName(2),
                      three: levelName(3),
                    })}
                  </figcaption>
                </figure>
              </section>
              <section className="section result-summary" aria-labelledby="resultListTitle">
                <h2 className="section-title" id="resultListTitle">
                  {t('assess.resultListTitle')}
                </h2>
                <table className="result-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('assess.colDimension')}</th>
                      <th scope="col">{t('assess.colLevel')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.dimensions.map((d, i) => (
                      <tr key={d.slug}>
                        <th scope="row" lang={d.lang !== lang ? d.lang : undefined}>
                          {i + 1}. {d.title}
                        </th>
                        <td>
                          <span className="result-level-cell">
                            <span lang={contentLang}>{t('assess.levelValue', { n: ratings[d.slug], name: levelName(ratings[d.slug]) })}</span>
                            <Link className="text-link" to={auditPath(lang, d.slug)}>
                              {t('assess.change')}
                              <span className="sr-only">: {d.title}</span>
                            </Link>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              {/* Fachliche Einordnung aus content/KI Readiness.md (#111); keine Gesamtnote, keine Neubewertung */}
              <section className="section result-classification audit-copy prose" lang={contentLang}>
                <Markdown skipHtml components={{ h3: ({ node: _node, ...props }) => <h2 className="section-title" {...props} /> }}>
                  {o.classification}
                </Markdown>
              </section>
              <ConsultationOffer />
              <p className="actions">
                <Link className="back-link" to={auditPath(lang)}>
                  <Icon name="chevLeft" /> {t('assess.toOverview')}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
