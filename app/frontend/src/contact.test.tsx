import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { validateContact } from './pages/Contact';
import { answerContact, contactCalls, installFakeApi, renderApp } from './test/fakeApi';

// Anforderung #4: Kontaktseite mit Nachrichtenformular.

beforeEach(() => {
  installFakeApi();
});

const field = (name: string | RegExp) => screen.getByRole('textbox', { name });

describe('Anforderung #4: Kontaktseite', () => {
  it('ist über den Link „Kontakt“ im Fußbereich erreichbar und zeigt alle Felder', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/de');
    await user.click(await screen.findByRole('link', { name: 'Kontakt' }));
    expect(router.state.location.pathname).toBe('/de/kontakt');
    expect(screen.getByRole('heading', { level: 1, name: 'Kontakt' })).toBeInTheDocument();
    expect(field('Name')).toBeRequired();
    expect(field('Unternehmen (optional)')).not.toBeRequired();
    expect(field('E-Mail-Adresse')).toHaveAttribute('type', 'email');
    expect(field('Nachricht').tagName).toBe('TEXTAREA');
    expect(screen.getByRole('button', { name: 'Nachricht senden' })).toBeInTheDocument();
  });

  it('meldet fehlende Pflichtangaben am Feld und sendet nichts', async () => {
    const user = userEvent.setup();
    renderApp('/de/kontakt');
    await user.click(await screen.findByRole('button', { name: 'Nachricht senden' }));

    expect(field('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(field('Name')).toHaveAccessibleDescription('Bitte geben Sie Ihren Namen ein.');
    expect(field('E-Mail-Adresse')).toHaveAccessibleDescription('Bitte geben Sie Ihre E-Mail-Adresse ein.');
    expect(field('Nachricht')).toHaveAccessibleDescription('Bitte geben Sie eine Nachricht ein.');
    expect(field('Unternehmen (optional)')).not.toHaveAttribute('aria-invalid');
    expect(field('Name')).toHaveFocus();
    expect(contactCalls).toHaveLength(0);

    // Die Meldung verschwindet, sobald das Feld bearbeitet wird.
    await user.type(field('Name'), 'Erika');
    expect(field('Name')).not.toHaveAttribute('aria-invalid');
  });

  it('meldet eine ungültige E-Mail-Adresse und behält alle Eingaben', async () => {
    const user = userEvent.setup();
    renderApp('/de/kontakt');
    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Erika Muster');
    await user.type(field('E-Mail-Adresse'), 'max.mustermann@');
    await user.type(field('Nachricht'), 'Hallo');
    await user.click(screen.getByRole('button', { name: 'Nachricht senden' }));

    expect(field('E-Mail-Adresse')).toHaveAccessibleDescription(/gültige E-Mail-Adresse/);
    expect(field('E-Mail-Adresse')).toHaveFocus();
    expect(field('Name')).not.toHaveAttribute('aria-invalid');
    expect(field('Name')).toHaveValue('Erika Muster');
    expect(field('E-Mail-Adresse')).toHaveValue('max.mustermann@');
    expect(field('Nachricht')).toHaveValue('Hallo');
    expect(contactCalls).toHaveLength(0);
  });

  it('sendet die Nachricht ohne Unternehmen und zeigt eine Bestätigung', async () => {
    const user = userEvent.setup();
    renderApp('/de/kontakt');
    await user.type(await screen.findByRole('textbox', { name: 'Name' }), ' Erika Muster ');
    await user.type(field('E-Mail-Adresse'), 'erika@beispiel.de');
    await user.type(field('Nachricht'), 'Hallo zusammen');
    await user.click(screen.getByRole('button', { name: 'Nachricht senden' }));

    const done = await screen.findByRole('heading', { level: 2, name: 'Vielen Dank für Ihre Nachricht' });
    expect(done).toHaveFocus();
    expect(screen.getByText(/Wir melden uns per E-Mail an erika@beispiel.de/)).toBeInTheDocument();
    expect(contactCalls).toEqual([{ name: 'Erika Muster', email: 'erika@beispiel.de', message: 'Hallo zusammen', lang: 'de' }]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Weitere Nachricht schreiben' }));
    expect(field('Name')).toHaveValue('');
  });

  it('zeigt auf Englisch englische Texte und überträgt Unternehmen und Sprache', async () => {
    const user = userEvent.setup();
    renderApp('/en/kontakt');
    await user.click(await screen.findByRole('button', { name: 'Send message' }));
    expect(field('Name')).toHaveAccessibleDescription('Please enter your name.');
    expect(field('Email address')).toHaveAccessibleDescription('Please enter your email address.');
    expect(field('Message')).toHaveAccessibleDescription('Please enter a message.');

    await user.type(field('Name'), 'Jane Doe');
    await user.type(field('Company (optional)'), 'Example Ltd');
    await user.type(field('Email address'), 'jane@example.org');
    await user.type(field('Message'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Thank you for your message' })).toBeInTheDocument();
    expect(contactCalls).toEqual([
      { name: 'Jane Doe', company: 'Example Ltd', email: 'jane@example.org', message: 'Hello', lang: 'en' },
    ]);
  });

  it('behält die Eingaben, wenn die Übermittlung scheitert, und meldet zu viele Nachrichten', async () => {
    answerContact(500, 429);
    const user = userEvent.setup();
    renderApp('/de/kontakt');
    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Erika');
    await user.type(field('E-Mail-Adresse'), 'erika@beispiel.de');
    await user.type(field('Nachricht'), 'Hallo');
    const send = screen.getByRole('button', { name: 'Nachricht senden' });

    await user.click(send);
    expect(await screen.findByRole('alert')).toHaveTextContent('konnte nicht gesendet werden');
    expect(field('Nachricht')).toHaveValue('Hallo');

    await user.click(send);
    expect(await within(screen.getByRole('alert')).findByText(/zu viele Nachrichten/)).toBeInTheDocument();

    await user.click(send);
    expect(await screen.findByRole('heading', { level: 2, name: 'Vielen Dank für Ihre Nachricht' })).toBeInTheDocument();
    expect(contactCalls).toHaveLength(3);
  });
});

describe('validateContact', () => {
  const ok = { name: 'Erika', company: '', email: 'erika@beispiel.de', message: 'Hallo' };
  it('akzeptiert vollständige Angaben ohne Unternehmen', () => {
    expect(validateContact(ok)).toEqual({});
  });
  it('erkennt leere und nur aus Leerzeichen bestehende Pflichtfelder', () => {
    expect(validateContact({ name: ' ', company: '', email: '', message: '\n' })).toEqual({
      name: 'nameEmpty',
      email: 'emailEmpty',
      message: 'messageEmpty',
    });
  });
  it.each(['max.mustermann@', 'erika', 'erika@localhost', 'er ika@beispiel.de', 'a@b.de.'])('lehnt %s ab', (email) => {
    expect(validateContact({ ...ok, email })).toEqual({ email: 'emailInvalid' });
  });
});
