import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { answerConsultations, consultationCalls, holdConsultation, installFakeApi, readinessCalls, renderApp } from './test/fakeApi';

// Ticket #136: Nach der Selbsteinschätzung ein kostenloses Beratungsgespräch per Kontaktformular anfragen.

beforeEach(() => {
  installFakeApi();
});

const TITLE = 'Kostenloses Beratungsgespräch anfragen';
const EMAIL = 'E-Mail-Adresse';
const SEND = 'Anfrage senden';
const SENT = 'Vielen Dank für Ihre Anfrage';

type User = ReturnType<typeof userEvent.setup>;

/** Bewertet beide Dimensionen des Testkatalogs und öffnet die Auswertung. */
async function openResult(user: User, lang: 'de' | 'en' = 'de') {
  renderApp(`/${lang}/themen/ai-audit/strategie-und-wirtschaftlichkeit`);
  const [level, next, show] = lang === 'de' ? ['Stufe 2 Strukturiert', 'Weiter', 'Auswertung anzeigen'] : ['Level 2 Strukturiert', 'Next', 'Show results'];
  await user.click(await screen.findByRole('radio', { name: level }));
  await user.click(screen.getByRole('button', { name: next }));
  await user.click(await screen.findByRole('radio', { name: level.replace('2 Strukturiert', '3 Intelligent') }));
  await user.click(screen.getByRole('button', { name: show }));
  await screen.findByRole('heading', { level: 1 });
}

const offer = () => screen.getByRole('region', { name: TITLE });
const emailField = () => screen.getByRole('textbox', { name: EMAIL });

