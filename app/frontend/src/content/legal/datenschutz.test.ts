import { describe, expect, it } from 'vitest';
import privacyDe from './datenschutz.de.md?raw';
import privacyEn from './datenschutz.en.md?raw';
import imprintDe from './impressum.de.md?raw';
import imprintEn from './impressum.en.md?raw';
import release from './datenschutz.freigabe.json';

// Anforderung #118: Datenschutzerklärung prüfen und auf die notwendigen Angaben kürzen.
// Löst die Sollwerte aus #74 ab, soweit sie Aufbau und Formulierungen der langen Fassung festschrieben
// (dokumentierte Umfangsänderung im Ticket #118). Fachliche Zusagen aus #74 und #90 bleiben geprüft.
// Spezifikation und Abgleich: Ticket #118 und app/docs/datenschutz-abnahme.md.
// Fidelity-Tests über die ausgelieferte Seite: app/e2e/tests/74-datenschutz.spec.ts.
//
// Sollwerte stammen aus den Quellen des Tickets, nicht aus den Texten selbst:
// Pflichtangaben P1 bis P15 (Art. 12, 13, 21 DSGVO, § 25 TDDDG), Impressum-Abnahme (#103), ADR 0010 und 0011,
// service/retention.go (#90), deploy/Caddyfile und betrieb.md (Protokolle), lib/consent.ts, lib/lang.ts,
// lib/theme.ts und auth (Browserspeicher), bisherige Wortzahlen auf main @ 3994c27 (wc -w: DE 1581, EN 1752).

const TEXT = { de: privacyDe, en: privacyEn } as const;
type Lang = keyof typeof TEXT;
const LANGS: Lang[] = ['de', 'en'];

/** Bestätigte Betreiberangaben aus der Impressum-Abnahme (#103). */
const CONTROLLER = {
  name: 'Marvin Jakob',
  street: 'Danzigerstr. 2',
  city: '65527 Niedernhausen',
  country: { de: 'Deutschland', en: 'Germany' },
  phone: '[+49 175 1964719](tel:+491751964719)',
  mail: '[mail@marvinjakob.de](mailto:mail@marvinjakob.de)',
} as const;

/** Bisherige Wortzahl je Sprache (Ticket #118, AC4). Neue Fassung: höchstens die Hälfte. */
const WORDS_BEFORE = { de: 1581, en: 1752 } as const;

const LIT_F = { de: 'Art. 6 Abs. 1 lit. f DSGVO', en: 'Art. 6(1)(f) GDPR' } as const;
const LIT_B = { de: 'Art. 6 Abs. 1 lit. b DSGVO', en: 'Art. 6(1)(b) GDPR' } as const;
const CONSENT = { de: '§ 25 Abs. 1 TDDDG', en: '§ 25(1) TDDDG' } as const;
const INTEREST = { de: 'berechtigtes Interesse', en: 'legitimate interest' } as const;

interface Processing {
  heading: string;
  /** P3: Rechtsgrundlagen, die im Abschnitt stehen müssen. */
  basis: string[];
  /** P7: Frist oder Kriterium laut Betrieb. */
  retention: string[];
  /** P11: Abschnitt sagt, ob die Angabe nötig ist und was ohne sie geschieht. */
  required: boolean;
}

