import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import personaSource from '../../../content/Persona.md?raw';
import { profile } from './i18n/profile';
import { installFakeApi, renderApp } from './test/fakeApi';

beforeEach(() => { installFakeApi(); });

/**
 * Zerlegt content/Persona.md in Abschnitte (`# `) und Unterabschnitte (`## `) mit ihren nicht leeren Zeilen.
 * Der einfache Bindestrich zwischen Wörtern wird wie auf der Seite als Gedankenstrich gelesen.
 */
function readPersona() {
  const sections = new Map<string, { lines: string[]; subsections: Map<string, string[]> }>();
  let section: { lines: string[]; subsections: Map<string, string[]> } | undefined;
  let lines: string[] = [];
  for (const raw of personaSource.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim().replace(/ - /g, ' – ');
    if (line.startsWith('# ')) {
      section = { lines: [], subsections: new Map() };
      sections.set(line.slice(2), section);
      lines = section.lines;
    } else if (line.startsWith('## ')) {
      lines = [];
      section!.subsections.set(line.slice(3), lines);
    } else if (line) {
      lines.push(line);
    }
  }
  const get = (name: string) => {
    const found = sections.get(name);
    if (!found) throw new Error(`Abschnitt „${name}“ fehlt in Persona.md`);
    return found;
  };
  return { sections, get };
}

const labelled = (line: string, label: string) => {
  const prefix = `**${label}:** `;
  expect(line.startsWith(prefix)).toBe(true);
  return line.slice(prefix.length);
};

