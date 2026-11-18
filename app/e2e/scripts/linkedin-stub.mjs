// LinkedIn-Testdouble für die Akzeptanztests zu Ticket #85. Bildet die von der Anwendung genutzten Endpunkte nach:
//   GET  /oauth/v2/authorization  leitet sofort mit Code und state zur redirect_uri zurück (oder mit error=…)
//   POST /oauth/v2/accessToken    liefert ein Zugriffstoken mit 60 Tagen Laufzeit
//   GET  /v2/userinfo             liefert das verbundene Profil
//   POST /rest/posts              legt einen Post an (201 mit x-restli-id), lehnt ab (401) oder bricht ab
// Steuerung für die Tests (nicht Teil von LinkedIn):
//   POST /__stub/mode   {"posts":"ok"|"reject401"|"drop", "authorize":"ok"|"deny"}
//   GET  /__stub/posts  angenommene Posts (auch abgebrochene, die LinkedIn angelegt hätte)
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 8091);
export const STUB_TOKEN = 'e2e-linkedin-geheimes-token';

let mode = { posts: 'ok', authorize: 'ok' };
const posts = [];

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const body = await readBody(req);
  switch (`${req.method} ${url.pathname}`) {
    case 'GET /oauth/v2/authorization': {
      const back = new URL(url.searchParams.get('redirect_uri'));
      back.searchParams.set('state', url.searchParams.get('state') ?? '');
      if (mode.authorize === 'deny') {
        back.searchParams.set('error', 'user_cancelled_authorize');
      } else {
        back.searchParams.set('code', 'e2e-code');
      }
      res.writeHead(302, { Location: back.toString() });
      return res.end();
    }
    case 'POST /oauth/v2/accessToken': {
      const form = new URLSearchParams(body);
      if (form.get('code') !== 'e2e-code' || !form.get('client_secret')) return json(res, 400, { error: 'invalid_request' });
      return json(res, 200, { access_token: STUB_TOKEN, expires_in: 5184000 });
    }
    case 'GET /v2/userinfo':
      if (req.headers.authorization !== `Bearer ${STUB_TOKEN}`) return json(res, 401, { message: 'unauthorized' });
      return json(res, 200, { sub: 'e2e-member', name: 'E2E Profil' });
    case 'POST /rest/posts': {
      if (req.headers.authorization !== `Bearer ${STUB_TOKEN}`) return json(res, 401, { message: 'unauthorized' });
      if (mode.posts === 'reject401') return json(res, 401, { message: `token expired ${STUB_TOKEN}` });
      const post = JSON.parse(body);
      posts.push(post);
      if (mode.posts === 'drop') return req.socket.destroy(); // angelegt, aber keine Antwort
      return json(res, 201, {}, { 'x-restli-id': `urn:li:share:${posts.length}` });
    }
    case 'POST /__stub/mode':
      mode = { ...mode, ...JSON.parse(body || '{}') };
      return json(res, 200, mode);
    case 'GET /__stub/posts':
      return json(res, 200, posts);
    case 'GET /__stub/health':
      return json(res, 200, { ok: true });
  }
  json(res, 404, { message: 'not found' });
}).listen(port, '127.0.0.1');
