import { useEffect, useId, useRef, useState } from 'react';
import type { PageViewStats } from '../api/statistics';

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const numberFormat = new Intl.NumberFormat('de-DE');
const compactFormat = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 });
const HEIGHT = 260;
const LEFT = 62;
const RIGHT = 12;
const TOP = 36;
const BOTTOM = 204;

/** Dieselben lückenlosen Kalendertage wie die Tabelle; nur die Zeichenreihenfolge ist chronologisch. */
export function PageViewsChart({ days }: { days: PageViewStats['days'] }) {
  const title = useId();
  const description = useId();
  const container = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(288);

  // Die Zeichenfläche folgt der Breite, die Schrift bleibt auch bei 320 px in lesbarer Originalgröße.
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(container.current!);
    return () => observer.disconnect();
  }, []);

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

  return (
    <figure className="views-chart card" ref={container}>
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-labelledby={`${title} ${description}`}>
        <title id={title}>Verlauf der Seitenaufrufe</title>
        <desc id={description}>Seitenaufrufe je Kalendertag, älteste zuerst. Die Tabelle darunter enthält alle genauen Tageswerte.</desc>
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
        <polyline points={chronological.map((day, i) => `${x(i)},${y(day.views)}`).join(' ')} className="chart-line" />
        {chronological.length <= 60 && chronological.map((day, i) => (
          <circle key={day.date} cx={x(i)} cy={y(day.views)} r={3} className="chart-point">
            <title>{`${dateFormat.format(new Date(`${day.date}T00:00:00Z`))}: ${numberFormat.format(day.views)} Seitenaufrufe`}</title>
          </circle>
        ))}
        {labels.map((i, position) => (
          <text key={i} x={x(i)} y={BOTTOM + 22}
            textAnchor={labels.length === 1 ? 'middle' : position === 0 ? 'start' : position === labels.length - 1 ? 'end' : 'middle'}>
            {dateFormat.format(new Date(`${chronological[i].date}T00:00:00Z`))}
          </text>
        ))}
        <text x={width - RIGHT} y={HEIGHT - 6} textAnchor="end" className="chart-axis-title">Datum</text>
      </svg>
      <figcaption>Seitenaufrufe je Tag. Genaue Werte stehen in der folgenden Tabelle.</figcaption>
    </figure>
  );
}
