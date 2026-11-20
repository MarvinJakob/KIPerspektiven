import { describe, expect, it } from 'vitest';
import privacyDe from './datenschutz.de.md?raw';
import privacyEn from './datenschutz.en.md?raw';

// Anforderung #128: Die Tests prüfen nur, ob die Datenschutzerklärung jede rechtlich notwendige Angabe nennt
// (REQ-128-AC2, Pflichtangaben P1 bis P14 im Ticket). Aufbau, Reihenfolge, Länge und Wortlaut sind frei (REQ-128-AC4).
// Löst die Sollwerte aus #74, #118 und #125 zu Aufbau, Wortzahl und Freigabe-Hash ab (Umfangsänderung im Ticket #128).
// Sollwerte stammen aus Art. 13 und 21 DSGVO, § 25 TDDDG, der Impressum-Abnahme (#103), service/retention.go (#90),
// deploy/Caddyfile, ADR 0010 und ADR 0011, nicht aus den Texten selbst.
// Fidelity-Tests über die ausgelieferte Seite: app/e2e/tests/74-datenschutz.spec.ts.

const TEXT = { de: privacyDe, en: privacyEn } as const;
type Lang = keyof typeof TEXT;
const LANGS: Lang[] = ['de', 'en'];

const LIT_A = { de: 'Art. 6 Abs. 1 lit. a DSGVO', en: 'Art. 6(1)(a) GDPR' } as const;
const LIT_B = { de: 'Art. 6 Abs. 1 lit. b DSGVO', en: 'Art. 6(1)(b) GDPR' } as const;
const LIT_F = { de: 'Art. 6 Abs. 1 lit. f DSGVO', en: 'Art. 6(1)(f) GDPR' } as const;
const CONSENT = { de: '§ 25 Abs. 1 TDDDG', en: '§ 25(1) TDDDG' } as const;

interface Processing {
  heading: string;
  /** P3: Zweck der Verarbeitung. */
  purpose: RegExp;
  /** P3: Rechtsgrundlagen der Verarbeitung. */
  basis: string[];
  /** P7: Frist oder Kriterium laut Betrieb. */
  retention: RegExp[];
  /** P11: Besucher stellen die Daten selbst bereit. */
  provided: boolean;
}

const SOLL: Record<Lang, {
  controllerHeading: string;
  country: string;
  processing: Processing[];
  interest: RegExp;
  /** P11: Angabe, ob die Bereitstellung nötig ist, und Folge der Nichtbereitstellung. */
  necessity: [RegExp, RegExp];
  processor: RegExp;
  rights: Record<string, RegExp>;
  withdrawal: string;
  complaint: string;
  objectionHeading: string;
  objection: string;
  storage: string;
}> = {
  de: {
    controllerHeading: 'Verantwortliche Stelle',
    country: 'Deutschland',
    processing: [
      // Caddyfile und betrieb.md: kein Eintrag älter als sieben Tage; contact.go/consultations.go: Fenster eine Stunde
      { heading: 'Aufruf der Website', purpose: /auszuliefern|ausliefern/, basis: [LIT_F.de], retention: [/sieben Tage/, /eine Stunde/], provided: true },
      // ADR 0010: Laufzeit des Statistikbestands, Erforderlichkeit jährlich prüfen
      { heading: 'Reichweitenstatistik', purpose: /Reichweite/, basis: [LIT_F.de], retention: [/jährlich/], provided: false },
      // retention.go: RetentionMonths = 6 ab Eingang (#90)
      { heading: 'Kontaktformular', purpose: /antworten/, basis: [LIT_F.de, LIT_B.de], retention: [/sechs Monate/], provided: true },
      // retention.go: sechs Monate ab letzter Anfrage; ADR 0011
      { heading: 'Anfrage für ein Beratungsgespräch', purpose: /Termin/, basis: [LIT_B.de], retention: [/sechs Monate/], provided: true },
      // ADR 0010: Opt-in, Löschen beim Entfernen des Hakens
      { heading: 'Ergebnisse der Selbsteinschätzung', purpose: /Bedarf/, basis: [LIT_A.de, CONSENT.de], retention: [/sofort/, /solange/i], provided: true },
    ],
    interest: /berechtigte[sn]? Interesse/i,
    necessity: [/freiwillig|erforderlich|nötig|notwendig/i, /ohne|sonst/i],
    processor: /Auftragsverarbeiter/,
    rights: { Auskunft: /Art\. 15\b/, Berichtigung: /Art\. 16\b/, Löschung: /Art\. 17\b/, Einschränkung: /Art\. 18\b/, Datenübertragbarkeit: /Art\. 20\b/ },
    withdrawal: 'Art. 7 Abs. 3 DSGVO',
    complaint: 'Art. 77 DSGVO',
    objectionHeading: 'Widerspruchsrecht',
    objection: 'Art. 21 DSGVO',
    storage: '§ 25 Abs. 2 TDDDG',
  },
  en: {
    controllerHeading: 'Controller',
    country: 'Germany',
    processing: [
      { heading: 'Visiting the website', purpose: /deliver/, basis: [LIT_F.en], retention: [/seven days/, /one hour/], provided: true },
      { heading: 'Reach statistics', purpose: /reach/, basis: [LIT_F.en], retention: [/annual|yearly|every year/], provided: false },
      { heading: 'Contact form', purpose: /reply/, basis: [LIT_F.en, LIT_B.en], retention: [/six months/], provided: true },
      { heading: 'Consultation requests', purpose: /appointment/, basis: [LIT_B.en], retention: [/six months/], provided: true },
      { heading: 'Self-assessment results', purpose: /need/, basis: [LIT_A.en, CONSENT.en], retention: [/immediately/, /as long as/i], provided: true },
    ],
    interest: /legitimate interest/i,
    necessity: [/voluntary|optional|required|necessary/i, /without|otherwise/i],
    processor: /processor/,
    rights: { access: /Art\. 15\b/, rectification: /Art\. 16\b/, erasure: /Art\. 17\b/, restriction: /Art\. 18\b/, portability: /Art\. 20\b/ },
    withdrawal: 'Art. 7(3) GDPR',
    complaint: 'Art. 77 GDPR',
    objectionHeading: 'Right to object',
    objection: 'Art. 21 GDPR',
    storage: '§ 25(2) TDDDG',
  },
};

