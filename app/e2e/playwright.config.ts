import { defineConfig, devices } from '@playwright/test';

/**
 * Akzeptanztests der Anforderungen #16 bis #28 (AGENTS.md, Abschnitt 2).
 *
 * Die Tests laufen gegen die gebaute Anwendung mit Testdaten (DEV_SEED=true) und echtem Backend.
 * - CI: Das Merge Gate startet das geprüfte Image und setzt E2E_BASE_URL.
 * - Lokal: Ohne E2E_BASE_URL startet scripts/start-server.mjs das Binary aus ../.build mit frischer Datenbank.
 *
 * Jeder Test sendet eine eigene Client-IP (X-Forwarded-For, siehe support/fixtures.ts). Ratenbegrenzungen
 * und IP-bereinigte Statistik sind dadurch je Test isoliert, die Tests laufen parallel.
 * Die Statistiktests (#26) zählen Seitenaufrufe des gesamten Servers und laufen deshalb zuletzt und seriell.
 */
const port = Number(process.env.E2E_PORT ?? 8090);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const linkedinPort = Number(process.env.E2E_LINKEDIN_PORT ?? 8091);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, testDir: './support' },
    {
      name: 'akzeptanz',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      dependencies: ['setup'],
      testIgnore: /26-.*\.spec\.ts/,
    },
    {
      // Zählt serverweite Seitenaufrufe: erst nach allen anderen Tests und ohne Parallelität.
      name: 'statistik',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      dependencies: ['akzeptanz'],
      testMatch: /26-.*\.spec\.ts/,
      fullyParallel: false,
    },
  ],
  // Das LinkedIn-Testdouble (Ticket #85) läuft immer; die Anwendung startet nur lokal. Im Merge Gate zeigt das Image
  // per LINKEDIN_AUTH_URL und LINKEDIN_API_URL auf dasselbe Testdouble (.github/workflows/tests.yml).
  webServer: [
    {
      command: `node scripts/linkedin-stub.mjs ${linkedinPort}`,
      url: `http://127.0.0.1:${linkedinPort}/__stub/health`,
      reuseExistingServer: false,
      timeout: 15_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    ...(process.env.E2E_BASE_URL
      ? []
      : [
          {
            command: `node scripts/start-server.mjs ${port} ${linkedinPort}`,
            url: `${baseURL}/api/health`,
            reuseExistingServer: false,
            timeout: 60_000,
            stdout: 'ignore' as const,
            stderr: 'pipe' as const,
          },
        ]),
  ],
});
