// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { components } from '../api/schema';
import { i18n } from '../i18n';
import { readingMinutes } from '../lib/articleMeta';
import { articleReadingText } from '../lib/articleText';
import { LangContext, type Lang } from '../lib/lang';
import { ArticleView } from './ArticleView';

// Unit-Tests zu Ticket #136. Die Sollwerte für REQ-136-AC2/AC3 sind der Seitenaufbau der beiden Artikel vor der
// Überführung (Stand bd31005), festgehalten unter src/test/golden. Die überführten Inhalte liegen im Backend.

type Article = components['schemas']['PublishedArticle'];
type Text = components['schemas']['ArticleText'];
type Block = components['schemas']['ArticleBlock'];

const root = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const imported = (slug: string) =>
  JSON.parse(read(`../backend/internal/service/topicarticles/${slug}.json`)) as Record<Lang, Text>;
const AVATAR = { src: '/media/portrait-480.jpg', width: 480, height: 480 };

function render(lang: Lang, content: Text, extra: Partial<Article> = {}) {
  const article: Article = { lang, content, authorName: 'Marvin Jakob', authorAvatar: AVATAR, updated: '2026-11-16', ...extra };
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/${lang}/themen/x`]}>
      <LangContext.Provider value={{ lang, t: i18n.getFixedT(lang) }}>
        <ArticleView article={article} titleRef={null} />
      </LangContext.Provider>
    </MemoryRouter>,
  );
}

const dom = (html: string) => new DOMParser().parseFromString(html, 'text/html');

/**
 * Stand vor der Überführung, bereinigt um die in der Spezifikation genannten Abweichungen: Bilddateien unter festen
 * Adressen, Porträt aus dem Autorenprofil, entfallene unsichtbare Bereichsbeschriftungen und der Rahmen der Seite.
 */
function golden(slug: string, lang: Lang) {
  let html = read(`src/test/golden/${slug}.${lang}.html`).replace(/>\n</g, '><').trim();
  html = html
    .replace(/^<link rel="preload"[^>]*>/, '')
    .replace(/^<(?:div class="sd-page"|article class="vc-page") lang="(..)">/, '<article lang="$1">')
    .replace(/<\/div>$/, '</article>')
    .replace('<article class="article-body">', '<div class="article-body">')
    .replace('</article></div></article>', '</div></div></article>')
    .replace(' id="sd-title"', '')
    .replaceAll('opinion-title', 'meinung-title')
    .replace(/ aria-label="(?:Einleitung|Introduction|Drei Teams|Three teams|Release Gate)"/g, '')
    .replaceAll('/src/assets/marvin-jakob.jpg', AVATAR.src)
    .replaceAll('/src/assets/topics/harness.png', '/artikelbild-harness.png')
    .replaceAll(`/src/assets/topics/development-process_${lang}.png`, `/artikelbild-entwicklungsprozess-${lang}.png`)
    .replaceAll(`/src/assets/topics/releasegate_${lang}.png`, `/artikelbild-release-gate-${lang}.png`);
  return html;
}

describe('REQ-136-AC2/AC3: überführte Artikel erzeugen den Seitenaufbau von vor der Überführung', () => {
  for (const slug of ['vibe-coding', 'softwareentwicklung']) {
    for (const lang of ['de', 'en'] as const) {
      it(`${slug} (${lang})`, () => {
        const actual = render(lang, imported(slug)[lang]);
        const expected = golden(slug, lang);
        // Zuerst der sichtbare Text in Reihenfolge: Eine Abweichung nennt so die betroffene Stelle.
        expect(dom(actual).body.textContent).toBe(dom(expected).body.textContent);
        expect(Array.from(dom(actual).querySelectorAll('img'), (i) => [i.getAttribute('src'), i.getAttribute('alt')])).toEqual(
          Array.from(dom(expected).querySelectorAll('img'), (i) => [i.getAttribute('src'), i.getAttribute('alt')]),
        );
        expect(Array.from(dom(actual).querySelectorAll('a'), (a) => a.getAttribute('href'))).toEqual(
          Array.from(dom(expected).querySelectorAll('a'), (a) => a.getAttribute('href')),
        );
        expect(actual.replace(/></g, '>\n<')).toBe(expected.replace(/></g, '>\n<'));
      });
    }
  }
});

describe('REQ-136-AC15: Autor, Stand und Lesezeit im Artikelkopf', () => {
  it('Lesezeit der überführten Artikel entspricht dem Stand vor der Überführung', () => {
    const before = JSON.parse(read('src/test/golden/lesezeit.json')) as Record<string, number>;
    // Sollwerte aus dem bisherigen Stand: 9 und 10 Minuten für „Vibe Coding“, je 4 Minuten für „Softwareentwicklung“.
    expect(before).toEqual({ 'vibe-coding.de': 9, 'vibe-coding.en': 10, 'softwareentwicklung.de': 4, 'softwareentwicklung.en': 4 });
    for (const [key, minutes] of Object.entries(before)) {
      const [slug, lang] = key.split('.') as [string, Lang];
      expect(readingMinutes(articleReadingText(imported(slug)[lang])), key).toBe(minutes);
    }
  });

  it('zählt Titel, Untertitel und sichtbare Texte der Bausteine, nicht Alternativtexte und Schaltflächen', () => {
    const words = (n: number) => Array.from({ length: n }, () => 'Wort').join(' ');
    const content: Text = { title: words(10), subtitle: words(10), blocks: [
      { kind: 'paragraph', text: words(50) },
      { kind: 'section', eyebrow: words(5), text: words(5), blocks: [{ kind: 'paragraph', text: words(20) }] },
      { kind: 'ordered', items: [{ title: words(10), description: words(10) }] },
      { kind: 'image', src: '/artikelbild-harness.png', alt: words(500), caption: words(1) },
      { kind: 'cta', text: words(0), label: words(500), href: '/de/kontakt' },
    ] };
    // 10 + 10 + 50 + 5 + 5 + 20 + 10 + 10 + 1 = 121 Wörter, bei 120 Wörtern je Minute aufgerundet 2 Minuten.
    expect(readingMinutes(articleReadingText(content))).toBe(2);
    content.blocks.pop();
    content.blocks.pop();
    expect(readingMinutes(articleReadingText(content))).toBe(1);
  });

  it('ohne Profilbild und ohne Stand erscheinen nur Name und Lesezeit', () => {
    const doc = dom(render('de', { title: 'Titel', blocks: [{ kind: 'paragraph', text: 'Text' }] }, { authorAvatar: undefined, updated: undefined }));
    const byline = doc.querySelector('.byline')!;
    expect(byline.querySelector('img')).toBeNull();
    expect(byline.querySelector('time')).toBeNull();
    expect(byline.textContent).toBe('Marvin Jakobca. 1 Min. Lesezeit');
  });

  it('englische Fassung nennt Stand und Lesezeit auf Englisch', () => {
    const doc = dom(render('en', { title: 'Title', blocks: [] }));
    expect(doc.querySelector('.byline')!.textContent).toBe('Marvin JakobUpdated: 16 November 2026 · approx. 1 min read');
    expect(doc.querySelector('.byline img')!.getAttribute('src')).toBe(AVATAR.src);
  });
});

describe('REQ-136-AC8/AC9: Formatierung und Links in der öffentlichen Darstellung', () => {
  const block = (b: Block) => dom(render('de', { title: 'Titel', blocks: [b] })).querySelector('.managed-article')!;

  it('setzt fett, kursiv, unterstrichen und Links an die gespeicherten Positionen', () => {
    const p = block({ kind: 'paragraph', text: 'Größe 😀 fett und Link', spans: [
      { start: 9, end: 13, bold: true, italic: true, underline: true }, { start: 18, end: 22, href: 'https://example.org/x' },
    ] }).querySelector('p')!;
    expect(p.textContent).toBe('Größe 😀 fett und Link');
    expect(p.querySelector('strong')!.textContent).toBe('fett');
    expect(p.querySelector('em')!.textContent).toBe('fett');
    expect(p.querySelector('u')!.textContent).toBe('fett');
    const link = p.querySelector('a')!;
    expect([link.textContent, link.getAttribute('href'), link.getAttribute('rel')]).toEqual(['Link', 'https://example.org/x', 'noopener noreferrer']);
  });

  it('gibt nur zulässige Linkziele aus', () => {
    const p = block({ kind: 'paragraph', text: 'eins zwei', spans: [
      { start: 0, end: 4, href: 'javascript:alert(1)' }, { start: 5, end: 9, href: '/de/kontakt' },
    ] }).querySelector('p')!;
    expect(Array.from(p.querySelectorAll('a'), (a) => [a.textContent, a.getAttribute('href')])).toEqual([['zwei', '/de/kontakt']]);
    expect(p.textContent).toBe('eins zwei');
  });

  it('formatiert Listeneinträge', () => {
    const li = block({ kind: 'unordered', items: [{ title: 'Punkt eins', description: 'Mehr dazu', spans: [{ start: 6, end: 10, italic: true }],
      descriptionSpans: [{ start: 0, end: 4, underline: true }] }] }).querySelector('li')!;
    expect(li.querySelector('em')!.textContent).toBe('eins');
    expect(li.querySelector('u')!.textContent).toBe('Mehr');
  });
});

describe('REQ-136-AC11: Layout-Elemente', () => {
  const blocks: Block[] = [
    { kind: 'paragraph', text: 'Anfang' }, { kind: 'outline' },
    { kind: 'section', eyebrow: 'Eins', text: 'Erster Abschnitt', blocks: [{ kind: 'paragraph', text: 'A' }] },
    { kind: 'section', anchor: 'zwei', eyebrow: 'Zwei', text: 'Zweiter Abschnitt', blocks: [
      { kind: 'example', label: 'Beispiel', text: 'Fall' }] },
    { kind: 'conclusion', eyebrow: 'Fazit', text: 'Schluss', blocks: [{ kind: 'paragraph', text: 'Ende' }] },
  ];

  it('nummeriert Abschnitte fortlaufend und listet sie in der Abschnittsübersicht mit Sprungziel', () => {
    for (const layout of ['column', 'wide', 'magazine'] as const) {
      const doc = dom(render('de', { title: 'Titel', layout, blocks }));
      expect(Array.from(doc.querySelectorAll('.vc-number'), (n) => n.textContent), layout).toEqual(['01', '02']);
      const links = Array.from(doc.querySelectorAll('.vc-index a'));
      expect(links.map((a) => a.textContent), layout).toEqual(['01EinsErster Abschnitt', '02ZweiZweiter Abschnitt']);
      for (const a of links) {
        const target = doc.getElementById(a.getAttribute('href')!.slice(1))!;
        expect(target.matches('section.vc-perspective'), layout).toBe(true);
        expect(target.getAttribute('tabindex')).toBe('-1');
      }
      expect(links[1].getAttribute('href')).toBe('#zwei');
      expect(doc.querySelector('.vc-conclusion h2')!.textContent).toBe('Schluss');
      const example = doc.querySelector('figure.vc-example')!;
      expect(doc.getElementById(example.getAttribute('aria-labelledby')!)!.textContent).toBe('Beispiel');
    }
  });

  it('rendert Verweis, Zitatüberschrift, Kernaussage, Einleitung und Aufruf in der bisherigen Gestaltung', () => {
    const doc = dom(render('de', { title: 'Titel', layout: 'wide', blocks: [
      { kind: 'lead', text: 'Einleitung' }, { kind: 'statement', text: 'Kernaussage' },
      { kind: 'related', label: 'Weiterlesen', text: 'Zum Thema', href: '/de/themen/vibe-coding' },
      { kind: 'quoteheading', text: '„Zitat“', attribution: '– Quelle' },
      { kind: 'cta', text: 'Frage?', description: 'Schreib mir.', label: 'Zum Formular', href: '/de/kontakt' },
    ] }));
    expect(doc.querySelector('p.article-lead')!.textContent).toBe('Einleitung');
    expect(doc.querySelector('blockquote.vc-quote p')!.textContent).toBe('Kernaussage');
    const related = doc.querySelector('a.related-link')!;
    expect([related.getAttribute('href'), related.querySelector('.related-label')!.textContent, related.querySelector('.related-title')!.textContent])
      .toEqual(['/de/themen/vibe-coding', 'Weiterlesen', 'Zum Thema']);
    expect(doc.querySelector('h2.quote-heading small')!.textContent).toBe('– Quelle');
    const cta = doc.querySelector('section.opinion')!;
    expect([cta.querySelector('h2')!.textContent, cta.querySelector('p')!.textContent, cta.querySelector('a')!.textContent!.trim(), cta.querySelector('a')!.getAttribute('href')])
      .toEqual(['Frage?', 'Schreib mir.', 'Zum Formular', '/de/kontakt']);
  });

  it('REQ-136-AC12: ohne Layout bleibt die schmale Lesespalte aus #67', () => {
    const html = render('de', { title: 'Titel', blocks: [{ kind: 'paragraph', text: 'Text' }, { kind: 'h1', text: 'Abschnitt' }] });
    expect(html).toContain('<div class="article prose managed-article"><p>Text</p><h2>Abschnitt</h2></div>');
  });
});
