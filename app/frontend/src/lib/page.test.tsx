// @vitest-environment happy-dom
import type { NavigateFunction } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Anforderung #108: Der Browser-Tab beginnt mit „KI Perspektiven“, danach folgt der Seitenname.
// Sollwerte aus Ticket #108 (Akzeptanzkriterien und Abschnitt „Spezifikation“), nicht aus dem Anwendungscode.
// Fidelity-Tests: app/e2e/tests/108-browsertitel.spec.ts; Backend: app/backend/internal/web/meta_test.go.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SITE = 'KI Perspektiven';

/** Stand der simulierten Detailseite /de/blog/<slug>: geladene Inhaltstitel und Fehlerseite. */
interface Detail {
  titles: Record<string, string | undefined>;
  notFound?: boolean;
}

let cleanup = () => {};
afterEach(() => cleanup());

/**
 * Öffnet die Testanwendung wie ein Direktaufruf von `path`. `serverTitle` ist der Titel aus dem HTML des Backends.
 * Jeder Aufruf lädt die Module neu, damit ein Test wie ein frischer Seitenaufruf beginnt.
 */
async function open(path: string, serverTitle: string, detail: Detail = { titles: {} }) {
  vi.resetModules();
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter, Route, Routes, useNavigate, useParams } = await import('react-router');
  const { useHead } = await import('./page');

  let navigate!: NavigateFunction;
  function Nav() {
    navigate = useNavigate();
    return null;
  }
  function Named({ name }: { name: string }) {
    useHead(name);
    return null;
  }
  // Wie die Beitragsseite: Der Titel fehlt, bis der Inhalt geladen ist; bei 404 erscheint die Fehlerseite als Kind.
  function DetailPage({ state }: { state: Detail }) {
    const { slug = '' } = useParams();
    useHead(state.titles[slug]);
    return state.notFound ? <Named name="Seite nicht gefunden" /> : null;
  }
  const tree = (state: Detail) => (
    <MemoryRouter initialEntries={[path]}>
      <Nav />
      <Routes>
        <Route path="/de" element={<Named name="" />} />
        <Route path="/de/blog" element={<Named name="News" />} />
        <Route path="/de/kontakt" element={<Named name="Kontakt" />} />
        <Route path="/en/kontakt" element={<Named name="Contact" />} />
        <Route path="/de/blog/:slug" element={<DetailPage state={state} />} />
      </Routes>
    </MemoryRouter>
  );

  document.title = serverTitle;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(tree(detail)));
  cleanup = () => {
    act(() => root.unmount());
    host.remove();
    cleanup = () => {};
  };
  return {
    go: (to: string | number) => act(async () => void navigate(to as string)),
    load: (state: Detail) => act(async () => root.render(tree(state))),
  };
}

describe('tabTitle', () => {
  it('REQ-108-AC1: „KI Perspektiven“, genau ein Leerzeichen, Seitenname', async () => {
    const { tabTitle } = await import('./page');
    expect(tabTitle('News')).toBe('KI Perspektiven News');
    expect(tabTitle('Kontakt')).toBe('KI Perspektiven Kontakt');
    expect(tabTitle('Contact')).toBe('KI Perspektiven Contact');
    // Ein Inhaltstitel mit Rand darf weder zwei Leerzeichen noch ein Leerzeichen am Ende erzeugen.
    expect(tabTitle('  Titel mit Rand ')).toBe('KI Perspektiven Titel mit Rand');
  });

  it('REQ-108-AC2: ohne Seitennamen bleibt nur „KI Perspektiven“', async () => {
    const { tabTitle } = await import('./page');
    expect(tabTitle('')).toBe(SITE);
    expect(tabTitle(undefined)).toBe(SITE);
    expect(tabTitle('   ')).toBe(SITE);
  });
});

describe('useHead', () => {
  it('REQ-108-AC1: Unterseite mit Seitennamen zeigt „KI Perspektiven <Seitenname>“', async () => {
    await open('/de/kontakt', 'veralteter Titel');
    expect(document.title).toBe('KI Perspektiven Kontakt');
  });

  it('REQ-108-AC2: Startseite zeigt exakt „KI Perspektiven“', async () => {
    await open('/de', 'veralteter Titel');
    expect(document.title).toBe(SITE);
  });

  it('REQ-108-AC3: beim Direktaufruf bleibt der Titel aus dem HTML stehen, bis der Inhalt geladen ist', async () => {
    const app = await open('/de/blog/a', 'KI Perspektiven Beitrag A');
    expect(document.title, 'während des Ladens').toBe('KI Perspektiven Beitrag A');
    await app.load({ titles: { a: 'Beitrag A' } });
    expect(document.title, 'nach dem Laden').toBe('KI Perspektiven Beitrag A');
  });

  it('REQ-108-AC2: interner Wechsel auf ladenden Inhalt zeigt „KI Perspektiven“, danach den Inhaltstitel', async () => {
    const app = await open('/de/blog', 'KI Perspektiven News');
    await app.go('/de/blog/a');
    expect(document.title, 'während des Ladens').toBe(SITE);
    await app.load({ titles: { a: 'Beitrag A' } });
    expect(document.title, 'nach dem Laden').toBe('KI Perspektiven Beitrag A');
  });

  it('REQ-108-AC2: interner Wechsel auf ladenden Inhalt zeigt „KI Perspektiven“, danach den Titel der Fehlerseite', async () => {
    const app = await open('/de/blog', 'KI Perspektiven News');
    await app.go('/de/blog/fehlt');
    expect(document.title, 'während des Ladens').toBe(SITE);
    await app.load({ titles: {}, notFound: true });
    expect(document.title, 'nach der 404-Antwort').toBe('KI Perspektiven Seite nicht gefunden');
  });

  it('REQ-108-AC2: steht die Fehlerseite beim internen Wechsel sofort fest, gilt ihr Titel', async () => {
    const app = await open('/de/blog', 'KI Perspektiven News', { titles: {}, notFound: true });
    await app.go('/de/blog/fehlt');
    expect(document.title).toBe('KI Perspektiven Seite nicht gefunden');
  });

  it('REQ-108-AC2: Wechsel zwischen zwei ladenden Inhalten zeigt „KI Perspektiven“ statt des vorherigen Titels', async () => {
    const app = await open('/de/blog/a', 'KI Perspektiven Beitrag A');
    await app.go('/de/blog/b');
    expect(document.title, 'Beitrag B lädt').toBe(SITE);
    await app.load({ titles: { b: 'Beitrag B' } });
    expect(document.title, 'Beitrag B geladen').toBe('KI Perspektiven Beitrag B');
  });

  it('REQ-108-AC2: zurück zur zuerst geöffneten Adresse zeigt beim Laden „KI Perspektiven“ statt des verlassenen Titels', async () => {
    const app = await open('/de/blog/a', 'KI Perspektiven Beitrag A');
    await app.go('/de/kontakt');
    expect(document.title).toBe('KI Perspektiven Kontakt');
    await app.go(-1);
    expect(document.title, 'Beitrag A lädt erneut').toBe(SITE);
  });

  it('REQ-108-AC3: Seiten- und Sprachwechsel zeigen den Titel der Zielseite in der gewählten Sprache', async () => {
    const app = await open('/de/blog', 'KI Perspektiven News');
    await app.go('/de/kontakt');
    expect(document.title, 'Seitenwechsel').toBe('KI Perspektiven Kontakt');
    await app.go('/en/kontakt');
    expect(document.title, 'Sprachwechsel').toBe('KI Perspektiven Contact');
    await app.go('/de');
    expect(document.title, 'Startseite').toBe(SITE);
  });
});
