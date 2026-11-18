import { randomBytes, randomInt } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { test as base, expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';

/** Gespeicherte Sitzungen der Testkonten aus der Entwicklungs-Migration (auth.setup.ts). */
export const AUTH = { editor: '.auth/editor.json', admin: '.auth/admin.json', marketing: '.auth/marketing.json' } as const;
export const ACCOUNTS = {
  editor: { email: 'redaktion@example.test', password: 'redaktion-test' },
  admin: { email: 'admin@example.test', password: 'admin-test-123' },
  // Ticket #64: reines Marketing-Konto für Statistik, Nachrichten und Beratungsanfragen
  marketing: { email: 'marketing@example.test', password: 'marketing-test-1' },
} as const;

/** Zufällige, eindeutige Kennung für Testdaten (Titel, Adressen, Kürzel). */
export const uid = () => randomBytes(5).toString('hex');

/** Zufällige Client-IP aus 10.0.0.0/8. Isoliert Ratenbegrenzung und IP-Statistik je Test. */
export const randomIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

export type Role = 'admin' | 'editor' | 'marketing';
export interface Me {
  id: number;
  email: string;
  displayName: string;
  roles: Role[];
  csrfToken: string;
}

/** API-Sitzung eines Redaktionskontos: sendet bei schreibenden Aufrufen das CSRF-Token. */
export class Session {
  constructor(
    readonly ctx: APIRequestContext,
    readonly me: Me,
  ) {}

  get(url: string) {
    return this.ctx.get(url);
  }
  send(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, data?: unknown): Promise<APIResponse> {
    return this.ctx.fetch(url, { method, data, headers: { 'X-CSRF-Token': this.me.csrfToken } });
  }
  upload(url: string, file: { name: string; mimeType: string; buffer: Buffer }) {
    return this.ctx.fetch(url, { method: 'PUT', multipart: { file }, headers: { 'X-CSRF-Token': this.me.csrfToken } });
  }
}

export interface PostText {
  lang: 'de' | 'en';
  title: string;
  summary: string;
  bodyMarkdown: string;
  coverAlt?: string;
}
export interface EditorPost {
  id: number;
  slug: string;
  status: 'draft' | 'published';
  topics: string[];
  texts: PostText[];
  publishedAt?: string;
  scheduledAt?: string;
  cover?: { src: string; alt: string };
}

/** Vollständige Fassung eines Beitrags mit eindeutigem Titel. */
export const fullText = (lang: 'de' | 'en', tag: string): PostText => ({
  lang,
  title: lang === 'de' ? `Testbeitrag ${tag}` : `Test post ${tag}`,
  summary: lang === 'de' ? `Kurztext ${tag}` : `Summary ${tag}`,
  bodyMarkdown: lang === 'de' ? `Beitragstext ${tag} mit genug Inhalt.` : `Body ${tag} with enough content.`,
});

interface Fixtures {
  ip: string;
  editor: Session;
  admin: Session;
  /** Reines Marketing-Konto aus den Testdaten (Ticket #64). */
  marketing: Session;
  /** Legt Beiträge über die API an und löscht sie nach dem Test wieder. */
  posts: {
    create(input: { texts: PostText[]; topics?: string[]; slug?: string }): Promise<EditorPost>;
    publish(id: number): Promise<EditorPost>;
  };
  /** Öffnet eine weitere API-Sitzung, z. B. für neu angelegte Konten. */
  login(email: string, password: string): Promise<{ status: number; session?: Session }>;
}

export const test = base.extend<Fixtures>({
  ip: async ({}, use) => use(randomIp()),
  // Gilt für Browser (page) und request: Jede Anfrage trägt die Client-IP des Tests.
  extraHTTPHeaders: async ({ ip }, use) => use({ 'X-Forwarded-For': ip }),

  login: async ({ playwright, baseURL, ip }, use) => {
    const opened: APIRequestContext[] = [];
    await use(async (email, password) => {
      // Leerer Zustand: Eine Anmeldung mit vorhandenem Sitzungscookie ersetzt dessen Sitzung (http/auth.go).
      const ctx = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] }, extraHTTPHeaders: { 'X-Forwarded-For': ip } });
      opened.push(ctx);
      const res = await loginWithRetry(ctx, email, password);
      if (res.status() !== 200) return { status: res.status() };
      return { status: 200, session: new Session(ctx, (await res.json()) as Me) };
    });
    for (const c of opened) await c.dispose();
  },

  editor: async ({ playwright, baseURL, ip }, use) => {
    const s = await openSession(playwright.request.newContext.bind(playwright.request), baseURL!, ip, AUTH.editor);
    await use(s);
    await s.ctx.dispose();
  },
  admin: async ({ playwright, baseURL, ip }, use) => {
    const s = await openSession(playwright.request.newContext.bind(playwright.request), baseURL!, ip, AUTH.admin);
    await use(s);
    await s.ctx.dispose();
  },
  marketing: async ({ playwright, baseURL, ip }, use) => {
    const s = await openSession(playwright.request.newContext.bind(playwright.request), baseURL!, ip, AUTH.marketing);
    await use(s);
    await s.ctx.dispose();
  },

  posts: async ({ editor }, use) => {
    const created: number[] = [];
    await use({
      async create({ texts, topics = [], slug }) {
        const res = await editor.send('POST', '/api/admin/posts', { featured: false, topics, texts, ...(slug ? { slug } : {}) });
        expect(res.status(), await res.text()).toBe(201);
        const post = (await res.json()) as EditorPost;
        created.push(post.id);
        return post;
      },
      async publish(id) {
        const res = await editor.send('POST', `/api/admin/posts/${id}/publish`);
        expect(res.status(), await res.text()).toBe(200);
        return (await res.json()) as EditorPost;
      },
    });
    for (const id of created) await editor.send('DELETE', `/api/admin/posts/${id}`);
  },
});

