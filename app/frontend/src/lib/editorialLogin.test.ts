import { describe, expect, it } from 'vitest';
import { i18n } from '../i18n';
import { EDITORIAL_ENTRY, loginErrorKey } from './editorialLogin';

// Unit-Tests zu REQ-109-AC2 und REQ-109-AC3 (Ticket #109). Sollwerte aus der Spezifikation im Ticket
// (Tabelle „Texte“ und Abschnitt „Ablehnung“), nicht aus dem Anwendungscode.

const TEXT = {
  de: {
    'nav.account': 'Anmeldung für die Redaktion',
    'login.title': 'Anmelden',
    'login.intro': 'Der Zugang ist Mitgliedern der Redaktion vorbehalten. Konten richtet die Administration ein.',
    'login.email': 'E-Mail-Adresse',
    'login.password': 'Passwort',
    'login.close': 'Schließen',
    'login.submit': 'Anmelden',
    'login.pending': 'Wird angemeldet …',
    'login.errors.missing': 'Bitte E-Mail-Adresse und Passwort eingeben.',
    'login.errors.invalid':
      'E-Mail-Adresse oder Passwort ist falsch, oder das Konto ist deaktiviert. Bitte Eingaben prüfen oder an die Administration wenden.',
    'login.errors.locked': 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.',
    'login.errors.busy': 'Die Anmeldung ist gerade ausgelastet. Bitte in einigen Sekunden erneut versuchen.',
    'login.errors.unavailable': 'Die Anmeldung ist gerade nicht möglich. Bitte später erneut versuchen.',
  },
  en: {
    'nav.account': 'Sign in for editors',
    'login.title': 'Sign in',
    'login.intro': 'Access is reserved for members of the editorial team. Accounts are set up by the administrators.',
    'login.email': 'Email address',
    'login.password': 'Password',
    'login.close': 'Close',
    'login.submit': 'Sign in',
    'login.pending': 'Signing in …',
    'login.errors.missing': 'Please enter your email address and password.',
    'login.errors.invalid':
      'The email address or password is incorrect, or the account is deactivated. Please check your entries or contact the administrators.',
    'login.errors.locked': 'Too many failed attempts. Please try again in 15 minutes.',
    'login.errors.busy': 'Sign-in is busy at the moment. Please try again in a few seconds.',
    'login.errors.unavailable': 'Sign-in is not possible at the moment. Please try again later.',
  },
} as const;

describe('REQ-109-AC3: Meldung je Ablehnungsgrund', () => {
  it.each([
    [400, 'login.errors.missing'], // Backend: E-Mail-Adresse oder Passwort fehlt
    [401, 'login.errors.invalid'], // falsches Passwort, unbekanntes oder deaktiviertes Konto
    [429, 'login.errors.locked'], // zu viele Fehlversuche der IP-Adresse
    [503, 'login.errors.busy'], // Passwortprüfung ausgelastet (#138)
    [403, 'login.errors.unavailable'],
    [500, 'login.errors.unavailable'],
    [502, 'login.errors.unavailable'],
    [0, 'login.errors.unavailable'], // keine Antwort (Netzwerkfehler)
  ])('Status %i ergibt %s', (status, key) => {
    expect(loginErrorKey(status)).toBe(key);
  });
});

describe.each(['de', 'en'] as const)('REQ-109-AC2: Texte des Anmeldedialogs (%s)', (lang) => {
  it.each(Object.entries(TEXT[lang]))('%s', (key, text) => {
    expect(i18n.getFixedT(lang)(key)).toBe(text);
  });
});

it('REQ-109-AC3 REQ-109-AC4: die Redaktion öffnet sich über die Anmeldeseite, die das Backend zur Rollen-Startseite weiterleitet', () => {
  expect(EDITORIAL_ENTRY).toBe('/redaktion/anmelden');
});
