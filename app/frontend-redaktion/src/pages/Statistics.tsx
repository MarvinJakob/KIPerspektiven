import { useEffect, useId, useRef, useState } from 'react';
import { usePageViews, useReadinessResults, type Period, type ReadinessResultPage } from '../api/statistics';
import { Loading, Page } from '../components/Layout';
import { PageViewsChart } from '../components/PageViewsChart';

const PERIODS: { value: Period; label: string; text: string }[] = [
  { value: '7d', label: 'Letzte 7 Tage', text: 'in den letzten 7 Tagen' },
  { value: '30d', label: 'Letzte 30 Tage', text: 'in den letzten 30 Tagen' },
  { value: 'all', label: 'Gesamt', text: 'insgesamt' },
];

const LANG_NAMES: Record<string, string> = { de: 'Deutsch', en: 'Englisch' };

// Tage und Uhrzeiten in deutscher Zeit, wie die Tageszähler des Backends (service.StatsZone).
const ZONE = 'Europe/Berlin';
const numberFormat = new Intl.NumberFormat('de-DE');
const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONE });
const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: ZONE });

/**
 * Statistik der Redaktion (Ticket #130): Seitenaufrufe je Tag und gespeicherte Ergebnisse der
 * Selbsteinschätzung für einen wählbaren Zeitraum. Die IP-Bereinigung erfolgt serverseitig ohne Cookies (ADR 0010).
 */
export function StatisticsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [page, setPage] = useState(1);
  const periodText = PERIODS.find((p) => p.value === period)!.text;

  return (
    <Page title="Statistik">
      <p className="lead">
        Reichweite der Webseite und Ergebnisse der KI-Readiness-Selbsteinschätzung. Die Erfassung erfolgt ohne Cookies.
        Die bereinigte Anzahl unterscheidet IP-Adressen, keine Personen.
        Tage und Uhrzeiten gelten in deutscher Zeit.
      </p>
      <PeriodPicker
        value={period}
        onChange={(p) => {
          setPeriod(p);
          setPage(1);
        }}
      />
      <PageViews period={period} periodText={periodText} />
      <Results period={period} periodText={periodText} page={page} onPage={setPage} />
    </Page>
  );
}