describe('Ticket #136: Kostenloses Beratungsgespräch anfragen', () => {
  it('zeigt das Angebot nach Abschluss auf der Auswertung, mit der E-Mail-Adresse als einzigem Feld', async () => {
    await openResult(userEvent.setup());
    const region = offer();
    expect(within(region).getByRole('heading', { level: 2, name: TITLE })).toBeInTheDocument();
    expect(region).toHaveTextContent('Wir melden uns per E-Mail, um einen Termin abzustimmen.');

    const field = emailField();
    expect(field).toHaveAttribute('type', 'email');
    expect(field).toHaveAttribute('autocomplete', 'email');
    expect(field).toBeRequired();
    expect(field).toHaveAccessibleDescription(/nur Ihre E-Mail-Adresse, nicht Ihr Ergebnis/);
    expect(field).toHaveAccessibleDescription(/ein Konto brauchen Sie nicht/);
    // Kein weiteres Eingabefeld: weder Name noch Telefon noch Konto.
    expect(within(region).getAllByRole('textbox')).toHaveLength(1);
    expect(within(region).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(region).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Mehr dazu in der Datenschutzerklärung' })).toHaveAttribute('href', '/de/datenschutz');
    expect(within(region).getByRole('button', { name: SEND })).toBeInTheDocument();
  });

  it('steht nach Netzdiagramm, Tabelle und Einordnung; die Auswertung bleibt ohne Anfrage vollständig', async () => {
    await openResult(userEvent.setup());
    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('3 – Intelligent');
    expect(screen.getByRole('heading', { level: 2, name: 'Ihr Reifegradprofil' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Nicht überall auf der höchsten Stufe' })).toBeInTheDocument();
    expect(table.compareDocumentPosition(offer()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: /Zur Übersicht/ })).toBeInTheDocument();
    // Ohne Absenden wird keine Anfrage ausgelöst, auch nicht beim Tippen.
    await userEvent.setup().type(emailField(), 'kundin@beispiel.de');
    expect(consultationCalls).toEqual([]);
  });

  it('erscheint erst, wenn alle Dimensionen bewertet sind', async () => {
    renderApp('/de/themen/ai-audit/auswertung');
    await screen.findByText(/Die Auswertung erscheint, sobald alle Dimensionen bewertet sind/);
    expect(screen.queryByRole('region', { name: TITLE })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('sendet ohne E-Mail-Adresse nichts und nennt den Grund am Feld', async () => {
    const user = userEvent.setup();
    await openResult(user);
    await user.click(screen.getByRole('button', { name: SEND }));
    const field = emailField();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(/Bitte geben Sie Ihre E-Mail-Adresse ein\./);
    expect(field).toHaveFocus();
    expect(consultationCalls).toEqual([]);
    expect(screen.queryByRole('heading', { name: SENT })).not.toBeInTheDocument();

    // Nur Leerzeichen gelten ebenfalls als leer.
    await user.type(field, '   ');
    await user.keyboard('{Enter}');
    expect(field).toHaveAccessibleDescription(/Bitte geben Sie Ihre E-Mail-Adresse ein\./);
    expect(consultationCalls).toEqual([]);
  });

  it.each(['kundin', 'kundin@', 'kundin@beispiel', 'kundin beispiel@test.de', '@beispiel.de', 'a@b@beispiel.de'])(
    'sendet die formal ungültige Adresse „%s“ nicht',
    async (address) => {
      const user = userEvent.setup();
      await openResult(user);
      await user.type(emailField(), address);
      await user.click(screen.getByRole('button', { name: SEND }));
      expect(emailField()).toHaveAttribute('aria-invalid', 'true');
      expect(emailField()).toHaveAccessibleDescription(/Bitte geben Sie eine gültige E-Mail-Adresse ein, zum Beispiel name@beispiel\.de\./);
      expect(consultationCalls).toEqual([]);
    },
  );

  it('nimmt den Hinweis zurück, sobald die Eingabe korrigiert wird', async () => {
    const user = userEvent.setup();
    await openResult(user);
    await user.type(emailField(), 'kundin');
    await user.click(screen.getByRole('button', { name: SEND }));
    expect(emailField()).toHaveAttribute('aria-invalid', 'true');
    await user.type(emailField(), '@beispiel.de');
    expect(emailField()).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/Bitte geben Sie eine gültige/)).not.toBeInTheDocument();
  });

  it('sendet eine gültige Adresse mit der Sprache der Seite und bestätigt erst nach erfolgreicher Übermittlung', async () => {
    const user = userEvent.setup();
    await openResult(user);
    const answer = holdConsultation();
    await user.type(emailField(), '  kundin@beispiel.de ');
    await user.click(screen.getByRole('button', { name: SEND }));

    // Während der Übermittlung: noch keine Bestätigung, ein zweiter Klick sendet nicht doppelt.
    const busy = await screen.findByRole('button', { name: 'Anfrage wird gesendet …' });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    await user.click(busy);
    expect(consultationCalls).toEqual([{ email: 'kundin@beispiel.de', lang: 'de' }]);
    expect(screen.queryByRole('heading', { name: SENT })).not.toBeInTheDocument();

    answer(204);
    const done = await screen.findByRole('heading', { level: 2, name: SENT });
    expect(done).toHaveFocus();
    expect(screen.getByRole('region', { name: SENT })).toHaveTextContent(
      'Ihre Anfrage ist eingegangen. Wir melden uns per E-Mail an kundin@beispiel.de, um einen Termin für das kostenlose Beratungsgespräch abzustimmen.',
    );
    expect(screen.queryByRole('textbox', { name: EMAIL })).not.toBeInTheDocument();
    expect(consultationCalls).toHaveLength(1);
    // Das Ergebnis wird mit der Anfrage nicht übertragen und ohne Einwilligung auch sonst nicht.
    expect(Object.keys(consultationCalls[0])).toEqual(['email', 'lang']);
    expect(readinessCalls).toEqual([]);
    expect(screen.getByRole('table')).toHaveTextContent('3 – Intelligent');
  });

  it('meldet einen Übermittlungsfehler verständlich und lässt die Anfrage erneut senden', async () => {
    const user = userEvent.setup();
    await openResult(user);
    answerConsultations(500);
    await user.type(emailField(), 'kundin@beispiel.de');
    await user.click(screen.getByRole('button', { name: SEND }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ihre Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.');
    expect(screen.queryByRole('heading', { name: SENT })).not.toBeInTheDocument();
    expect(emailField()).toHaveValue('kundin@beispiel.de');

    await user.click(screen.getByRole('button', { name: SEND }));
    expect(await screen.findByRole('heading', { name: SENT })).toBeInTheDocument();
    expect(consultationCalls).toEqual([
      { email: 'kundin@beispiel.de', lang: 'de' },
      { email: 'kundin@beispiel.de', lang: 'de' },
    ]);
  });

  it('meldet auch einen Netzfehler und zu viele Anfragen', async () => {
    const user = userEvent.setup();
    await openResult(user);
    answerConsultations(429);
    await user.type(emailField(), 'kundin@beispiel.de');
    await user.click(screen.getByRole('button', { name: SEND }));
    expect(await screen.findByRole('alert')).toHaveTextContent('zu viele Anfragen eingegangen. Bitte versuchen Sie es in einer Stunde erneut.');

    const fetchMock = globalThis.fetch as unknown as { mockRejectedValueOnce: (e: Error) => void };
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await user.click(screen.getByRole('button', { name: SEND }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ihre Anfrage konnte nicht gesendet werden.');
    expect(screen.queryByRole('heading', { name: SENT })).not.toBeInTheDocument();
  });

  it('zeigt den Hinweis am Feld, wenn das Backend die Adresse ablehnt', async () => {
    const user = userEvent.setup();
    await openResult(user);
    answerConsultations(422);
    await user.type(emailField(), 'kun..din@beispiel.de');
    await user.click(screen.getByRole('button', { name: SEND }));
    expect(await screen.findByText(/Bitte geben Sie eine gültige E-Mail-Adresse ein/)).toBeInTheDocument();
    expect(emailField()).toHaveAttribute('aria-invalid', 'true');
    expect(emailField()).toHaveFocus();
  });

  it('bietet das Gespräch auch auf Englisch an', async () => {
    const user = userEvent.setup();
    await openResult(user, 'en');
    const region = screen.getByRole('region', { name: 'Request a free consultation' });
    const field = within(region).getByRole('textbox', { name: 'Email address' });
    await user.click(within(region).getByRole('button', { name: 'Send request' }));
    expect(field).toHaveAccessibleDescription(/Please enter your email address\./);
    await user.type(field, 'client@example.com');
    await user.click(within(region).getByRole('button', { name: 'Send request' }));
    expect(await screen.findByRole('heading', { name: 'Thank you for your request' })).toBeInTheDocument();
    expect(region).toHaveTextContent('We will email you at client@example.com to arrange an appointment');
    expect(consultationCalls).toEqual([{ email: 'client@example.com', lang: 'en' }]);
  });
});