describe('Ticket 124: Profilseite nach content/Persona.md', () => {
  it('zeigt alle deutschen Inhalte der Persona wortgleich und in ihrer Reihenfolge', async () => {
    const persona = readPersona();
    const de = profile.de;
    renderApp('/de/profil');
    const article = await screen.findByRole('article');

    const [intro] = persona.sections.keys();
    const [name, headline, accent] = persona.get(intro).lines;
    expect(intro).toBe(de.label);
    expect(within(article).getByRole('heading', { level: 1, name })).toBeInTheDocument();
    expect(within(article).getByText(intro)).toHaveClass('eyebrow');
    expect(article.querySelector('.profile-headline')).toHaveTextContent(`${headline}${accent}`);
    expect(article.querySelector('.profile-headline span')).toHaveTextContent(accent);

    expect(within(article).getByText(persona.get('Leitsatz').lines[0])).toHaveClass('profile-motto');
    const tags = within(article).getByRole('list', { name: de.focusLabel });
    expect(within(tags).getAllByRole('listitem').map((li) => li.textContent)).toEqual(persona.get('Tags').lines[0].split(', '));

    const caption = persona.get('Bildunterschrift').lines[0].match(/^\*\*(.+)\*\* – (.+)$/)!;
    expect(article.querySelector('figcaption strong')).toHaveTextContent(caption[1]);
    expect(article.querySelector('figcaption span')).toHaveTextContent(caption[2]);
    expect(within(article).getByRole('img', { name: /Marvin Jakob/ })).toHaveAttribute('width', '1024');

    const about = within(article).getByRole('region', { name: de.aboutTitle });
    expect([...about.querySelectorAll('p')].map((p) => p.textContent)).toEqual(persona.get('Beschreibung').lines);

    const facts = article.querySelector('.profile-facts')!;
    expect([...facts.querySelectorAll('div')].map((div) => [div.querySelector('dt')!.textContent, div.querySelector('dd')!.textContent]))
      .toEqual([...persona.get('Fakten').subsections.values()]);

    const contact = within(article).getByRole('region', { name: de.contactTitle });
    expect(within(contact).getAllByRole('link').map((link) => link.textContent)).toEqual(persona.get('Kontakt').lines);

    const offers = within(article).getByRole('region', { name: 'Beratungsangebote' });
    const personaOffers = [...persona.get('Beratungsangebote').subsections];
    expect(within(offers).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(personaOffers.map(([title]) => title));
    for (const [title, [text, scope, result]] of personaOffers) {
      const offer = within(offers).getByRole('region', { name: title });
      expect(within(offer).getByText(text).tagName).toBe('P');
      expect(within(offer).getByText('Leistungsumfang').nextElementSibling).toHaveTextContent(labelled(scope, 'Leistungsumfang'));
      expect(within(offer).getByText('Ergebnis').nextElementSibling).toHaveTextContent(labelled(result, 'Ergebnis'));
    }

    const order = ['.profile-hero', '.profile-about', '.profile-facts', '.profile-contact', '.profile-section']
      .map((selector) => article.querySelector(selector)!);
    order.slice(1).forEach((el, i) => expect(order[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
  });

  it('übersetzt jede Persona-Angabe vollständig ins Englische', () => {
    const { de, en } = profile;
    for (const key of ['tags', 'about', 'facts', 'offers'] as const) expect(en[key]).toHaveLength(de[key].length);
    for (const value of [...en.tags, ...en.about, ...en.facts.flatMap(Object.values), ...en.offers.flatMap(Object.values)]) {
      expect(value).not.toBe('');
      expect([...de.tags, ...de.about, ...de.facts.flatMap(Object.values), ...de.offers.flatMap(Object.values)]).not.toContain(value);
    }
  });

  it('wechselt beide Profilfassungen und die Metadaten ohne Sprachfallback', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/de/profil');
    await screen.findByRole('heading', { level: 1, name: 'Marvin Jakob' });
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(router.state.location.pathname).toBe('/en/profil');
    expect(screen.getByText(profile.en.motto)).toBeInTheDocument();
    expect(screen.queryByText(profile.de.motto)).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'About me' })).toHaveTextContent(profile.en.about[0]);
    const offers = screen.getByRole('region', { name: 'Consulting services' });
    expect(within(offers).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(profile.en.offers.map((o) => o.title));
    expect(within(offers).getAllByText('Scope of services')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Explore consulting services' })).toHaveAttribute('href', '#offers-title');
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'Illustrated portrait of Marvin Jakob against a colourful background');
    expect(document.title).toBe('Marvin Jakob – Profile · KI Perspektiven');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', profile.en.description);
    await user.click(screen.getByRole('button', { name: 'Deutsch' }));
    expect(router.state.location.pathname).toBe('/de/profil');
    expect(screen.getByText(profile.de.motto)).toBeInTheDocument();
    expect(document.title).toBe('Marvin Jakob – Profil · KI Perspektiven');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', profile.de.description);
  });

  it.each([
    ['de', 'de-DE', 'Mail'],
    ['en', 'en-US', 'Email'],
  ])('führt die Kontaktlinks in %s zu LinkedIn und zur Impressumsadresse', async (lang, locale, mail) => {
    renderApp(`/${lang}/profil`);
    const contact = await screen.findByRole('region', { name: lang === 'de' ? 'Kontakt' : 'Contact' });
    expect(within(contact).getByRole('link', { name: 'LinkedIn' }))
      .toHaveAttribute('href', `https://www.linkedin.com/in/marvin-jakob-b5b27726b/?locale=${locale}`);
    expect(within(contact).getByRole('link', { name: mail })).toHaveAttribute('href', 'mailto:mail@marvinjakob.de');
  });

  it('verlinkt die fokussierbare Angebotsüberschrift', async () => {
    renderApp('/de/profil');
    const discover = await screen.findByRole('link', { name: 'Beratungsangebote entdecken' });
    const target = document.querySelector(discover.getAttribute('href')!);
    expect(target).toBe(screen.getByRole('heading', { level: 2, name: 'Beratungsangebote' }));
    expect(target).toHaveAttribute('tabindex', '-1');
  });

  it.each(['de', 'en'])('ersetzt in %s die bisherigen Profilinhalte ohne zusätzliche Verweise', async (lang) => {
    renderApp(`/${lang}/profil`);
    const article = await screen.findByRole('article');
    expect(within(article).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      `/${lang}`, '#offers-title', profile[lang as 'de' | 'en'].linkedinUrl, 'mailto:mail@marvinjakob.de',
    ]);
    expect(article.querySelector('details')).toBeNull();
    expect(article).not.toHaveTextContent(/AWS|IT Service Owner|Product Owner|2020 – 2022/);
  });
});

