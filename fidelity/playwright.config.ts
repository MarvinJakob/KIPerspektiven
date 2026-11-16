// Fidelity-Tests prüfen die laufende Anwendung von außen (Browser und HTTP), nie den Code direkt.
// Ziel-URL: BASE_URL, Standard ist der lokale Server aus app/Makefile (`make run`) bzw. der Container im Merge Gate.
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './tests',
  // Ein Test pro Akzeptanzkriterium, unabhängig voneinander. Fehlschläge sind im Backlog erwartet.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  reporter: [
    ['list'],
    // Grundlage für scripts/gate.mjs (Merge Gate, Release Gate, Testlauf von Team 2)
    ['json', { outputFile: 'results.json' }],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobil', use: { ...devices['Pixel 7'] } },
  ],
});
