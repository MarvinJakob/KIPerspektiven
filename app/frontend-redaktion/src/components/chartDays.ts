import type { PageViewStats } from '../api/statistics';

export type Day = PageViewStats['days'][number];

/** Abstand des Datenbereichs vom linken (Achsenbeschriftung) und rechten Rand der Grafik in px. */
export const CHART_LEFT = 62;
export const CHART_RIGHT = 12;

const numberFormat = new Intl.NumberFormat('de-DE');
const dayFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

/** Kalendertag JJJJ-MM-TT, z. B. „Mi., 18.11.2026“. Der Tag steht schon fest, deshalb ohne Zeitzonenumrechnung. */
export const formatDay = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`));

/** Ein vorhandener Wert, auch 0, als Zahl; ein fehlender Wert ist „Nicht verfügbar“, nicht 0 (REQ-65-AC4). */
export const formatCount = (value: number | null) => (value === null ? 'Nicht verfügbar' : numberFormat.format(value));

/** Textfassung eines Tages für Screenreader (REQ-65-AC3). */
export const describeDay = (day: Day) =>
  `${formatDay(day.date)}: Absolute Anzahl ${formatCount(day.views)}, Bereinigte Anzahl ${formatCount(day.uniqueViews)}`;

/** Index des Tages (chronologisch) mit der nächstgelegenen Position zu `px` in einer Grafik der Breite `width`. */
export function dayIndexAt(px: number, width: number, count: number) {
  if (count <= 1) return 0;
  const ratio = (px - CHART_LEFT) / (width - CHART_LEFT - CHART_RIGHT);
  return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));
}

/** Neue Auswahl nach einem Tastendruck oder null, wenn die Taste die Auswahl nicht betrifft. Ohne Auswahl beginnt sie beim neuesten Tag. */
export function stepIndex(key: string, index: number | null, count: number): number | null {
  const last = count - 1;
  switch (key) {
    case 'Home': return 0;
    case 'End': return last;
    case 'ArrowLeft': return index === null ? last : Math.max(0, index - 1);
    case 'ArrowRight': return index === null ? last : Math.min(last, index + 1);
    default: return null;
  }
}
