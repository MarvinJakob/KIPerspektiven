import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { PageViewStats } from '../api/statistics';
import { CHART_LEFT as LEFT, CHART_RIGHT as RIGHT, dayIndexAt, describeDay, formatCount, formatDay, stepIndex } from './chartDays';

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const numberFormat = new Intl.NumberFormat('de-DE');
const compactFormat = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 });
const HEIGHT = 260;
const TOP = 36;
const BOTTOM = 204;

/** Wie der Tag ausgewählt wurde: Nur die Tastaturauswahl wird zusätzlich für Screenreader angesagt. */
type Selection = { index: number; via: 'pointer' | 'touch' | 'keyboard' } | null;

/**
 * Verlauf der Seitenaufrufe je lückenlosem Kalendertag, chronologisch gezeichnet. Die genauen Tageswerte
 * zeigt ein Tooltip für den gewählten Tag: per Maus, Antippen oder Pfeiltasten (Anforderung #65).
 */
export function PageViewsChart({ days, showUnique, onShowUnique }: {
  days: PageViewStats['days']; showUnique: boolean; onShowUnique: (show: boolean) => void;
}) {
  const title = useId();
  const description = useId();
  const container = useRef<HTMLElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(288);
  const [selected, setSelected] = useState<Selection>(null);

  // Die Zeichenfläche folgt der Breite, die Schrift bleibt auch bei 320 px in lesbarer Originalgröße.
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(container.current!);
    return () => observer.disconnect();
  }, []);

  // Neuer Zeitraum: alte Auswahl verwerfen.
  useEffect(() => setSelected(null), [days]);

  // Touch: Antippen außerhalb der Grafik blendet die Tageswerte aus.
  useEffect(() => {
    if (selected?.via !== 'touch') return;
    const outside = (event: globalThis.PointerEvent) => {
      if (!plot.current?.contains(event.target as Node)) setSelected(null);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [selected?.via]);

  const chronological = [...days].reverse();
  const max = days.reduce((highest, day) => Math.max(highest, day.views), 1);
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 5, 10].map((n) => n * magnitude).find((n) => n >= max / 4)!;
  const ceiling = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: ceiling / step + 1 }, (_, i) => i * step);
  const x = (i: number) => LEFT + (width - LEFT - RIGHT) * (chronological.length === 1 ? 0.5 : i / (chronological.length - 1));
  const y = (views: number) => BOTTOM - (BOTTOM - TOP) * views / ceiling;
  const labelCount = Math.min(chronological.length, width < 600 ? 3 : 5);
  const labels = Array.from({ length: labelCount }, (_, i) => Math.round(i * (chronological.length - 1) / Math.max(1, labelCount - 1)));
  const index = selected?.index ?? null;
  const day = index === null ? null : chronological[index];

  // Der Tooltip steht über dem gewählten Tag, vollständig innerhalb der Grafik und in der Hälfte,
  // die die Punkte des Tages nicht verdeckt.
  useLayoutEffect(() => {
    if (!day || !tooltip.current) return;
    const { offsetWidth: own, offsetHeight: high } = tooltip.current;
    const left = Math.min(Math.max(x(index!) - own / 2, 0), Math.max(0, width - own));
    const highest = y(Math.max(day.views, showUnique ? day.uniqueViews ?? 0 : 0));
    tooltip.current.style.left = `${left}px`;
    tooltip.current.style.top = `${highest < (TOP + BOTTOM) / 2 ? Math.max(0, BOTTOM - high) : 0}px`;
  });

  // Fehlende Werte unterbrechen den Pfad, statt als 0 oder Verbindung zu erscheinen.
  let connected = false;
  const uniquePath = chronological.map((d, i) => {
    if (d.uniqueViews == null) { connected = false; return ''; }
    const point = `${connected ? 'L' : 'M'}${x(i)},${y(d.uniqueViews)}`;
    connected = true;
    return point;
  }).join(' ');
  // Auch in langen Reihen bleiben einzelne bekannte Werte zwischen Datenluecken sichtbar.
  const showUniquePoint = (i: number) => chronological.length <= 60 ||
    (chronological[i - 1]?.uniqueViews == null && chronological[i + 1]?.uniqueViews == null);

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const index = dayIndexAt(event.clientX - bounds.left, bounds.width, chronological.length);
    setSelected({ index, via: event.pointerType === 'touch' ? 'touch' : 'pointer' });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setSelected(null);
      return;
    }
    const index = stepIndex(event.key, selected?.index ?? null, chronological.length);
    if (index === null) return;
    event.preventDefault();
    setSelected({ index, via: 'keyboard' });
  };

  return (
    <figure className="views-chart card" ref={container}>
      <label className="check chart-toggle">
        <input type="checkbox" checked={showUnique} onChange={(event) => onShowUnique(event.target.checked)} />
        Bereinigte Anzahl anzeigen
      </label>
      <div className="chart-legend" aria-label="Legende">
        <span><i className="legend-absolute" aria-hidden="true" />Absolute Anzahl</span>
        <span><i className="legend-unique" aria-hidden="true" />Bereinigte Anzahl{!showUnique && ' (ausgeblendet)'}</span>
      </div>
      <div
        ref={plot}
        className="chart-plot"
        role="group"
        tabIndex={0}
        aria-label="Tageswerte der Seitenaufrufe, Tag mit Pfeiltasten wählen"
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(event) => { if (event.pointerType !== 'touch') setSelected(null); }}
        onKeyDown={onKeyDown}
        onBlur={() => { if (selected?.via === 'keyboard') setSelected(null); }}
      >
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-labelledby={`${title} ${description}`}>
          <title id={title}>Verlauf der Seitenaufrufe</title>
          <desc id={description}>Absolute Anzahl und, wenn eingeschaltet, bereinigte Anzahl je Kalendertag, älteste zuerst. Fehlende Daten bleiben als Lücke.</desc>
          <text x={16} y={18} className="chart-axis-title">Seitenaufrufe</text>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={LEFT} x2={width - RIGHT} y1={y(tick)} y2={y(tick)} className="chart-grid" />
              <text x={LEFT - 8} y={y(tick)} dy="0.35em" textAnchor="end">
                {tick >= 100_000 ? compactFormat.format(tick) : numberFormat.format(tick)}
              </text>
            </g>
          ))}
          <line x1={LEFT} x2={LEFT} y1={TOP} y2={BOTTOM} className="chart-axis" />
          <polyline points={chronological.map((d, i) => `${x(i)},${y(d.views)}`).join(' ')} className="chart-line" />
          {chronological.length <= 60 && chronological.map((d, i) => (
            <circle key={d.date} cx={x(i)} cy={y(d.views)} r={3} className="chart-point" />
          ))}
          {showUnique && <path d={uniquePath} className="chart-unique-line" />}
          {showUnique && chronological.map((d, i) => d.uniqueViews == null || !showUniquePoint(i) ? null : (
            <circle key={d.date} cx={x(i)} cy={y(d.uniqueViews)} r={3} className="chart-unique-point" />
          ))}
          {day && (
            <g className="chart-selection">
              <line x1={x(index!)} x2={x(index!)} y1={TOP} y2={BOTTOM} className="chart-cursor" />
              <circle cx={x(index!)} cy={y(day.views)} r={5} className="chart-point" />
              {showUnique && day.uniqueViews != null && (
                <circle cx={x(index!)} cy={y(day.uniqueViews)} r={5} className="chart-unique-point" />
              )}
            </g>
          )}
          {labels.map((i, position) => (
            <text key={i} x={x(i)} y={BOTTOM + 22}
              textAnchor={labels.length === 1 ? 'middle' : position === 0 ? 'start' : position === labels.length - 1 ? 'end' : 'middle'}>
              {dateFormat.format(new Date(`${chronological[i].date}T00:00:00Z`))}
            </text>
          ))}
          <text x={width - RIGHT} y={HEIGHT - 6} textAnchor="end" className="chart-axis-title">Datum</text>
        </svg>
        {day && (
          <div ref={tooltip} className="chart-tooltip" role="tooltip">
            <strong>{formatDay(day.date)}</strong>
            <dl>
              <div><dt>Absolute Anzahl</dt> <dd>{formatCount(day.views)}</dd></div>
              <div><dt>Bereinigte Anzahl</dt> <dd>{formatCount(day.uniqueViews)}</dd></div>
            </dl>
          </div>
        )}
      </div>
      <p className="visually-hidden" role="status">{selected?.via === 'keyboard' && day ? describeDay(day) : ''}</p>
      <figcaption>
        Seitenaufrufe je Tag. Die gestrichelte Kurve zeigt die bereinigte Anzahl. Genaue Tageswerte zeigt die Grafik
        beim Überfahren oder Antippen eines Tages; per Tastatur wählen die Pfeiltasten, Pos1 und Ende einen Tag.
      </figcaption>
    </figure>
  );
}
