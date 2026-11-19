/**
 * Anmeldung der Redaktion im Dialog der öffentlichen Webseite (Ticket #109).
 *
 * Nach erfolgreicher Anmeldung öffnet die Webseite die Anmeldeseite der Redaktion. Das Backend leitet
 * angemeldete Konten von dort zur Startseite ihrer Rolle weiter (`web.HomeFor`). So steht die Rollentabelle
 * aus Ticket #64 nicht ein weiteres Mal in diesem Frontend.
 */
export const EDITORIAL_ENTRY = '/redaktion/anmelden';

/** Wechselt in das eigenständige Redaktionsfrontend. Als Objekt, damit Tests es ersetzen können. */
export const editorial = {
  open() {
    window.location.assign(EDITORIAL_ENTRY);
  },
};

/** Übersetzungsschlüssel der Meldung zu einer abgelehnten Anmeldung. Status 0 steht für „keine Antwort“. */
export function loginErrorKey(status: number): string {
  switch (status) {
    case 400:
      return 'login.errors.missing';
    case 401:
      return 'login.errors.invalid';
    case 429:
      return 'login.errors.locked';
    case 503: // Passwortprüfung ausgelastet (Ticket #138); zählt nicht als Fehlversuch
      return 'login.errors.busy';
    default:
      return 'login.errors.unavailable';
  }
}
