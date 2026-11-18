// Bug #80: Das Caddy-Zugriffsprotokoll darf keine vollständige Client-IP enthalten und keine Einträge, die älter
// als sieben Tage sind (Zusage der Datenschutzerklärung, REQ-74-AC3).
//
// Geprüft wird die ausgelieferte Konfiguration app/deploy/Caddyfile mit echtem Caddy in der Version aus
// app/compose.yaml. CADDY_BIN zeigt auf das Programm; in CI kopiert tests.yml es aus genau diesem Image.
// Ohne CADDY_BIN schlagen die Tests fehl, statt still übersprungen zu werden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url);
const CADDYFILE = readFileSync(new URL('app/deploy/Caddyfile', ROOT), 'utf8');
const COMPOSE = readFileSync(new URL('app/compose.yaml', ROOT), 'utf8');
const CADDY = process.env.CADDY_BIN;
const DAY_NS = 24 * 3600 * 1e9;

// Sollwerte aus der Datenschutzerklärung (#74): IPv4 auf 24 Bit, IPv6 auf 48 Bit, höchstens sieben Tage.
const IP_FIELDS = ['request>remote_ip', 'request>client_ip'];
const FORWARD_HEADERS = ['request>headers>X-Forwarded-For', 'request>headers>X-Real-Ip', 'request>headers>Forwarded'];
const MAX_AGE_DAYS = 7;

function requireCaddy() {
  assert.ok(CADDY && existsSync(CADDY), 'CADDY_BIN muss auf ein Caddy-Programm in der Version aus app/compose.yaml zeigen');
}

/** Caddyfile mit lokalen Pfaden statt der Container-Pfade; die Log-Direktive bleibt unverändert. */
function localCaddyfile(dir, backendPort) {
  return CADDYFILE.replaceAll('/data/logs/access.log', join(dir, 'access.log').replaceAll('\\', '/'))
    .replaceAll('/srv/media', dir.replaceAll('\\', '/'))
    .replaceAll('backend:8080', `127.0.0.1:${backendPort}`);
}

function caddyEnv(port, adminPort) {
  return { ...process.env, DOMAIN: `http://127.0.0.1:${port}`, REDIRECT_DOMAINS: '', CADDY_ADMIN: `127.0.0.1:${adminPort}` };
}

