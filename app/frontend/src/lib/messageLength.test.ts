import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import { en } from '../i18n/en';
import { MESSAGE_MAX, pasteTruncated, remainingChars, showCounter } from './messageLength';

// Anforderung #77: verbleibende Zeichen bei langen Kontaktnachrichten. Sollwerte aus dem Ticket:
// Grenze 5.000 (maxLength des Feldes, api/openapi.yaml), Zähler in den letzten 500 Zeichen.
// Die Kapazität zählt wie das maxLength des Browsers in UTF-16-Codeeinheiten: Zeilenumbruch 1, 😀 2.
const a = (n: number) => 'a'.repeat(n);

describe('Restlänge und Zähler', () => {
  it('REQ-77-AC1: Grenze ist 5.000', () => {
    expect(MESSAGE_MAX).toBe(5000);
  });

  it('REQ-77-AC1: Zähler ab 4.500 Zeichen, darunter und leer ausgeblendet', () => {
    expect(showCounter(''), 'leer').toBe(false);
    expect(showCounter(a(4499)), '4.499').toBe(false);
    expect(showCounter(a(4500)), '4.500').toBe(true);
    expect(remainingChars(a(4500)), 'Rest bei 4.500').toBe(500);
    expect(showCounter(a(5000)), '5.000').toBe(true);
  });

  it('REQ-77-AC2: 4.999 → 1, 5.000 → 0', () => {
    expect(remainingChars(a(4999))).toBe(1);
    expect(remainingChars(a(5000))).toBe(0);
  });

  it('REQ-77-AC2: Zeilenumbrüche zählen je 1, Emoji wie im Feld je 2', () => {
    expect(remainingChars(`${a(4490)}${'\n'.repeat(10)}`), 'Zeilenumbrüche').toBe(500);
    expect(showCounter(`${a(4489)}${'\n'.repeat(10)}`), '4.499 mit Umbrüchen').toBe(false);
    expect(remainingChars(`${a(4996)}😀`), 'Emoji').toBe(2);
  });
});

describe('Einfügen', () => {
  it('REQ-77-AC3: 100 Zeichen zu 4.900 passen vollständig', () => {
    expect(pasteTruncated(a(4900), 4900, 4900, a(100))).toBe(false);
  });

  it('REQ-77-AC3: beim Ersetzen einer Auswahl zählt der freigewordene Platz mit', () => {
    expect(pasteTruncated(a(4900), 100, 110, a(110)), '10 ausgewählt, 110 eingefügt').toBe(false);
    expect(pasteTruncated(a(4900), 100, 110, a(111)), '10 ausgewählt, 111 eingefügt').toBe(true);
  });

  it('REQ-77-AC4: 101 Zeichen zu 4.900 werden gekürzt', () => {
    expect(pasteTruncated(a(4900), 4900, 4900, a(101))).toBe(true);
  });

  it('REQ-77-AC4: mehr als 5.000 Zeichen in ein leeres Feld werden gekürzt, genau 5.000 nicht', () => {
    expect(pasteTruncated('', 0, 0, a(5001))).toBe(true);
    expect(pasteTruncated('', 0, 0, a(5000))).toBe(false);
  });

  it('REQ-77-AC2/AC3: Windows-Zeilenumbrüche aus der Zwischenablage zählen wie im Feld je 1', () => {
    expect(pasteTruncated(a(4990), 4990, 4990, 'a\r\n'.repeat(5)), '5 × CRLF → 10 Zeichen').toBe(false);
    expect(pasteTruncated(a(4990), 4990, 4990, `${'a\r\n'.repeat(5)}x`)).toBe(true);
  });
});

describe('Texte', () => {
  it('REQ-77-AC5: deutsche Texte mit Singular und Hinweis', () => {
    expect(de.contact.remaining_one.replace('{{count}}', '1')).toBe('1 Zeichen verbleibt');
    expect(de.contact.remaining_other.replace('{{count}}', '500')).toBe('500 Zeichen verbleiben');
    expect(de.contact.truncated).toBe('Der eingefügte Text wurde gekürzt, weil eine Nachricht höchstens 5.000 Zeichen lang sein darf.');
  });

  it('REQ-77-AC5: englische Texte mit Singular und Hinweis', () => {
    expect(en.contact.remaining_one.replace('{{count}}', '1')).toBe('1 character remaining');
    expect(en.contact.remaining_other.replace('{{count}}', '500')).toBe('500 characters remaining');
    expect(en.contact.truncated).toBe('The pasted text was shortened because a message can be at most 5,000 characters long.');
  });
});