const SOLL: Record<Lang, {
  sections: string[];
  labels: [string, string, string, string];
  requiredLabel: string;
  processing: Processing[];
  controllerHeading: string;
  storageHeading: string;
  storageBasis: string;
  recipientsHeading: string;
  processor: string;
  rightsHeading: string;
  withdrawal: string;
  objectionHeading: string;
  objection: string;
  contactFields: string[];
  resultFields: string[];
  updated: RegExp;
}> = {
  de: {
    sections: [
      'Verantwortliche Stelle',
      'Aufruf der Website',
      'Reichweitenstatistik',
      'Kontaktformular',
      'Anfrage für ein Beratungsgespräch',
      'Ergebnisse der Selbsteinschätzung',
      'Cookies und Browserspeicher',
      'Empfänger',
      'Deine Rechte',
      'Widerspruchsrecht',
    ],
    labels: ['Daten', 'Zweck', 'Rechtsgrundlage', 'Speicherdauer'],
    requiredLabel: 'Ohne diese Daten',
    processing: [
      // Caddyfile und betrieb.md: kein Eintrag älter als sieben Tage; contact.go/consultations.go: Fenster eine Stunde
      { heading: 'Aufruf der Website', basis: [LIT_F.de], retention: ['höchstens sieben Tage', 'höchstens eine Stunde'], required: true },
      // ADR 0010 und betrieb.md: Laufzeit des Statistikbestands, Erforderlichkeit jährlich prüfen
      { heading: 'Reichweitenstatistik', basis: [LIT_F.de], retention: ['jährlich'], required: false },
      // retention.go: RetentionMonths = 6 ab Eingang (#90)
      { heading: 'Kontaktformular', basis: [LIT_F.de, LIT_B.de], retention: ['spätestens sechs Monate nach Eingang'], required: true },
      // retention.go: sechs Monate ab letzter Anfrage; ADR 0011: Löschen nach Terminabstimmung
      { heading: 'Anfrage für ein Beratungsgespräch', basis: [LIT_B.de], retention: ['Termin abgestimmt ist', 'spätestens aber sechs Monate nach deiner letzten Anfrage'], required: true },
      // ADR 0010: Opt-in, Löschen beim Entfernen des Hakens
      { heading: 'Ergebnisse der Selbsteinschätzung', basis: [CONSENT.de], retention: ['löschen dein Ergebnis sofort'], required: true },
    ],
    controllerHeading: 'Verantwortliche Stelle',
    storageHeading: 'Cookies und Browserspeicher',
    storageBasis: '§ 25 Abs. 2 TDDDG',
    recipientsHeading: 'Empfänger',
    processor: 'Auftragsverarbeiter',
    rightsHeading: 'Deine Rechte',
    withdrawal: 'Art. 7 Abs. 3 DSGVO',
    objectionHeading: 'Widerspruchsrecht',
    objection: 'Art. 21 DSGVO',
    contactFields: ['Name', 'Unternehmen (freiwillig)', 'E-Mail-Adresse', 'Nachricht', 'Sprache der Seite', 'Zeitpunkt'],
    resultFields: ['Reifegrad je Dimension', 'Sprache der Seite', 'Zeitpunkt', 'Hashwert'],
    updated: /^Stand: \d{1,2}\. (Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember) \d{4}$/m,
  },
  en: {
    sections: [
      'Controller',
      'Visiting the website',
      'Reach statistics',
      'Contact form',
      'Consultation requests',
      'Self-assessment results',
      'Cookies and browser storage',
      'Recipients',
      'Your rights',
      'Right to object',
    ],
    labels: ['Data', 'Purpose', 'Legal basis', 'Retention'],
    requiredLabel: 'Without this data',
    processing: [
      { heading: 'Visiting the website', basis: [LIT_F.en], retention: ['at most seven days', 'at most one hour'], required: true },
      { heading: 'Reach statistics', basis: [LIT_F.en], retention: ['annually'], required: false },
      { heading: 'Contact form', basis: [LIT_F.en, LIT_B.en], retention: ['no later than six months after receipt'], required: true },
      { heading: 'Consultation requests', basis: [LIT_B.en], retention: ['appointment has been arranged', 'no later than six months after your most recent request'], required: true },
      { heading: 'Self-assessment results', basis: [CONSENT.en], retention: ['we delete your result immediately'], required: true },
    ],
    controllerHeading: 'Controller',
    storageHeading: 'Cookies and browser storage',
    storageBasis: '§ 25(2) TDDDG',
    recipientsHeading: 'Recipients',
    processor: 'processor',
    rightsHeading: 'Your rights',
    withdrawal: 'Art. 7(3) GDPR',
    objectionHeading: 'Right to object',
    objection: 'Art. 21 GDPR',
    contactFields: ['Name', 'company (optional)', 'email address', 'message', 'language of the page', 'time'],
    resultFields: ['level you chose for each dimension', 'language of the page', 'time', 'hash'],
    updated: /^Last updated: \d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/m,
  },
};

