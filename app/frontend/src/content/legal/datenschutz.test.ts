import { describe, expect, it } from 'vitest';
import privacyDe from './datenschutz.de.md?raw';
import privacyEn from './datenschutz.en.md?raw';
import imprintDe from './impressum.de.md?raw';
import imprintEn from './impressum.en.md?raw';
import release from './datenschutz.freigabe.json';

// Anforderung #74: Datenschutzerklärung auf Deutsch und Englisch vervollständigen.
// Spezifikation und Abgleich: Ticket #74 und app/docs/datenschutz-abnahme.md.
// Fidelity-Tests über die ausgelieferte Seite: app/e2e/tests/74-datenschutz.spec.ts.
//
// Sollwerte stammen aus den Quellen des Tickets, nicht aus den Texten selbst:
// Impressum-Abnahme (#103), ADR 0010 (Statistik, #130/#142), ADR 0011 (Beratung, #136),
// Migration 00016 und internal/http/contact.go (Kontaktformular, #4), deploy/Caddyfile und betrieb.md (Protokolle).

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

const SOLL = {
  de: {
    sections: [
      'Verantwortliche Stelle',
      'Kurz gesagt',
      'Hosting und Server-Protokolle',
      'Cookies und Speicherzugriffe',
      'Kontaktformular',
      'Anfrage für ein Beratungsgespräch',
      'Statistik',
      'Empfänger und Übermittlung',
      'Deine Rechte',
    ],
    controllerHeading: 'Verantwortliche Stelle',
    contactHeading: 'Kontaktformular',
    consultHeading: 'Anfrage für ein Beratungsgespräch',
    statsHeading: 'Statistik',
    hostingHeading: 'Hosting und Server-Protokolle',
    rightsHeading: 'Deine Rechte',
    contactFields: ['Name', 'Unternehmen (freiwillig)', 'E-Mail-Adresse', 'Nachricht', 'Sprache der Seite', 'Zeitpunkt'],
    contactLimit: '100 Nachrichten pro Stunde',
    consultLimit: 'fünf Anfragen pro Stunde',
    noIpStored: 'keine IP-Adresse',
    supervisor: 'Der Hessische Beauftragte für Datenschutz und Informationsfreiheit',
  },
  en: {
    sections: [
      'Controller',
      'In short',
      'Hosting and server logs',
      'Cookies and storage access',
      'Contact form',
      'Consultation requests',
      'Statistics',
      'Recipients and transfers',
      'Your rights',
    ],
    controllerHeading: 'Controller',
    contactHeading: 'Contact form',
    consultHeading: 'Consultation requests',
    statsHeading: 'Statistics',
    hostingHeading: 'Hosting and server logs',
    rightsHeading: 'Your rights',
    contactFields: ['name', 'company (optional)', 'email address', 'message', 'language of the page', 'time'],
    contactLimit: '100 messages per hour',
    consultLimit: 'five requests per hour',
    noIpStored: 'no IP address',
    supervisor: 'Der Hessische Beauftragte für Datenschutz und Informationsfreiheit',
  },
} as const;