function adapt() {
  requireCaddy();
  const dir = mkdtempSync(join(tmpdir(), 'caddy-adapt-'));
  try {
    const file = join(dir, 'Caddyfile');
    writeFileSync(file, localCaddyfile(dir, 8080));
    const out = execFileSync(CADDY, ['adapt', '--config', file, '--adapter', 'caddyfile'], { env: caddyEnv(8443, 2999), stdio: ['ignore', 'pipe', 'ignore'] });
    const logs = Object.values(JSON.parse(out).logging.logs).filter((l) => l.writer?.output === 'file');
    assert.equal(logs.length, 1, 'genau ein Zugriffsprotokoll als Datei');
    return logs[0];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const durationNs = (v) => (typeof v === 'number' ? v : Number(/^(\d+)h$/.exec(v)?.[1] ?? NaN) * 3600 * 1e9);

test('Bug #80: Caddy-Image ist auf eine Version mit zeitbasierter Rotation festgelegt (ab 2.11)', () => {
  const image = /image:\s*caddy:(\S+)/.exec(COMPOSE)?.[1];
  assert.match(image ?? '', /^2\.(1[1-9]|[2-9]\d)\.\d+-alpine$/, `Caddy-Image ${image} ist nicht auf 2.11 oder neuer festgelegt`);
});

test('Bug #80 / REQ-74-AC3: remote_ip und client_ip werden auf /24 bzw. /48 gekürzt', () => {
  const { fields } = adapt().encoder;
  for (const f of IP_FIELDS) {
    assert.deepEqual(fields[f], { filter: 'ip_mask', ipv4_cidr: 24, ipv6_cidr: 48 }, `${f} wird nicht gekürzt`);
  }
});

test('Bug #80 / REQ-74-AC3: weitergeleitete IP-Angaben aus Kopfzeilen werden nicht protokolliert', () => {
  const { fields } = adapt().encoder;
  for (const f of FORWARD_HEADERS) assert.equal(fields[f]?.filter, 'delete', `${f} wird protokolliert`);
});

test('Bug #80 / REQ-74-AC3: tägliche Rotation hält keine Einträge länger als sieben Tage', () => {
  const { writer } = adapt();
  const interval = durationNs(writer.roll_interval);
  assert.ok(interval > 0 && interval <= DAY_NS, `roll_interval ${writer.roll_interval} rotiert nicht mindestens täglich`);
  // Ältester Eintrag: Laufzeit der Datei (1 Tag) + Aufbewahrung + bis zu 1 Tag bis zur nächsten Bereinigung.
  assert.ok(writer.roll_keep_days >= 1, 'roll_keep_days fehlt');
  assert.ok(writer.roll_keep_days + 2 <= MAX_AGE_DAYS, `roll_keep_days ${writer.roll_keep_days} lässt Einträge älter als ${MAX_AGE_DAYS} Tage zu`);
});

test('Bug #80 / REQ-74-AC3: Zugriffsprotokoll eines echten Abrufs enthält keine vollständige IP', async (t) => {
  requireCaddy();
  const dir = mkdtempSync(join(tmpdir(), 'caddy-run-'));
  const backend = createServer((_, res) => res.end('ok')).listen(0, '127.0.0.1');
  await new Promise((r) => backend.once('listening', r));
  const free = async () => {
    const s = createServer().listen(0, '127.0.0.1');
    await new Promise((r) => s.once('listening', r));
    const { port } = s.address();
    await new Promise((r) => s.close(r));
    return port;
  };
  const port = await free();
  const adminPort = await free();
  const file = join(dir, 'Caddyfile');
  writeFileSync(file, localCaddyfile(dir, backend.address().port));
  const caddy = spawn(CADDY, ['run', '--config', file, '--adapter', 'caddyfile'], { env: caddyEnv(port, adminPort), stdio: 'ignore' });
  const exited = new Promise((r) => caddy.once('exit', r));
  t.after(async () => {
    caddy.kill();
    await exited; // Unter Windows hält Caddy die Protokolldatei bis zum Ende offen.
    backend.close();
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  const forwarded = '203.0.113.77';
  let status;
  for (const deadline = Date.now() + 10_000; Date.now() < deadline; await new Promise((r) => setTimeout(r, 100))) {
    try {
      status = (await fetch(`http://127.0.0.1:${port}/`, { headers: { 'X-Forwarded-For': forwarded, 'X-Real-Ip': forwarded, Forwarded: `for=${forwarded}` } })).status;
      break;
    } catch { /* Caddy startet noch */ }
  }
  assert.equal(status, 200, 'Caddy hat die Anfrage nicht ausgeliefert');

  let lines = [];
  for (const deadline = Date.now() + 5_000; lines.length === 0 && Date.now() < deadline; await new Promise((r) => setTimeout(r, 100))) {
    const log = join(dir, 'access.log');
    if (existsSync(log)) lines = readFileSync(log, 'utf8').split('\n').filter(Boolean);
  }
  assert.ok(lines.length > 0, 'kein Eintrag im Zugriffsprotokoll');
  for (const line of lines) {
    const { request } = JSON.parse(line);
    assert.equal(request.remote_ip, '127.0.0.0', 'remote_ip ist nicht gekürzt');
    assert.equal(request.client_ip, '127.0.0.0', 'client_ip ist nicht gekürzt');
    assert.ok(!line.includes(forwarded), `weitergeleitete IP ${forwarded} steht im Protokoll`);
  }
});
