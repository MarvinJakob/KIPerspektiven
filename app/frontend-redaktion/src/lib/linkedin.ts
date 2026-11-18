import type { components } from '../api/schema';

// Ticket #85: LinkedIn-Einstellungen und LinkedIn-Status am Beitrag. Das Backend prüft dieselben Regeln
// (Einschalten nur mit gültiger Verbindung, Wiederholung nur bei eindeutiger Ablehnung).

export type LinkedInSettings = components['schemas']['LinkedInSettings'];
export type LinkedInShare = components['schemas']['LinkedInShare'];

/** Grund, warum sich das automatische Teilen nicht einschalten lässt, sonst `null` (REQ-85-AC2). */
export function enableBlocker(s: LinkedInSettings): string | null {
  if (!s.appConfigured) return 'Die LinkedIn-App ist auf dem Server nicht eingerichtet (LINKEDIN_CLIENT_ID und LINKEDIN_CLIENT_SECRET fehlen).';
  if (!s.connected) return 'Es ist noch kein LinkedIn-Profil verbunden. Bitte zuerst „Mit LinkedIn verbinden“.';
  if (s.expired) return 'Die LinkedIn-Autorisierung ist abgelaufen. Bitte neu verbinden.';
  return null;
}

/** Bezeichnung des LinkedIn-Status (REQ-85-AC8, AC12, AC13). */
export function shareLabel(s: LinkedInShare): string {
  switch (s.state) {
    case 'pending':
    case 'sending':
      return 'Wird gesendet';
    case 'succeeded':
      return 'Geteilt';
    case 'failed':
      return 'Fehlgeschlagen';
    case 'unknown':
      return 'Ausgang unklar';
  }
}

/** Nur ein eindeutig abgelehnter Versand lässt sich wiederholen; bei unklarem Ausgang droht ein doppelter Post. */
export const canRetry = (s: LinkedInShare) => s.state === 'failed';

/** Solange der Versand läuft, lädt der Editor den Beitrag häufiger neu. */
export const sharing = (s?: LinkedInShare | null) => s?.state === 'pending' || s?.state === 'sending';

/** Rückmeldung nach dem OAuth-Rückruf (Parameter `verbindung`). */
export function connectResult(v: string | null): { ok: boolean; text: string } | null {
  switch (v) {
    case 'ok':
      return { ok: true, text: 'LinkedIn-Profil verbunden.' };
    case 'abgebrochen':
      return { ok: false, text: 'Die Autorisierung bei LinkedIn wurde abgebrochen. Das Profil ist nicht verbunden.' };
    case 'ungueltig':
      return { ok: false, text: 'Die Rückmeldung von LinkedIn war ungültig oder abgelaufen. Das Profil ist nicht verbunden. Bitte erneut verbinden.' };
    case 'fehler':
      return { ok: false, text: 'LinkedIn hat die Verbindung nicht bestätigt. Das Profil ist nicht verbunden. Bitte später erneut versuchen.' };
  }
  return null;
}
