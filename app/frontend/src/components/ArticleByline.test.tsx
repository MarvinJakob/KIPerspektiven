// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { LangContext, type Lang } from '../lib/lang';
import { ArticleByline } from './ArticleByline';

// Anforderung #56: Metadatenblock im Artikelkopf – links rundes Porträt, rechts Name, darunter „Stand · Lesezeit“.
function render(lang: Lang, text: string[]) {
  const t = ((key: string) => key) as unknown as TFunction;
  const html = renderToStaticMarkup(
    <LangContext.Provider value={{ lang, t }}>
      <ArticleByline author="Marvin Jakob" portrait="/portrait.jpg" updated="2026-11-16" text={text} />
    </LangContext.Provider>,
  );
  return new DOMParser().parseFromString(html, 'text/html').querySelector('.byline')!;
}

describe('ArticleByline', () => {
  it('REQ-56-AC1: Porträt steht vor dem hervorgehobenen Namen, die Metazeile folgt dem Namen', () => {
    const byline = render('de', ['eins']);
    const [img, name, meta] = [byline.querySelector('img'), byline.querySelector('strong'), byline.querySelector('.byline-meta')];
    expect(img?.getAttribute('src')).toBe('/portrait.jpg');
    expect(name?.textContent).toBe('Marvin Jakob');
    expect(img!.compareDocumentPosition(name!) & Node.DOCUMENT_POSITION_FOLLOWING, 'Porträt links vom Namen').toBeTruthy();
    expect(name!.compareDocumentPosition(meta!) & Node.DOCUMENT_POSITION_FOLLOWING, 'Metazeile unter dem Namen').toBeTruthy();
  });

  it('REQ-56-AC2/AC3: zeigt Stand und Lesezeit getrennt durch einen Mittelpunkt (DE)', () => {
    const byline = render('de', [Array(121).fill('w').join(' ')]);
    expect(byline.querySelector('.byline-meta')?.textContent).toBe('Stand: 16. November 2026 · ca. 2 Min. Lesezeit');
    expect(byline.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-16');
  });

  it('REQ-56-AC2/AC3: zeigt Stand und Lesezeit auf Englisch', () => {
    const byline = render('en', ['one']);
    expect(byline.querySelector('.byline-meta')?.textContent).toBe('Updated: 16 November 2026 · approx. 1 min read');
  });
});
