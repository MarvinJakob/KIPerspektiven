// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { PostSummary } from '../api/client';
import { LangContext } from '../lib/lang';
import { PostList } from './PostRow';

// Anforderung #138, REQ-138-AC5: Beitragszeilen zeigen ein Vorschaubild nur bei vorhandenem Titelbild.
// Der Fidelity-Test mit echtem Backend steht in app/e2e/tests/138-news-desktop-layout.spec.ts.
const post = (slug: string, cover?: PostSummary['cover']): PostSummary => ({
  slug,
  lang: 'de',
  title: `Titel ${slug}`,
  summary: `Kurztext ${slug}`,
  publishedAt: '2026-11-24T08:00:00Z',
  featured: false,
  topics: [{ slug: 'softwareentwicklung', lang: 'de', title: 'KI in der Softwareentwicklung', label: 'Softwareentwicklung' }],
  translations: ['de'],
  cover,
});

const cover = { src: '/media/abc-960.jpg', srcset: '/media/abc-480.jpg 480w, /media/abc-960.jpg 960w', width: 960, height: 720, alt: 'Stadion von oben' };

function rows(posts: PostSummary[]) {
  const t = ((key: string) => key) as unknown as TFunction;
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <LangContext.Provider value={{ lang: 'de', t }}>
        <PostList posts={posts} />
      </LangContext.Provider>
    </MemoryRouter>,
  );
  const root = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html').getElementById('root')!;
  return [...root.querySelectorAll<HTMLAnchorElement>('a[href^="/de/blog/"]')];
}

describe('Beitragszeile', () => {
  it('REQ-138-AC5: ohne Titelbild gibt es weder Vorschaubild noch Platzhaltergrafik', () => {
    const [row] = rows([post('ohne-bild')]);
    expect(row.querySelector('img'), 'kein Bild').toBeNull();
    expect(row.querySelector('svg'), 'keine Platzhaltergrafik').toBeNull();
    expect(row.querySelector('[aria-hidden="true"]:not(i)'), 'keine dekorative Bildfläche').toBeNull();
    // Der Inhalt der Zeile bleibt vollständig.
    expect(row.textContent).toContain('Titel ohne-bild');
    expect(row.textContent).toContain('Kurztext ohne-bild');
    expect(row.textContent).toContain('Softwareentwicklung');
  });

  it('REQ-138-AC5: mit Titelbild erscheint das Vorschaubild mit Alternativtext', () => {
    const [row] = rows([post('mit-bild', cover)]);
    const img = row.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/media/abc-960.jpg');
    expect(img?.getAttribute('alt')).toBe('Stadion von oben');
    expect(row.querySelector('svg'), 'keine Platzhaltergrafik neben dem Bild').toBeNull();
  });

  it('REQ-138-AC5: in einer gemischten Liste erhält nur die Zeile mit Titelbild ein Bild', () => {
    const list = rows([post('ohne-bild'), post('mit-bild', cover), post('auch-ohne')]);
    expect(list.map((r) => r.querySelectorAll('img').length)).toEqual([0, 1, 0]);
    expect(list.map((r) => r.querySelectorAll('svg').length)).toEqual([0, 0, 0]);
  });
});