export { expect };

async function openSession(
  newContext: (o: object) => Promise<APIRequestContext>,
  baseURL: string,
  ip: string,
  storageState: string,
): Promise<Session> {
  const ctx = await newContext({ baseURL, storageState, extraHTTPHeaders: { 'X-Forwarded-For': ip } });
  const res = await ctx.get('/api/auth/me');
  expect(res.status(), 'gespeicherte Sitzung aus auth.setup.ts ist gültig').toBe(200);
  return new Session(ctx, (await res.json()) as Me);
}

/** Anmeldung; `503` (Argon2-Prüfung ausgelastet, Ticket #138) zählt nicht als Fehlversuch und wird wiederholt. */
export async function loginWithRetry(ctx: APIRequestContext, email: string, password: string) {
  for (let i = 0; ; i++) {
    const res = await ctx.post('/api/auth/login', { data: { email, password } });
    if (res.status() !== 503 || i >= 10) return res;
    await new Promise((r) => setTimeout(r, Number(res.headers()['retry-after'] ?? 1) * 200));
  }
}

/** Gültiges PNG mit einer Farbe, ohne Bildbibliothek erzeugt. */
export function pngImage(width = 16, height = 12, rgb: [number, number, number] = [220, 110, 20]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Kein horizontaler Seitenbildlauf (AC zu Desktop 1280 px und Mobil 375 px). */
export async function expectNoHorizontalScroll(page: Page) {
  const { overflow, culprits } = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    // Tiefste Elemente, die rechts herausragen, als Hinweis auf die Ursache
    const culprits = [...document.querySelectorAll('body *')]
      .filter((e) => e.getBoundingClientRect().right > w + 0.5 && ![...e.children].some((k) => k.getBoundingClientRect().right > w + 0.5))
      .slice(0, 5)
      .map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${String(e.className).replace(/\s+/g, '.')} (rechts ${Math.round(e.getBoundingClientRect().right)} px)`);
    return { overflow: document.documentElement.scrollWidth - w, culprits };
  });
  expect(overflow, `Seite ist breiter als das Fenster: ${culprits.join(', ')}`).toBeLessThanOrEqual(0);
}

/** Fokus per Tastatur auf ein Element setzen und prüfen, dass er sichtbar markiert ist. */
export async function expectVisibleKeyboardFocus(page: Page, selectorOrLocator: ReturnType<Page['locator']>) {
  const el = selectorOrLocator;
  await el.focus();
  const style = await el.evaluate((node) => {
    const s = getComputedStyle(node);
    return { focusVisible: node.matches(':focus-visible'), outline: s.outlineStyle, width: s.outlineWidth, shadow: s.boxShadow };
  });
  expect(style.focusVisible, 'Element ist per Tastatur fokussiert').toBe(true);
  const marked = (style.outline !== 'none' && style.width !== '0px') || style.shadow !== 'none';
  expect(marked, `Fokus ist sichtbar markiert (${JSON.stringify(style)})`).toBe(true);
}

/** Alle Dimensionen der Selbsteinschätzung über die Oberfläche bewerten und die Auswertung öffnen. */
export async function completeAssessment(page: Page, lang: 'de' | 'en', levels?: number[]) {
  const res = await page.request.get(`/api/audit?lang=${lang}`);
  const audit = (await res.json()) as { dimensions: { slug: string }[] };
  await page.goto(`/${lang}/themen/ai-audit/${audit.dimensions[0].slug}`);
  for (const [i, d] of audit.dimensions.entries()) {
    const level = levels?.[i] ?? 2;
    await page.locator(`#reifegrad-${d.slug}-${level}`).check();
    const last = i === audit.dimensions.length - 1;
    const label = last ? (lang === 'de' ? 'Auswertung anzeigen' : 'Show results') : lang === 'de' ? 'Weiter' : 'Next';
    await page.getByRole('button', { name: label }).click();
    if (!last) await expect(page).toHaveURL(new RegExp(`/${audit.dimensions[i + 1].slug}$`));
  }
  await expect(page).toHaveURL(/\/themen\/ai-audit\/auswertung$/);
  return audit.dimensions.map((d) => d.slug);
}
