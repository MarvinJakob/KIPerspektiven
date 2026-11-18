/**
 * Mobiles Inhaltsverzeichnis (Anforderung #98): Geltungsbereich, Abschnitte und aktiver Abschnitt.
 * Abschnitte sind die sichtbaren H2 im Hauptinhalt; das Verzeichnis erscheint nur bis zum mobilen Breakpoint.
 */

/** Bestehender mobiler Breakpoint aus styles.css (bis einschließlich 650 CSS-Pixel). */
export const TOC_MEDIA = '(max-width: 650px)';

/**
 * Startseite, redaktionelle Themenseiten, Themenartikel, einzelne Beiträge und die Inhaltsseiten.
 * Ausgenommen sind Übersichten, die KI-Readiness-Selbsteinschätzung (`themen/ai-audit…`) und alle übrigen Seiten.
 */
const SCOPE = /^\/(de|en)(\/|\/(themen\/(?!ai-audit\/?$)[^/]+|themenartikel\/[^/]+|blog\/[^/]+|ki-verstehen|ki-einsatzfelder)\/?)?$/;

export const tocEnabled = (pathname: string) => SCOPE.test(pathname);

export interface TocEntry {
  id: string;
  label: string;
  /** Sprache des Inhalts, falls er vom Rahmen abweicht (Sprach-Fallback). */
  lang?: string;
}

export interface TocSection {
  heading: HTMLElement;
  entry: TocEntry;
}

const ID_PREFIX = 'abschnitt-';

/**
 * Sammelt die Abschnittsüberschriften in Seitenreihenfolge. Fehlende IDs werden eindeutig ergänzt und die
 * Überschriften fokussierbar gemacht, damit Einträge zu ihnen springen können. `data-toc-label` ersetzt einen
 * wechselnden oder umbrochenen Überschriftentext, `data-toc="off"` nimmt eine Überschrift aus.
 */
export function collectSections(root: ParentNode): TocSection[] {
  const sections: TocSection[] = [];
  for (const heading of root.querySelectorAll<HTMLElement>('h2')) {
    if (heading.closest('.sr-only, [data-toc="off"], [hidden]')) continue;
    const label = (heading.dataset.tocLabel ?? heading.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!label) continue;
    if (!heading.id) {
      let n = 1;
      while (document.getElementById(ID_PREFIX + n)) n++;
      heading.id = ID_PREFIX + n;
    }
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    const lang = heading.closest('[lang]');
    sections.push({
      heading,
      entry: { id: heading.id, label, lang: lang && lang !== document.documentElement ? lang.getAttribute('lang') ?? undefined : undefined },
    });
  }
  return sections;
}

/**
 * Index des aktuellen Abschnitts: der letzte, dessen Überschrift die Lesemarke erreicht hat (Oberkanten relativ zum
 * Fenster). Am Seitenende gilt der letzte Abschnitt, vor dem ersten Abschnitt keiner (-1).
 */
export function activeIndex(tops: number[], line: number, atBottom: boolean): number {
  if (!tops.length) return -1;
  if (atBottom) return tops.length - 1;
  let index = -1;
  tops.forEach((top, i) => {
    if (top <= line) index = i;
  });
  return index;
}
