import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsultationRequest } from './api/consultations';
import { ADMIN, EDITOR, fakeBackend, json, renderAt, type Handler } from './test/fakeApi';

// Ticket #136: Beratungsanfragen aus der Auswertung kommen in der Redaktion an und lassen sich nach der
// Terminabstimmung löschen.

afterEach(() => vi.unstubAllGlobals());

const REQUESTS: ConsultationRequest[] = [
  // 14.11.2026, 21:05 UTC = 22:05 Uhr deutscher Zeit
  { id: 2, email: 'kundin@beispiel.de', lang: 'de', requestedAt: '2026-11-14T21:05:00Z' },
  { id: 1, email: 'client@example.com', lang: 'en', requestedAt: '2026-11-13T08:30:00Z' },
];

/** Backend der Beratungsanfragen im Speicher; failDelete lässt Löschen mit 500 scheitern. */
function consultationBackend(initial = REQUESTS, { failDelete = false } = {}) {
  let items = [...initial];
  const handler: Handler = (r) => {
    if (r.path === '/api/admin/consultation-requests' && r.method === 'GET') return json(200, { items });
    const m = r.path.match(/^\/api\/admin\/consultation-requests\/(\d+)$/);
    if (m && r.method === 'DELETE') {
      if (failDelete) return json(500, { message: 'Interner Fehler.' });
      const id = Number(m[1]);
      if (!items.some((x) => x.id === id)) return json(404, { message: 'Anfrage nicht gefunden.' });
      items = items.filter((x) => x.id !== id);
      return json(204);
    }
    return undefined;
  };
  return handler;
}

describe('Ticket #136: Beratungsanfragen in der Redaktion', () => {
  it('ist für Redaktion und Admin in der Navigation erreichbar', async () => {
    for (const me of [EDITOR, ADMIN]) {
      fakeBackend(me, consultationBackend());
      const { unmount } = renderAt('/');
      const nav = await screen.findByRole('navigation', { name: 'Redaktion' });
      expect(within(nav).getByRole('link', { name: 'Beratungsanfragen' })).toHaveAttribute('href', '/redaktion/beratungsanfragen');
      unmount();
      vi.unstubAllGlobals();
    }
  });

  it('listet die Anfragen neueste zuerst mit Eingang, Adresse und Sprache', async () => {
    fakeBackend(EDITOR, consultationBackend());
    renderAt('/beratungsanfragen');
    expect(await screen.findByRole('heading', { level: 1, name: 'Beratungsanfragen' })).toBeInTheDocument();
    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('14.11.2026, 22:05 Uhr');
    expect(rows[0]).toHaveTextContent('Deutsch');
    expect(within(rows[0]).getByRole('link', { name: 'kundin@beispiel.de' })).toHaveAttribute('href', 'mailto:kundin@beispiel.de');
    expect(rows[1]).toHaveTextContent('client@example.com');
    expect(rows[1]).toHaveTextContent('Englisch');
    expect(screen.getByText(/nicht das Ergebnis/)).toBeInTheDocument();
  });

  it('zeigt einen leeren Zustand ohne Anfragen', async () => {
    fakeBackend(EDITOR, consultationBackend([]));
    renderAt('/beratungsanfragen');
    expect(await screen.findByText('Es liegen keine offenen Anfragen vor.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('löscht eine erledigte Anfrage erst nach Bestätigung, mit CSRF-Token', async () => {
    const user = userEvent.setup();
    const state = fakeBackend(EDITOR, consultationBackend());
    renderAt('/beratungsanfragen');
    await user.click(await screen.findByRole('button', { name: 'Anfrage von client@example.com löschen' }));
    expect(state.requests.some((r) => r.method === 'DELETE')).toBe(false);

    // Abbrechen löscht nichts und setzt den Fokus zurück auf „Löschen“.
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Anfrage von client@example.com löschen' })).toHaveFocus());
    expect(state.requests.some((r) => r.method === 'DELETE')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Anfrage von client@example.com löschen' }));
    await user.click(screen.getByRole('button', { name: 'Anfrage von client@example.com endgültig löschen' }));
    const notice = await screen.findByRole('status');
    await waitFor(() => expect(notice).toHaveTextContent('Die Anfrage von client@example.com wurde gelöscht.'));
    expect(notice).toHaveFocus();
    expect(screen.queryByText('client@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('kundin@beispiel.de')).toBeInTheDocument();
    const del = state.requests.find((r) => r.method === 'DELETE');
    expect(del).toMatchObject({ path: '/api/admin/consultation-requests/1', csrf: EDITOR.csrfToken });
  });

  it('meldet einen Fehler beim Löschen und behält die Anfrage', async () => {
    const user = userEvent.setup();
    fakeBackend(EDITOR, consultationBackend(REQUESTS, { failDelete: true }));
    renderAt('/beratungsanfragen');
    await user.click(await screen.findByRole('button', { name: 'Anfrage von kundin@beispiel.de löschen' }));
    await user.click(screen.getByRole('button', { name: 'Anfrage von kundin@beispiel.de endgültig löschen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Anfrage von kundin@beispiel.de wurde nicht gelöscht. Bitte versuchen Sie es erneut.');
    expect(screen.getByText('kundin@beispiel.de')).toBeInTheDocument();
  });

  it('führt ohne Anmeldung zur Anmeldeseite', async () => {
    fakeBackend(null, consultationBackend());
    renderAt('/beratungsanfragen');
    expect(await screen.findByRole('heading', { level: 1, name: /Anmeld/ })).toBeInTheDocument();
    expect(screen.queryByText('kundin@beispiel.de')).not.toBeInTheDocument();
  });
});
