// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { LangContext, type Lang } from '../lib/lang';
import { PostAuthor, type Author } from './PostAuthor';

// Anforderung #64, REQ-64-AC9: öffentliche Autorenanzeige redaktioneller Beiträge.
// Der Fidelity-Test mit echtem Backend steht in app/e2e/tests/64-rollen-profile.spec.ts.
function render(author: Author | undefined, lang: Lang = 'de') {
  const t = ((key: string) => key) as unknown as TFunction;
  const html = renderToStaticMarkup(
    <LangContext.Provider value={{ lang, t }}>
      <PostAuthor author={author} />
    </LangContext.Provider>,
  );
  return new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html').getElementById('root')!;
}

const avatar = { src: '/media/abc-480.jpg', width: 480, height: 480 };

describe('PostAuthor', () => {
  it('REQ-64-AC9: zeigt gepflegten Namen und Profilbild des Autors', () => {
    const root = render({ name: 'Erika Muster', avatar });
    expect(root.querySelector('.post-author strong')?.textContent).toBe('Erika Muster');
    const img = root.querySelector('.post-author img');
    expect(img?.getAttribute('src')).toBe('/media/abc-480.jpg');
    // Der Name steht daneben; das Bild ist für Screenreader dekorativ.
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('REQ-64-AC9: ohne Profilbild erscheint nur der Name', () => {
    const root = render({ name: 'Erika Muster' });
    expect(root.querySelector('.post-author strong')?.textContent).toBe('Erika Muster');
    expect(root.querySelector('.post-author img')).toBeNull();
  });

  it('REQ-64-AC9: ohne Autor oder ohne Namen gibt es keine Autorenzeile', () => {
    expect(render(undefined).innerHTML).toBe('');
    expect(render({ name: '   ', avatar }).innerHTML).toBe('');
  });

  it('REQ-64-AC9: benennt den Autor sprachabhängig für Screenreader', () => {
    expect(render({ name: 'Erika Muster' }, 'de').textContent).toContain('Autor');
    expect(render({ name: 'Erika Muster' }, 'en').textContent).toContain('Author');
  });
});
