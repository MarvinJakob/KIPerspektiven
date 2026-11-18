// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ArticleBlocks } from './ArticleBlocks';

it('REQ-67-AC5–AC9 erhält Reihenfolge, Überschriftenebenen, Medienbeschriftung und Listensemantik', () => {
  const html = renderToStaticMarkup(<ArticleBlocks blocks={[
    { kind: 'paragraph', text: 'Einleitung' }, { kind: 'h1', text: 'Eins' }, { kind: 'h2', text: 'Zwei' },
    { kind: 'h3', text: 'Drei' }, { kind: 'info', text: 'Hinweis' },
    { kind: 'quote', text: 'Wortlaut', attribution: 'Ada' },
    { kind: 'image', src: '/media/example.jpg', alt: 'Schaltbild', caption: 'Abbildung 1' },
    { kind: 'image', src: '/media/example.jpg', alt: 'Detail' },
    { kind: 'ordered', items: [{ title: 'Erstens', description: 'Details' }, { title: 'Zweitens' }] },
    { kind: 'unordered', items: [{ title: 'Weiter' }] },
  ]} />);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  expect(Array.from(doc.querySelectorAll('h1,h2,h3,h4')).map(n => [n.tagName,n.textContent])).toEqual([
    ['H2','Eins'], ['H3','Zwei'], ['H4','Drei'],
  ]);
  expect(doc.querySelector('p')?.textContent).toBe('Einleitung');
  expect(doc.querySelector('aside')?.textContent).toContain('Hinweis');
  expect(doc.querySelector('blockquote')?.textContent).toContain('Wortlaut');
  expect(doc.querySelector('blockquote')?.parentElement?.textContent).toContain('Ada');
  expect(doc.querySelector('img[alt="Schaltbild"]')?.closest('figure')?.querySelector('figcaption')?.textContent).toBe('Abbildung 1');
  expect(doc.querySelector('img[alt="Detail"]')?.closest('figure')?.querySelector('figcaption')).toBeNull();
  expect(Array.from(doc.querySelectorAll('ol > li'), n => n.textContent)).toEqual(['ErstensDetails','Zweitens']);
  expect(doc.querySelector('ul > li')?.textContent).toBe('Weiter');
});