/** Text eines Abschnitts (## Überschrift) bis zum nächsten Abschnitt. */
function section(md: string, heading: string): string {
  const parts = md.replace(/\r\n/g, '\n').split(/^## /m);
  const hit = parts.find((p) => p.startsWith(`${heading}\n`));
  expect(hit, `Abschnitt „${heading}“ fehlt`).toBeDefined();
  return hit!.slice(heading.length + 1);
}

const headings = (md: string) => [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
/** Prüfbare Fakten, die in beiden Sprachen identisch sein müssen: Zahlen, Schlüssel in Backticks, Verweise. */
const facts = (md: string) => ({
  numbers: [...md.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0].replace(',', '.')).sort(),
  codes: [...md.matchAll(/`([^`]+)`/g)].map((m) => m[1]).sort(),
  links: [...md.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1].replace(/\/(de|en)\//, '/:lang/')).sort(),
});

async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text.replace(/\r\n/g, '\n'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe.each(LANGS)('Datenschutzerklärung (%s)', (lang) => {
  const md = TEXT[lang];
  const soll = SOLL[lang];

  it('REQ-74-AC1: verantwortliche Stelle mit bestätigtem Namen, Postanschrift, Telefon und E-Mail', () => {
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
    for (const bad of [/Platzhalter/i, /Placeholder/i, /\[Name/, /TODO/, /rechtlich geprüft werden/, /legal review/i, /Design\.md/, /^> /m]) {
      expect(md, `unerwartet: ${bad}`).not.toMatch(bad);
    }
  });

  it('REQ-74-AC2: Kontaktformular mit Angaben, Zweck, Rechtsgrundlage, Zugriff, Löschung und IP-Begrenzung', () => {
    const text = section(md, soll.contactHeading);
    for (const field of soll.contactFields) expect(text, `Angabe ${field}`).toContain(field);
    expect(text).toContain(soll.noIpStored);
    expect(text).toContain(soll.contactLimit);
    expect(text).toMatch(/Art\. 6 Abs\. 1 lit\. [bf] DSGVO|Art\. 6\(1\)\([bf]\) GDPR/);
    expect(text).toMatch(/Redaktion|editorial/);
    expect(text).toMatch(/lösch|delete/i);
  });

  it('REQ-74-AC2: Beratungsanfrage getrennt vom Kontaktformular, mit Löschung nach Terminabstimmung', () => {
    const text = section(md, soll.consultHeading);
    expect(text).toContain(soll.consultLimit);
    expect(text).toMatch(/Art\. 6 Abs\. 1 lit\. b DSGVO|Art\. 6\(1\)\(b\) GDPR/);
    expect(text).toMatch(/Termin abgestimmt ist|appointment has been arranged/);
    expect(text).not.toContain(soll.contactLimit);
  });

  it('REQ-74-AC3: Reichweitenstatistik und Ergebnisse der Selbsteinschätzung mit Kennungen, Auswahl und Dauer', () => {
    const text = section(md, soll.statsHeading);
    expect(text).toContain('HMAC-SHA-256');
    expect(text).toMatch(/Art\. 21 DSGVO|Art\. 21 GDPR/);
    expect(text).toMatch(/§ 25 Abs\. 1 TDDDG|§ 25\(1\) TDDDG/);
    expect(text).toMatch(/jährlich|annually/);
    expect(text).toMatch(/Hashwert|hash/);
  });

  it('REQ-74-AC3: Hosting, Zugriffsprotokoll und Anwendungsprotokoll entsprechen dem Betrieb', () => {
    const text = section(md, soll.hostingHeading);
    expect(text).toContain('Hetzner Online GmbH');
    expect(text).toMatch(/sieben Tage|seven days/);
    expect(text).toMatch(/Art\. 6 Abs\. 1 lit\. f DSGVO|Art\. 6\(1\)\(f\) GDPR/);
  });

  it('REQ-74-AC3: Browserspeicherung nennt alle vier Einträge der Anwendung', () => {
    for (const key of ['ki-perspektiven.lang', 'ki-perspektiven.theme', 'ki-perspektiven.consent', 'ki_session']) {
      expect(md).toContain(`\`${key}\``);
    }
  });

  it('REQ-74-AC1: Rechte der betroffenen Personen und Beschwerderecht bei der Aufsichtsbehörde', () => {
    const text = section(md, soll.rightsHeading);
    for (const art of ['15', '16', '17', '18', '20', '21', '77']) expect(text).toMatch(new RegExp(`Art\\. ${art}\\b`));
    expect(text).toContain(soll.supervisor);
  });

  it('REQ-74-AC5: Abschnitte vollständig und in der vorgesehenen Reihenfolge', () => {
    expect(headings(md)).toEqual(soll.sections);
  });
});

describe('Datenschutzerklärung DE/EN', () => {
  it('REQ-74-AC5: beide Fassungen nennen dieselben Zahlen, Schlüssel und Verweise (keine fehlende Übersetzung)', () => {
    expect(facts(privacyEn)).toEqual(facts(privacyDe));
  });

  it('REQ-74-AC4: veröffentlichte Fassungen entsprechen der freigegebenen Revision', async () => {
    expect(release.freigegebenAm, 'Freigabedatum fehlt').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(release.nachweis, 'Freigabenachweis fehlt').toMatch(/^https:\/\/github\.com\/MarvinJakob\/KIPerspektiven\/issues\/74#issuecomment-\d+$/);
    expect(await sha256(privacyDe), 'deutsche Fassung weicht von der Freigabe ab').toBe(release.sha256.de);
    expect(await sha256(privacyEn), 'englische Fassung weicht von der Freigabe ab').toBe(release.sha256.en);
  });
});
