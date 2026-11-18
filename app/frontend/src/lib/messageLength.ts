// Anforderung #77: verbleibende Zeichen im Nachrichtenfeld des Kontaktformulars.
// Die Grenze entspricht maxLength des Feldes und api/openapi.yaml (ContactMessage.message, maxLength 5000).
// Gezählt wird wie bei maxLength im Browser in UTF-16-Codeeinheiten: ein Zeilenumbruch zählt 1, ein Emoji
// außerhalb der Basisebene 2. So entspricht die Anzeige genau dem, was das Feld noch annimmt. Das Backend zählt
// Unicode-Zeichen und ist damit nie strenger als das Feld.

export const MESSAGE_MAX = 5000;
/** Der Zähler erscheint in den letzten 500 verfügbaren Zeichen. */
export const COUNTER_FROM = 500;

/** Wie viele Zeichen das Feld bei diesem Inhalt noch annimmt. */
export function remainingChars(value: string, max = MESSAGE_MAX): number {
  return Math.max(0, max - value.length);
}

/** Zähler anzeigen, sobald höchstens COUNTER_FROM Zeichen verbleiben. */
export function showCounter(value: string, max = MESSAGE_MAX): boolean {
  return value.length > 0 && remainingChars(value, max) <= COUNTER_FROM;
}

/**
 * Ob eingefügter Text wegen der Grenze nicht vollständig ins Feld passt. Die Auswahl (start bis end) wird
 * ersetzt und gibt ihren Platz frei. Zeilenumbrüche der Zwischenablage (CRLF, CR) fügt das Feld als einen
 * Umbruch ein und zählt sie daher auch hier einfach.
 */
export function pasteTruncated(value: string, start: number, end: number, pasted: string, max = MESSAGE_MAX): boolean {
  const inserted = pasted.replace(/\r\n?/g, '\n').length;
  return value.length - Math.abs(end - start) + inserted > max;
}
