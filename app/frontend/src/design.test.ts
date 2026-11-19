import { describe, expect, it } from 'vitest';
import DESIGN from '../../../DESIGN.md?raw';
import TOPIC_STYLE from './lib/topicStyle.ts?raw';
import ARTICLE from './pages/Article.css?raw';
import VIBE_CODING from './pages/VibeCoding.css?raw';
import STYLES from './styles.css?raw';
import TYPOGRAPHY from './typography.css?raw';

// Anforderung #104: Ninja-Farbpalette und Typografie „Magazin-Kontrast“ für die öffentliche Webseite.
// Sollwerte stammen ausschließlich aus dem Ticket (Farbtabelle, weitere Vorgaben, Typografietabelle).
const FONT_FILES = import.meta.glob('./assets/fonts/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const SOURCES: Record<string, string> = {
  'styles.css': STYLES,
  'typography.css': TYPOGRAPHY,
  'pages/VibeCoding.css': VIBE_CODING,
  'pages/Article.css': ARTICLE,
  'lib/topicStyle.ts': TOPIC_STYLE,
};

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Deklarationen aller Regeln mit genau diesem Selektor außerhalb von @supports/@media, in Dateireihenfolge. */
function tokens(css: string, selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  let depth = 0;
  let start = 0;
  const text = stripComments(css);
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      const sel = text.slice(start, i).trim();
      const end = text.indexOf('}', i);
      const inner = text.slice(i + 1, end);
      if (depth === 0 && sel === selector && !inner.includes('{')) {
        for (const m of inner.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim().toLowerCase();
      }
      if (sel.startsWith('@')) {
        depth++;
        start = i + 1;
      } else {
        i = end;
        start = end + 1;
      }
    } else if (text[i] === '}') {
      depth = Math.max(0, depth - 1);
      start = i + 1;
    }
  }
  return out;
}

const LIGHT = {
  '--paper': '#f8f7f5',
  '--surface': '#ffffff',
  '--soft': '#f1efec',
  '--warm': '#fcf1e6',
  '--line': '#12263a29',
  '--ink': '#12263a',
  '--muted': '#4d5b6b',
  '--brand': '#dc6e14',
  '--brand-ink': '#a64b08',
  '--brand-hover': '#c35f0e',
  '--navy': '#12263a',
  '--on-brand': '#12263a',
};
const DARK = {
  '--paper': '#0a121b',
  '--surface': '#111b26',
  '--soft': '#182433',
  '--warm': '#111b26',
  '--line': '#ffffff26',
  '--ink': '#f6f8fa',
  '--muted': '#bfc9d3',
  '--brand': '#dc6e14',
  '--brand-ink': '#f39b56',
  '--brand-hover': '#f39b56',
  '--navy': '#12263a',
  '--on-brand': '#12263a',
};

describe('REQ-104-AC1/AC2: Farbtokens', () => {
  const light = tokens(STYLES, ':root');
  const dark = { ...light, ...tokens(STYLES, ':root[data-theme="dark"]') };

  it.each(Object.entries(LIGHT))('REQ-104-AC2: hell %s = %s', (name, value) => {
    expect(light[name], `${name} in :root`).toBe(value);
  });
  it.each(Object.entries(DARK))('REQ-104-AC1: dunkel %s = %s', (name, value) => {
    expect(dark[name], `${name} unter :root[data-theme="dark"]`).toBe(value);
  });
  it('REQ-104-AC1/AC2: Komponenten nutzen --surface als eigene Fläche statt --paper', () => {
    expect(light['--surface']).not.toBe(light['--paper']);
    expect(dark['--surface']).not.toBe(dark['--paper']);
  });
});

// Basisfarben aus Farbtabelle und weiteren Vorgaben; Transparenz ist erlaubt (REQ-104-AC3).
const ALLOWED = new Set([
  'f8f7f5', '0a121b', 'ffffff', '111b26', 'f1efec', '182433', 'fcf1e6', '12263a', 'f6f8fa', 'bfc9d3', '4d5b6b',
  'dc6e14', 'f39b56', 'a64b08', 'c35f0e', '2a5a8c',
]);
const OLD = ['#0d1d2b', '#162a3b', '#1c292f', '#344756', '#eef2f5', '#b2bfcc', '#596777', '#203d56', '#bdcbd7', '#f5a66b', '#90a5b8', '#1d3a54'];

