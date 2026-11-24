import type { CSSProperties } from 'react';
import type { IconName } from '../components/Icon';

// Themenfarben dienen nur Grafiken, Icons und Farbpunkten; Bedeutung tragen immer Text und Symbol.
// Die generierten Verläufe sind Platzhalter, bis die Bildsprache geklärt ist (Design.md, Abschnitt 12).
interface Palette {
  c1: string;
  c2: string;
  c3: string;
  b1: string;
  b2: string;
  dot: string;
}

// Ninja-Design (DESIGN.md, Ticket #104): Alle Grafiken und Menüsymbole stehen auf einem Verlauf von Navy nach
// #182433 mit orangefarbenen und hellgrauen Lichtern. Die Themen unterscheiden sich über Mischung und Lage
// der Lichter sowie ihr Symbol. Es gelten nur Farben der Ninja-Palette.
const PALETTES: Record<string, Palette> = {
  software: { c1: '#dc6e14b3', c2: '#bfc9d359', c3: '#f39b5666', b1: '#12263a', b2: '#182433', dot: '#dc6e14' },
  audit: { c1: '#bfc9d373', c2: '#dc6e148c', c3: '#2a5a8c80', b1: '#0a121b', b2: '#182433', dot: '#2a5a8c' },
};

const TOPICS: Record<string, { palette: keyof typeof PALETTES; icon: IconName }> = {
  softwareentwicklung: { palette: 'software', icon: 'code' },
  'ai-audit': { palette: 'audit', icon: 'shield' },
};

const FALLBACK = { palette: 'software' as const, icon: 'spark' as IconName };

export const topicStyle = (slug: string | undefined) => (slug && TOPICS[slug]) || FALLBACK;

export const topicColor = (slug: string | undefined) => PALETTES[topicStyle(slug).palette].dot;

export function artBackground(slug: string | undefined, seed = 0): CSSProperties {
  const p = PALETTES[topicStyle(slug).palette];
  const s = seed * 23;
  const x1 = 15 + (s % 30);
  const y1 = 25 + ((s * 3) % 30);
  const x2 = 85 - ((s * 2) % 30);
  const y2 = 15 + (s % 25);
  const x3 = 40 + ((s * 5) % 35);
  return {
    background: [
      `radial-gradient(55% 75% at ${x1}% ${y1}%, ${p.c1}, transparent 70%)`,
      `radial-gradient(45% 65% at ${x2}% ${y2}%, ${p.c2}, transparent 70%)`,
      `radial-gradient(65% 55% at ${x3}% 100%, ${p.c3}, transparent 70%)`,
      `linear-gradient(135deg, ${p.b1}, ${p.b2})`,
    ].join(','),
  };
}
