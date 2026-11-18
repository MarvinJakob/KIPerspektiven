import type { TFunction } from 'i18next';
import { href, type Lang } from '../lib/lang';

// Inhalte des öffentlichen Footers „Kompakt mit Themen“ (Ticket #54, mock/footer/index.html).

export interface FooterLink {
  label: string;
  to: string;
}

/** Die drei Themen des Footers in fester Reihenfolge, unabhängig von weiteren Themen der API. */
export const FOOTER_TOPICS = ['softwareentwicklung', 'ai-audit', 'vibe-coding'] as const;

/** Zweizeiliger Kurztext unter der Marke, je Satz ein Absatz. */
export const footerNotes = (t: TFunction): string[] => [t('footer.tagline'), t('footer.aiNote')];

export const footerTopics = (lang: Lang, t: TFunction): FooterLink[] =>
  FOOTER_TOPICS.map((slug) => ({ label: t(`footer.topics.${slug}`), to: href(lang, `/themen/${slug}`) }));

/** Seitenlinks der unteren Zeile; die Cookie-Einstellungen folgen als Schaltfläche. */
export const footerPages = (lang: Lang, t: TFunction): FooterLink[] => [
  { label: t('nav.blog'), to: href(lang, '/blog') },
  { label: t('nav.contact'), to: href(lang, '/kontakt') },
  { label: t('footer.imprint'), to: href(lang, '/impressum') },
  { label: t('footer.privacy'), to: href(lang, '/datenschutz') },
];

/** Jahr und Markenname, ohne Copyright-Zeichen. */
export const footerYearLine = (year: number, siteName: string) => `${year} ${siteName}`;