/** Basisfarbe (6 Hex-Ziffern, ohne Alpha) eines Farbwerts. */
function base(color: string): string {
  const c = color.toLowerCase();
  if (c.startsWith('#')) {
    const h = c.slice(1);
    if (h.length === 3 || h.length === 4) return [...h.slice(0, 3)].map((d) => d + d).join('');
    return h.slice(0, 6);
  }
  const [r, g, b] = (c.match(/[\d.]+/g) ?? []).map(Number);
  return [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** Farbwerte in Deklarationen (CSS) bzw. in Zeichenketten (TS). */
function colors(name: string, text: string): string[] {
  const found: string[] = [];
  if (name.endsWith('.css')) {
    for (const [, value] of stripComments(text).matchAll(/:([^;{}]*)(?=[;}])/g)) {
      for (const m of value.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi)) found.push(m[0]);
      for (const m of value.matchAll(/\b(white|black|gr[ae]y|navy|orange)\b/gi)) found.push(m[0]);
    }
  } else {
    for (const [, value] of text.matchAll(/(['"`])((?:(?!\1).)*)\1/g)) {
      for (const m of value.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi)) found.push(m[0]);
    }
  }
  return found;
}

describe('REQ-104-AC3: keine Fremdfarben', () => {
  it.each(Object.keys(SOURCES))('REQ-104-AC3: %s verwendet nur Farben der Ninja-Palette', (name) => {
    const foreign = colors(name, SOURCES[name]).filter((c) => /^(white|black|gr[ae]y|navy|orange)$/i.test(c) || c.startsWith('hsl') || !ALLOWED.has(base(c)));
    expect(foreign, `Fremdfarben in ${name}`).toEqual([]);
  });

  it.each(Object.keys(SOURCES))('REQ-104-AC3: %s enthält keine bisherigen Farbwerte', (name) => {
    const text = SOURCES[name].toLowerCase();
    expect(OLD.filter((c) => text.includes(c)), `bisherige Werte in ${name}`).toEqual([]);
  });

  it('REQ-104-AC3: Schatten sind navy bzw. #0a121b statt Schwarz', () => {
    const all = Object.values(SOURCES).map(stripComments).join('\n');
    expect(all).not.toMatch(/rgba?\(\s*0\s*,\s*0\s*,\s*0\b/);
    expect(all).not.toMatch(/#000(?:0{3})?(?:[0-9a-f]{2})?\b/i);
  });
});

describe('REQ-104-AC4: Hero und weitere Vorgaben', () => {
  const css = stripComments(STYLES);
  const light = tokens(STYLES, ':root');
  const dark = { ...light, ...tokens(STYLES, ':root[data-theme="dark"]') };
  it('REQ-104-AC4: Farbfelder mit 20 %/11 % (hell) und 28 %/33 % (dunkel) Deckkraft', () => {
    expect(light['--hero-glow-brand']).toBe('#dc6e1433');
    expect(light['--hero-glow-cool']).toBe('#12263a1c');
    expect(dark['--hero-glow-brand']).toBe('#dc6e1447');
    expect(dark['--hero-glow-cool']).toBe('#2a5a8c55');
    const hero = css.match(/\.home-hero\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(hero).toMatch(/radial-gradient\([^;]*var\(--hero-glow-brand\)/);
    expect(hero).toMatch(/radial-gradient\([^;]*var\(--hero-glow-cool\)/);
    expect(hero).toMatch(/var\(--warm\)/);
  });
});

describe('REQ-104-AC6/AC7: selbst gehostete Schriften', () => {
  const faces = [...stripComments(TYPOGRAPHY).matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
  const webfonts = faces.filter((f) => /url\(/.test(f));
  const family = (f: string) => f.match(/font-family:\s*['"]([^'"]+)['"]/)?.[1];
  const style = (f: string) => f.match(/font-style:\s*(\w+)/)?.[1] ?? 'normal';

  it('REQ-104-AC6: Playfair Display normal und kursiv sowie Source Sans 3 sind als WOFF2 vom eigenen Server deklariert', () => {
    const declared = webfonts.map((f) => `${family(f)}/${style(f)}`);
    expect(declared).toEqual(expect.arrayContaining(['Playfair Display/normal', 'Playfair Display/italic', 'Source Sans 3/normal']));
    for (const f of webfonts) {
      const urls = [...f.matchAll(/url\(\s*['"]?([^'")]+)/g)].map((m) => m[1]);
      for (const url of urls) {
        expect(url, 'relative Datei im Repository').toMatch(/^\.\/assets\/fonts\/[\w-]+\.woff2$/);
        expect(Object.keys(FONT_FILES), `${url} existiert`).toContain(url);
      }
      expect(f).toMatch(/format\(\s*['"]woff2/);
      expect(f, 'kein fremder Host').not.toMatch(/https?:|\/\//);
    }
  });

  it('REQ-104-AC7: jede Schrift nutzt font-display: swap', () => {
    for (const f of webfonts) expect(f, family(f)).toMatch(/font-display:\s*swap/);
  });

  it('REQ-104-AC7: Rückfallschriften sind metrisch angeglichen (size-adjust) und stehen in den Schriftstapeln', () => {
    const fallbacks = faces.filter((f) => /src:\s*local\(/.test(f));
    expect(fallbacks.map(family)).toEqual(expect.arrayContaining(['Playfair Display Fallback', 'Source Sans 3 Fallback']));
    for (const f of fallbacks) expect(f).toMatch(/size-adjust:\s*[\d.]+%/);
    expect(TYPOGRAPHY).toMatch(/"Playfair Display",\s*"Playfair Display Fallback",\s*Georgia,\s*serif/);
    expect(TYPOGRAPHY).toMatch(/"Source Sans 3",\s*"Source Sans 3 Fallback",\s*system-ui,\s*sans-serif/);
  });
});

describe('REQ-104-AC13: Dokumentation und Lizenz', () => {
  const design = DESIGN;
  it('REQ-104-AC13: DESIGN.md beschreibt Ninja-Palette und Magazin-Kontrast', () => {
    for (const s of ['Magazin-Kontrast', 'Playfair Display', 'Source Sans 3', '#0a121b', '#f8f7f5', '#111b26', 'prefers-color-scheme']) {
      expect(design, s).toContain(s);
    }
    expect(design, 'keine Systemschrift-Vorgabe mehr').not.toMatch(/-apple-system/);
    for (const c of ['#0d1d2b', '#eef2f5', '#b2bfcc', '#596777']) expect(design, c).not.toContain(c);
    expect(design).toMatch(/Keine externen Schrift/);
  });
  it.each(['OFL-Playfair-Display.txt', 'OFL-Source-Sans-3.txt'])('REQ-104-AC13: Lizenzdatei %s liegt neben den Schriftdateien', (file) => {
    expect(FONT_FILES[`./assets/fonts/${file}`]).toContain('SIL Open Font License, Version 1.1');
  });
});