describe('Ticket 42: Profil in der Hauptnavigation', () => {
  const paths = ['', '/blog', '/blog/neu', '/themen/softwareentwicklung', '/themen/ai-audit', '/themen/ai-audit/daten-und-wissen', '/impressum', '/datenschutz', '/gibt-es-nicht'];

  it.each(['de', 'en'])('verlinkt das Profil von allen öffentlichen Seitentypen in %s ohne aktive Markierung', async (lang) => {
    const { router } = renderApp(`/${lang}`);
    for (const path of paths) {
      await act(() => router.navigate(`/${lang}${path}`));
      const nav = screen.getByRole('navigation', { name: /^(Hauptnavigation|Main navigation)$/ });
      const link = within(nav).getByRole('link', { name: lang === 'de' ? 'Profil' : 'Profile' });
      expect(link).toHaveAttribute('href', `/${lang}/profil`);
      expect(link).not.toHaveAttribute('aria-current');
      expect(link).not.toHaveClass('is-active');
    }
  });

  it.each(['de', 'en'])('öffnet das Profil in %s per Tastatur, markiert es aktiv und wechselt die Sprache', async (lang) => {
    const user = userEvent.setup();
    const { router } = renderApp(`/${lang}/blog`);
    const nav = screen.getByRole('navigation', { name: /^(Hauptnavigation|Main navigation)$/ });
    const link = within(nav).getByRole('link', { name: lang === 'de' ? 'Profil' : 'Profile' });
    for (let i = 0; i < 12 && document.activeElement !== link; i++) await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(router.state.location.pathname).toBe(`/${lang}/profil`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Marvin Jakob' })).toBeInTheDocument();
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveClass('is-active');
    const next = lang === 'de' ? 'en' : 'de';
    await user.click(screen.getByRole('button', { name: next === 'en' ? 'English' : 'Deutsch' }));
    const translated = within(nav).getByRole('link', { name: next === 'en' ? 'Profile' : 'Profil' });
    expect(translated).toHaveAttribute('href', `/${next}/profil`);
    expect(translated).toHaveAttribute('aria-current', 'page');
    expect(translated).toHaveClass('is-active');
    await act(() => router.navigate(`/${next}/profil/`));
    expect(translated).toHaveAttribute('aria-current', 'page');
    await user.click(within(nav).getByRole('link', { name: 'Blog' }));
    expect(translated).not.toHaveAttribute('aria-current');
    expect(translated).not.toHaveClass('is-active');
  });
});

// Ticket #102: Profilseite und ihr Themenmenü verweisen nicht mehr auf die entfernten Themen.
it.each(['de', 'en'])('verlinkt vom Profil in %s keine entfernten Themen', async (lang) => {
  const user = userEvent.setup();
  renderApp(`/${lang}/profil`);
  await screen.findByRole('heading', { level: 1, name: 'Marvin Jakob' });
  await user.click(screen.getByRole('button', { name: lang === 'de' ? 'Themen' : 'Topics' }));
  const menu = document.querySelector('.popover') as HTMLElement;
  const links = await within(menu).findAllByRole('link');
  expect(links.map((a) => a.getAttribute('href'))).toEqual(
    ['softwareentwicklung', 'data-analytics', 'modelle-und-kosten'].map((slug) => `/${lang}/themen/${slug}`),
  );
  const hrefs = [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '');
  expect(hrefs.filter((h) => /prozessautomatisierung|ki-tipps-und-tricks/.test(h))).toEqual([]);
});
