// Startet das lokal gebaute Binary (`make build` bzw. ../.build/server[.exe]) mit frischer Datenbank
// für einen Testlauf. Das Merge Gate nutzt stattdessen das geprüfte Docker-Image (E2E_BASE_URL).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const port = process.argv[2] ?? '8090';
const exe = resolve(import.meta.dirname, '..', '..', '.build', process.platform === 'win32' ? 'server.exe' : 'server');
if (!existsSync(exe)) {
  console.error(`Binary fehlt: ${exe}. Zuerst die Anwendung bauen (app/Makefile, Ziel build).`);
  process.exit(1);
}
const dir = mkdtempSync(join(tmpdir(), 'ki-e2e-'));
const child = spawn(exe, [], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ADDR: `127.0.0.1:${port}`,
    DEV_SEED: 'true',
    DATABASE_PATH: join(dir, 'app.db'),
    MEDIA_PATH: join(dir, 'media'),
    SERVE_MEDIA: 'true',
    PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
    // Die Tests senden ihre Client-IP per X-Forwarded-For (support/fixtures.ts).
    TRUSTED_PROXIES: '127.0.0.1',
  },
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill());
child.on('exit', (code) => process.exit(code ?? 0));