/** Die vier Einträge im Browserspeicher mit ihrer Dauer (lib/lang.ts, lib/theme.ts, lib/consent.ts: 180 Tage, service.SessionTTL: 12 Stunden). */
const STORAGE = [
  { key: 'ki-perspektiven.lang', duration: null },
  { key: 'ki-perspektiven.theme', duration: null },
  { key: 'ki-perspektiven.consent', duration: '180' },
  { key: 'ki_session', duration: '12' },
] as const;

const lf = (md: string) => md.replace(/\r\n/g, '\n');

/** Text eines Abschnitts (## Überschrift) bis zum nächsten Abschnitt. */
function section(md: string, heading: string): string {
  const parts = lf(md).split(/^## /m);
  const hit = parts.find((p) => p.startsWith(`${heading}\n`));
  expect(hit, `Abschnitt „${heading}“ fehlt`).toBeDefined();
  return hit!.slice(heading.length + 1);
}

const headings = (md: string) => [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
const count = (text: string, needle: string) => text.split(needle).length - 1;
/** Fett gesetzte Listenbeschriftungen eines Abschnitts in ihrer Reihenfolge („- **Daten:** …“). */
const labels = (text: string) => [...text.matchAll(/^- \*\*([^*]+):\*\*/gm)].map((m) => m[1]);
/** Wörter wie `wc -w`: durch Leerraum getrennte Zeichenfolgen der Markdown-Datei. */
const words = (md: string) => md.split(/\s+/).filter(Boolean).length;
/** Sätze ohne Markdown-Auszeichnung, für die Suche nach Wiederholungen. */
const sentences = (md: string) =>
  lf(md)
    .replace(/[*`>|]/g, ' ')
    .replace(/\b(Art|Abs|lit|Danzigerstr|Industriestr)\./g, '$1')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter((s) => s.split(' ').length >= 6);
/** Prüfbare Fakten, die in beiden Sprachen identisch sein müssen: Zahlen, Schlüssel in Backticks, Verweise. */
const facts = (md: string) => ({
  numbers: [...md.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0].replace(',', '.')).sort(),
  codes: [...md.matchAll(/`([^`]+)`/g)].map((m) => m[1]).sort(),
  links: [...md.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1].replace(/\/(de|en)\//, '/:lang/')).sort(),
});
/** Aufbau eines Abschnitts unabhängig von der Sprache. */
const shape = (text: string) => ({
  listItems: (text.match(/^- /gm) ?? []).length,
  tableRows: (text.match(/^\|/gm) ?? []).length,
  quotes: (text.match(/^> /gm) ?? []).length,
  ...facts(text),
});

async function sha256(text: string) {
  const bytes = new TextEncoder().encode(lf(text));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe.each(LANGS)('Datenschutzerklärung (%s)', (lang) => {
  const md = TEXT[lang];
  const soll = SOLL[lang];

  it('REQ-118-AC1 (P1), REQ-74-AC1: verantwortliche Stelle mit bestätigtem Namen, Postanschrift, Telefon und E-Mail', () => {
    const text = section(md, soll.controllerHeading);
    const block = [CONTROLLER.name, CONTROLLER.street, CONTROLLER.city, CONTROLLER.country[lang]].join('\\\n');
    expect(text).toContain(block);
    expect(text).toContain(CONTROLLER.phone);
    expect(text).toContain(CONTROLLER.mail);
  });

  it('REQ-74-AC1: Angaben stimmen mit dem freigegebenen Impressum derselben Sprache überein', () => {
    const imprint = { de: imprintDe, en: imprintEn }[lang];
    for (const v of [CONTROLLER.name, CONTROLLER.street, CONTROLLER.city, CONTROLLER.phone, CONTROLLER.mail]) {
      expect(imprint, `Impressum enthält ${v}`).toContain(v);
    }
  });

  it('REQ-74-AC5: keine Platzhalter, internen Prüfhinweise oder offenen Klammerplatzhalter', () => {
    for (const bad of [/Platzhalter/i, /Placeholder/i, /\[Name/, /TODO/, /rechtlich geprüft werden/, /legal review/i, /Design\.md/]) {
      expect(md, `unerwartet: ${bad}`).not.toMatch(bad);
    }
  });

  it.each(soll.processing)('REQ-118-AC1 (P3, P4, P7, P11): „$heading“ nennt Rechtsgrundlage, Interesse, Dauer und Erforderlichkeit', (p) => {
    const text = section(md, p.heading);
    for (const basis of p.basis) expect(text, `Rechtsgrundlage ${basis}`).toContain(basis);
    if (p.basis.includes(LIT_F[lang])) expect(text.toLowerCase(), 'P4: berechtigtes Interesse benannt').toContain(INTEREST[lang].toLowerCase());
    for (const r of p.retention) expect(text, `Dauer „${r}“`).toContain(r);
    expect(labels(text).includes(soll.requiredLabel), `P11: Zeile „${soll.requiredLabel}“`).toBe(p.required);
  });

  it('REQ-118-AC5: jede Verarbeitung nennt Daten, Zweck, Rechtsgrundlage und Dauer in gleichbleibender Reihenfolge', () => {
    for (const p of soll.processing) {
      const expected = p.required ? [...soll.labels, soll.requiredLabel] : [...soll.labels];
      expect(labels(section(md, p.heading)), p.heading).toEqual(expected);
    }
  });

  it('REQ-118-AC2, REQ-74-AC2: Kontaktformular und Selbsteinschätzung nennen die gespeicherten Angaben', () => {
    // migrations/00016_contact_messages.sql, ADR 0010
    const contact = section(md, soll.processing[2].heading);
    for (const field of soll.contactFields) expect(contact, `Angabe ${field}`).toContain(field);
    const results = section(md, soll.processing[4].heading);
    for (const field of soll.resultFields) expect(results, `Angabe ${field}`).toContain(field);
  });

  it('REQ-90-AC7: Fristen für Kontaktnachrichten und Beratungsanfragen stimmen mit der automatischen Löschung überein', () => {
    // Backend: service.RetentionMonths = 6, Fristbeginn Eingang bzw. letzte Anfrage (retention_test.go)
    expect(section(md, soll.processing[2].heading)).toContain(soll.processing[2].retention[0]);
    for (const r of soll.processing[3].retention) expect(section(md, soll.processing[3].heading)).toContain(r);
  });

  it('REQ-118-AC1 (P14), REQ-74-AC3: Browserspeicher nennt genau die vier Einträge mit Zweck und Dauer', () => {
    const text = section(md, soll.storageHeading);
    expect(text).toContain(soll.storageBasis);
    const rows = text.split('\n').filter((l) => l.startsWith('| `'));
    expect(rows.map((r) => r.match(/`([^`]+)`/)![1])).toEqual(STORAGE.map((s) => s.key));
    rows.forEach((row, i) => {
      const cells = row.split('|').slice(1, -1).map((c) => c.trim());
      expect(cells, `Zeile ${STORAGE[i].key}`).toHaveLength(3);
      for (const cell of cells) expect(cell).not.toBe('');
      const duration = STORAGE[i].duration;
      if (duration) expect(cells[2], `Dauer ${STORAGE[i].key}`).toContain(duration);
    });
  });

  it('REQ-118-AC1 (P5), REQ-74-AC3: Empfänger ist Hetzner als Auftragsverarbeiter', () => {
    const text = section(md, soll.recipientsHeading);
    expect(text).toContain('Hetzner Online GmbH');
    expect(text).toContain(soll.processor);
  });

  it('REQ-118-AC1 (P8, P9, P10), REQ-74-AC1: Rechte, Widerruf und Beschwerderecht stehen einmal im Abschnitt der Rechte', () => {
    const text = section(md, soll.rightsHeading);
    for (const art of ['15', '16', '17', '18', '20', '77']) {
      const pattern = new RegExp(`Art\\. ${art}\\b`, 'g');
      expect(text, `Art. ${art}`).toMatch(pattern);
      expect(md.match(pattern), `Art. ${art} nur einmal`).toHaveLength(1);
    }
    expect(text).toContain(soll.withdrawal);
    expect(text).toContain('Der Hessische Beauftragte für Datenschutz und Informationsfreiheit');
  });

  it('REQ-118-AC1 (P13), REQ-118-AC5: Widerspruchsrecht steht getrennt in einem eigenen, hervorgehobenen Abschnitt', () => {
    const text = section(md, soll.objectionHeading);
    const quote = text.split('\n').filter((l) => l.startsWith('> ')).join('\n');
    expect(quote, 'hervorgehobener Hinweis (Zitatblock)').toContain(soll.objection);
    expect(quote).toContain(LIT_F[lang]);
    expect(count(md, soll.objection), 'Art. 21 nur im Abschnitt Widerspruchsrecht').toBe(1);
    expect((lf(md).match(/^> /gm) ?? []).length, 'nur das Widerspruchsrecht ist abgesetzt').toBe(1);
  });

  it('REQ-118-AC3: keine technischen Umsetzungsdetails und keine Zusammenfassung, die Abschnitte wiederholt', () => {
    const forbidden = [/HMAC/i, /SHA-?256/i, /\bBits?\b/i, /\bMB\b/, /pro Stunde|per hour/i, /\bIPv[46]\b/, /Kurz gesagt|In short/i, /Arbeitsspeicher|in memory/i, /rotiert|rotated/i];
    for (const bad of forbidden) expect(md, `unerwartet: ${bad}`).not.toMatch(bad);
  });

  it('REQ-118-AC3: keine Aussage steht mehrfach im Text', () => {
    const all = sentences(md);
    const twice = all.filter((s, i) => all.indexOf(s) !== i);
    expect(twice).toEqual([]);
    // Kontaktdaten und Aufsichtsbehörde je einmal; Rechtsgrundlagen nur dort, wo sie gelten
    expect(count(md, CONTROLLER.mail)).toBe(1);
    expect(count(md, 'Hetzner')).toBe(1);
    expect(count(md, LIT_F[lang]), 'lit. f: drei Verarbeitungen und Widerspruchsrecht').toBe(4);
    expect(count(md, LIT_B[lang]), 'lit. b: Kontaktformular und Beratungsanfrage').toBe(2);
  });

  it('REQ-118-AC4: höchstens die Hälfte der bisherigen Wortzahl', () => {
    expect(words(md)).toBeLessThanOrEqual(Math.floor(WORDS_BEFORE[lang] / 2));
  });

  it('REQ-118-AC8: aktuelles Stand-Datum am Ende', () => {
    const last = lf(md).trimEnd().split('\n').pop()!;
    expect(last).toMatch(soll.updated);
  });

  it('REQ-118-AC6, REQ-74-AC5: Abschnitte vollständig und in der vorgesehenen Reihenfolge', () => {
    expect(headings(md)).toEqual(soll.sections);
  });
});

describe('Datenschutzerklärung DE/EN', () => {
  it('REQ-118-AC6, REQ-74-AC5: beide Fassungen nennen dieselben Zahlen, Schlüssel und Verweise', () => {
    expect(facts(privacyEn)).toEqual(facts(privacyDe));
  });

  it('REQ-118-AC6: jeder Abschnitt hat in beiden Sprachen denselben Aufbau und dieselben Fakten', () => {
    SOLL.de.sections.forEach((heading, i) => {
      expect(shape(section(privacyEn, SOLL.en.sections[i])), heading).toEqual(shape(section(privacyDe, heading)));
    });
  });

  it('REQ-118-AC6: Stand-Datum ist in beiden Sprachen derselbe Tag', () => {
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const monate = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
    const de = privacyDe.match(/^Stand: (\d{1,2})\. (\S+) (\d{4})$/m)!;
    const en = privacyEn.match(/^Last updated: (\d{1,2}) (\S+) (\d{4})$/m)!;
    expect([en[1], months.indexOf(en[2].toLowerCase()), en[3]]).toEqual([de[1], monate.indexOf(de[2].toLowerCase()), de[3]]);
  });

  it('REQ-118-AC7, REQ-74-AC4: veröffentlichte Fassungen entsprechen der freigegebenen Revision', async () => {
    expect(release.freigegebenAm, 'Freigabedatum fehlt').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Neue Fassung braucht eine neue Freigabe der verantwortlichen Stelle im Ticket #118
    expect(release.nachweis, 'Freigabenachweis fehlt').toMatch(/^https:\/\/github\.com\/MarvinJakob\/KIPerspektiven\/issues\/118#issuecomment-\d+$/);
    expect(await sha256(privacyDe), 'deutsche Fassung weicht von der Freigabe ab').toBe(release.sha256.de);
    expect(await sha256(privacyEn), 'englische Fassung weicht von der Freigabe ab').toBe(release.sha256.en);
  });
});