/** Zeitraum als Radiogruppe: per Tab erreichbar, mit Pfeiltasten wählbar. */
function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const name = useId();
  return (
    <fieldset className="period">
      <legend>Zeitraum</legend>
      <div className="segmented">
        {PERIODS.map((p) => (
          <label key={p.value} className="segmented-option">
            <input type="radio" name={name} value={p.value} checked={value === p.value} onChange={() => onChange(p.value)} />
            <span>{p.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <p className="form-error" role="alert">
      {what} konnten nicht geladen werden.{' '}
      <button className="btn btn-secondary btn-small press" type="button" onClick={onRetry}>
        Erneut versuchen
      </button>
    </p>
  );
}

function Stat({ label, value, context }: { label: string; value: number | null; context: string }) {
  return (
    <dl className="stat">
      <dt>{label}</dt>
      <dd>
        <span className={value === null ? 'stat-unavailable' : 'stat-value'}>
          {value === null ? 'Nicht verfügbar' : numberFormat.format(value)}
        </span> <span className="stat-context">{context}</span>
      </dd>
    </dl>
  );
}

function PageViews({ period, periodText }: { period: Period; periodText: string }) {
  const { data, isFetching, isError, refetch } = usePageViews(period);
  const [showUnique, setShowUnique] = useState(true);
  const heading = useId();
  return (
    <section className="stats-section" aria-labelledby={heading}>
      <h2 id={heading} className="card-title">
        Seitenaufrufe
      </h2>
      <p className="stats-hint">
        Gezählt wird jeder Abruf einer öffentlichen Seite vom Server: Direktaufruf, Link oder Neuladen. Die absolute Anzahl
        zählt keine eindeutigen Besucher: Wer drei Seiten aufruft oder eine Seite dreimal neu lädt, zählt dreimal.
        Seitenwechsel innerhalb der geöffneten Webseite zählen nicht, automatische Abrufe etwa durch Suchmaschinen
        zählen mit.
      </p>
      {isFetching && <Loading />}
      {isError && <LoadError what="Die Seitenaufrufe" onRetry={() => void refetch()} />}
      {data && !isFetching && !isError && (
        <>
          <div className="stats-totals">
            <Stat label="Absolute Anzahl" value={data.total} context={periodText} />
            <Stat label="Bereinigte Anzahl" value={data.uniqueTotal} context={periodText} />
          </div>
          <p className="stats-hint">
            Bereinigt zählt jede IP-Adresse im gewählten Zeitraum einmal, in der Grafik je Kalendertag einmal.
            Die genauen Tageswerte zeigt die Grafik für den gewählten Tag.
            Die bereinigte Gesamtsumme ist keine Summe der Tageswerte. Mehrere Personen können dieselbe IP nutzen,
            eine Person kann verschiedene IPs nutzen.
          </p>
          {data.uniqueTotal === null && (
            <p className="stats-hint" role="note">
              Für diesen Zeitraum fehlen vollständige Daten zur Bereinigung.
              {data.uniqueSince && <> Der aktuelle Erfassungsbeginn ist der {dateFormat.format(new Date(data.uniqueSince))} um {timeFormat.format(new Date(data.uniqueSince))} Uhr.</>}
              {' '}„Nicht verfügbar“ bedeutet fehlende Daten, nicht 0. Die absolute Historie bleibt erhalten.
            </p>
          )}
          {data.total === 0 ? (
            <p className="empty-state card">Im gewählten Zeitraum wurden noch keine Seitenaufrufe gezählt.</p>
          ) : (
            <PageViewsChart days={data.days} showUnique={showUnique} onShowUnique={setShowUnique} />
          )}
        </>
      )}
    </section>
  );
}

interface ResultsProps {
  period: Period;
  periodText: string;
  page: number;
  onPage: (page: number) => void;
}

function Results({ period, periodText, page, onPage }: ResultsProps) {
  const { data, isPending, isError, refetch } = useReadinessResults(period, page);
  const heading = useId();
  const listHeading = useRef<HTMLHeadingElement>(null);
  const focusList = useRef(false);

  // Nach dem Blättern springt der Fokus zur Liste, sobald die neue Seite geladen ist.
  useEffect(() => {
    if (focusList.current && data?.page === page) {
      focusList.current = false;
      listHeading.current?.focus();
    }
  }, [data, page]);

  const go = (n: number) => {
    focusList.current = true;
    onPage(n);
  };

  return (
    <section className="stats-section" aria-labelledby={heading}>
      <h2 id={heading} className="card-title">
        Selbsteinschätzung
      </h2>
      <p className="stats-hint">
        Gespeichert werden nur Ergebnisse von Personen, die vor der Auswertung zugestimmt haben: der Reifegrad je
        Dimension, die Sprache und der Zeitpunkt, ohne Namen oder sonstige Kennung. Die Zahl zeigt deshalb nicht alle
        durchgeführten Selbsteinschätzungen.
      </p>
      {isPending && <Loading />}
      {isError && <LoadError what="Die Ergebnisse" onRetry={() => void refetch()} />}
      {data && (
        <>
          <Stat label="Abgeschlossene Selbsteinschätzungen" value={data.total} context={periodText} />
          {data.total === 0 ? (
            <p className="empty-state card">Im gewählten Zeitraum wurden noch keine Ergebnisse gespeichert.</p>
          ) : (
            <ResultList data={data} listHeading={listHeading} onPage={go} />
          )}
        </>
      )}
    </section>
  );
}

function ResultList({ data, listHeading, onPage }: { data: ReadinessResultPage; listHeading: React.RefObject<HTMLHeadingElement | null>; onPage: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const from = (data.page - 1) * data.pageSize + 1;
  const to = from + data.items.length - 1;
  const title = (slug: string) => data.dimensions.find((d) => d.slug === slug)?.title ?? slug;
  const levelName = (n: number) => data.levels.find((l) => l.level === n)?.name ?? String(n);

  return (
    <>
      <h3 className="results-title" ref={listHeading} tabIndex={-1}>
        Ergebnisse, neueste zuerst
      </h3>
      <p className="results-range">
        Einträge {from}–{to} von {numberFormat.format(data.total)}
      </p>
      <ol className="result-list">
        {data.items.map((r) => (
          <li key={r.id} className="result-entry">
            <p className="result-meta">
              <time dateTime={r.submittedAt}>
                {dateFormat.format(new Date(r.submittedAt))}, {timeFormat.format(new Date(r.submittedAt))} Uhr
              </time>
              <span aria-hidden="true"> · </span>
              <span className="visually-hidden">, Sprache: </span>
              {LANG_NAMES[r.lang] ?? r.lang}
            </p>
            <dl className="result-levels">
              {r.ratings.map((x) => (
                <div key={x.dimension}>
                  <dt>{title(x.dimension)}</dt>
                  <dd>{levelName(x.level)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
      {pages > 1 && (
        <nav className="pager" aria-label="Seiten der Ergebnisliste">
          <button className="btn btn-secondary btn-small press" type="button" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
            Vorherige Seite
          </button>
          <span className="pager-status">
            Seite {data.page} von {pages}
          </span>
          <button className="btn btn-secondary btn-small press" type="button" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>
            Nächste Seite
          </button>
        </nav>
      )}
    </>
  );
}
