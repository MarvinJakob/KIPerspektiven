import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContactMessage } from './api/contactMessages';
import { ADMIN, EDITOR, fakeBackend, json, renderAt, type Handler } from './test/fakeApi';

// Anforderung #4: Nachrichten der Kontaktseite kommen im Nachrichtenbereich der Redaktion an.

afterEach(() => vi.unstubAllGlobals());

const MESSAGES: ContactMessage[] = [
  {
    id: 2,
    name: 'Jane Doe',
    company: '',
    email: 'jane@example.org',
    message: 'Hello,\nplease call me back.',
    lang: 'en',
    // 15.11.2026, 09:30 UTC = 10:30 Uhr deutscher Zeit
    receivedAt: '2026-11-15T09:30:00Z',
  },
  {
    id: 1,
    name: 'Erika Muster',
    company: 'Beispiel GmbH',
    email: 'erika@beispiel.de',
    message: '<b>Kein HTML</b>',
    lang: 'de',
    receivedAt: '2026-11-14T21:05:00Z',
  },
];

function contactBackend(items: ContactMessage[] = MESSAGES, status = 200): Handler {
  return (r) =>
    r.path === '/api/admin/contact-messages' && r.method === 'GET'
      ? status === 200
        ? json(200, { items })
        : json(status, { message: 'Interner Fehler.' })
      : undefined;
}

describe('Anforderung #4: Nachrichtenbereich der Redaktion', () => {
  it('ist für Redaktion und Admin in der Navigation erreichbar', async () => {
    for (const me of [EDITOR, ADMIN]) {
      fakeBackend(me, contactBackend());
      const { unmount } = renderAt('/');
      const nav = await screen.findByRole('navigation', { name: 'Redaktion' });
      expect(within(nav).getByRole('link', { name: 'Nachrichten' })).toHaveAttribute('href', '/redaktion/nachrichten');
      unmount();
      vi.unstubAllGlobals();
    }
  });

  it('zeigt alle Angaben jeder Nachricht, neueste zuerst', async () => {
    fakeBackend(EDITOR, contactBackend());
    renderAt('/nachrichten');
    expect(await screen.findByRole('heading', { level: 1, name: 'Nachrichten' })).toBeInTheDocument();
    const items = within(await screen.findByRole('list', { name: 'Nachrichten, neueste zuerst' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);

    const [newest, older] = items;
    expect(within(newest).getByRole('heading', { level: 2 })).toHaveTextContent('Jane Doe');
    expect(newest).toHaveTextContent('15.11.2026, 10:30 Uhr');
    expect(newest).toHaveTextContent('Nicht angegeben');
    expect(within(newest).getByRole('link', { name: 'jane@example.org' })).toHaveAttribute('href', 'mailto:jane@example.org');
    expect(newest).toHaveTextContent('Englisch');
    expect(within(newest).getByText(/please call me back/).textContent).toBe('Hello,\nplease call me back.');

    expect(within(older).getByRole('heading', { level: 2 })).toHaveTextContent('Erika Muster');
    expect(older).toHaveTextContent('Beispiel GmbH');
    expect(older).toHaveTextContent('erika@beispiel.de');
    // Texte von Besuchern erscheinen als Text, nicht als HTML.
    expect(within(older).getByText('<b>Kein HTML</b>')).toBeInTheDocument();
  });

  it('kodiert die E-Mail-Adresse im mailto-Link, damit keine Kopfzeilen eingeschleust werden', async () => {
    fakeBackend(EDITOR, contactBackend([{ ...MESSAGES[0], email: 'a?cc=x&b#c@example.org' }]));
    renderAt('/nachrichten');
    const link = await screen.findByRole('link', { name: 'a?cc=x&b#c@example.org' });
    expect(link).toHaveAttribute('href', 'mailto:a%3Fcc%3Dx%26b%23c@example.org');
  });

  it('zeigt einen leeren Zustand und einen Ladefehler verständlich an', async () => {
    fakeBackend(EDITOR, contactBackend([]));
    const { unmount } = renderAt('/nachrichten');
    expect(await screen.findByText('Es liegen keine Nachrichten vor.')).toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();

    fakeBackend(EDITOR, contactBackend(MESSAGES, 500));
    renderAt('/nachrichten');
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent('Die Nachrichten konnten nicht geladen werden.');
  });
});
