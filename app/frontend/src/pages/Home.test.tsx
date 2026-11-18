// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { LangContext, type Lang } from '../lib/lang';
import { Home } from './Home';

// Anforderung #47: Profilteaser „Über mich“ von der Landingpage entfernen.
// Sollwerte aus dem Ticket (Screenshot mit „ÜBER MICH“, „Marvin Jakob“, „Mehr über mich“).

const TEASER = {
  de: { eyebrow: 'Über mich', link: 'Mehr über mich' },
  en: { eyebrow: 'About me', link: 'More about me' },
} as const;

function render(lang: Lang) {
  const t = ((key: string) => key) as unknown as TFunction;
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/${lang}`]}>
      <LangContext.Provider value={{ lang, t }}>
        <Home />
      </LangContext.Provider>
    </MemoryRouter>,
  );
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.querySelector('.home')!;
}

describe.each(['de', 'en'] as const)('Startseite %s', (lang) => {
  it('REQ-47-AC1: enthält keinen Profilteaser mit Name, Kurzbeschreibung oder Profillink', () => {
    const home = render(lang);
    const text = home.textContent ?? '';
    expect(home.querySelector('#ueber-mich'), 'Abschnitt #ueber-mich').toBeNull();
    expect(home.querySelector('.home-about, .home-about-inner'), 'Teaser-Fläche mit Trennlinie').toBeNull();
    expect(text, 'Abschnittsname').not.toContain(TEASER[lang].eyebrow);
    expect(text, 'Profillinktext').not.toContain(TEASER[lang].link);
    expect(text, 'Name').not.toContain('Marvin Jakob');
    expect(text, 'Kurzbeschreibung').not.toContain('Creative IT Specialist');
    expect(home.querySelector(`a[href="/${lang}/profil"]`), 'Profillink im Inhalt').toBeNull();
  });

  it('REQ-47-AC3: die KI-Selbsteinschätzung ist vollständig und der letzte Abschnitt der Startseite', () => {
    const home = render(lang);
    const sections = [...home.children];
    expect(sections.at(-1)?.id, 'letzter Abschnitt').toBe('ki-readiness');
    const check = home.querySelector('#ki-readiness')!;
    expect(check.querySelector('h2#kurzcheck-title'), 'Leitfrage').not.toBeNull();
    expect(check.querySelectorAll('.check-answers button'), 'Antworten Ja, Nein, Überspringen').toHaveLength(3);
    expect(check.querySelectorAll('.check-progress li'), 'Fortschritt über acht Leitfragen').toHaveLength(8);
    expect(check.querySelector(`a[href="/${lang}/themen/ai-audit"]`), 'Selbsteinschätzung starten').not.toBeNull();
  });
});