/** Text eines Abschnitts (## Überschrift) bis zum nächsten Abschnitt. */
function section(md: string, heading: string): string {
  const parts = md.replace(/\r\n/g, '\n').split(/^## /m);
  const hit = parts.find((p) => p.startsWith(`${heading}\n`));
  expect(hit, `Abschnitt „${heading}“ fehlt`).toBeDefined();
  return hit!.slice(heading.length + 1);
}

describe.each(LANGS)('Datenschutzerklärung (%s): Pflichtangaben', (lang) => {
  const md = TEXT[lang];
  const soll = SOLL[lang];

  it('REQ-128-AC2 (P1): Name, Anschrift, Telefon und E-Mail des Verantwortlichen', () => {
    // Bestätigte Betreiberangaben aus der Impressum-Abnahme (#103)
    const text = section(md, soll.controllerHeading);
    for (const part of ['Marvin Jakob', 'Danzigerstr. 2', '65527 Niedernhausen', soll.country, 'tel:+491751964719', 'mailto:mail@marvinjakob.de']) {
      expect(text, `Angabe ${part}`).toContain(part);
    }
  });

  it.each(soll.processing)('REQ-128-AC2 (P3, P4): „$heading“ nennt Zweck, Rechtsgrundlage und berechtigtes Interesse', (p) => {
    const text = section(md, p.heading);
    expect(text, 'P3: Zweck').toMatch(p.purpose);
    for (const basis of p.basis) expect(text, `P3: Rechtsgrundlage ${basis}`).toContain(basis);
    if (p.basis.includes(LIT_F[lang])) expect(text, 'P4: berechtigtes Interesse benannt').toMatch(soll.interest);
  });

  it.each(soll.processing)('REQ-128-AC2 (P7): „$heading“ nennt Speicherdauer oder Kriterium', (p) => {
    const text = section(md, p.heading);
    for (const r of p.retention) expect(text, `P7: Dauer ${r}`).toMatch(r);
  });

  it.each(soll.processing.filter((p) => p.provided))('REQ-128-AC2 (P11): „$heading“ sagt, ob die Angaben nötig sind und was ohne sie geschieht', (p) => {
    const text = section(md, p.heading);
    expect(text, 'P11: Erforderlichkeit').toMatch(soll.necessity[0]);
    expect(text, 'P11: Folge der Nichtbereitstellung').toMatch(soll.necessity[1]);
  });

  it('REQ-128-AC2 (P5): Empfänger ist Hetzner als Auftragsverarbeiter', () => {
    expect(md).toContain('Hetzner Online GmbH');
    expect(md).toMatch(soll.processor);
  });

  it('REQ-128-AC2 (P8): Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung und Datenübertragbarkeit', () => {
    for (const [right, article] of Object.entries(soll.rights)) expect(md, `P8: ${right}`).toMatch(article);
  });

  it('REQ-128-AC2 (P9): Widerruf der Einwilligung', () => {
    expect(md).toContain(soll.withdrawal);
  });

  it('REQ-128-AC2 (P10): Beschwerderecht bei einer Aufsichtsbehörde', () => {
    expect(md).toContain(soll.complaint);
  });

  it('REQ-128-AC2 (P13): Widerspruchsrecht steht getrennt in einem eigenen Abschnitt', () => {
    const text = section(md, soll.objectionHeading);
    expect(text).toContain(soll.objection);
    expect(text, 'Bezug auf Verarbeitungen aus berechtigtem Interesse').toContain(LIT_F[lang]);
  });

  it('REQ-128-AC2 (P14): Speichern im Endgerät nach § 25 Abs. 2 TDDDG', () => {
    expect(md).toContain(soll.storage);
  });
});
