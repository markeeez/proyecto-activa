/**
 * Relay HTTP hacia FatSecret (solo oauth.fatsecret.com y platform.fatsecret.com).
 * El tráfico sale por la IP de este servidor → úsala en la lista blanca de FatSecret.
 *
 * Uso:
 *   RELAY_SECRET="$(openssl rand -hex 32)" PORT=8787 node fatsecret-relay.mjs
 *
 * Health: GET http://127.0.0.1:8787/health
 */

import http from 'http';
import { URL } from 'url';

const ALLOWED_HOSTS = new Set(['oauth.fatsecret.com', 'platform.fatsecret.com']);
const SKIP_HEADERS = new Set([
  'connection',
  'host',
  'content-length',
  'transfer-encoding',
  'keep-alive',
]);

const SECRET = (process.env.RELAY_SECRET ?? '').trim();
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.BIND ?? '0.0.0.0';

function jsonError(res, status, msg) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: msg }));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  if (req.url !== '/relay' || req.method !== 'POST') {
    jsonError(res, 404, 'not found');
    return;
  }

  if (!SECRET) {
    jsonError(res, 500, 'RELAY_SECRET not set');
    return;
  }

  const incoming = (req.headers['x-fatsecret-relay-secret'] ?? '').trim();
  if (incoming !== SECRET) {
    jsonError(res, 401, 'unauthorized');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    jsonError(res, 400, 'invalid json');
    return;
  }

  const targetUrl = typeof payload.url === 'string' ? payload.url.trim() : '';
  if (!targetUrl || targetUrl.length > 4096) {
    jsonError(res, 400, 'url required');
    return;
  }

  let u;
  try {
    u = new URL(targetUrl);
  } catch {
    jsonError(res, 400, 'bad url');
    return;
  }

  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname)) {
    jsonError(res, 403, 'host not allowed');
    return;
  }

  const method = String(payload.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    jsonError(res, 400, 'method must be GET or POST');
    return;
  }

  const h = new Headers();
  const hdrs = payload.headers;
  if (hdrs && typeof hdrs === 'object' && !Array.isArray(hdrs)) {
    for (const [k, v] of Object.entries(hdrs)) {
      if (typeof v !== 'string') continue;
      if (SKIP_HEADERS.has(k.toLowerCase())) continue;
      // Evita \r\n finales al pegar Basic auth desde .env / JSON
      h.set(k, v.trim());
    }
  }

  const body =
    method === 'POST' && payload.body != null && payload.body !== ''
      ? String(payload.body).trim()
      : undefined;

  try {
    const upstream = await fetch(targetUrl, { method, headers: h, body });
    const buf = new Uint8Array(await upstream.arrayBuffer());
    const ct =
      upstream.headers.get('content-type') ?? 'application/octet-stream';
    res.writeHead(upstream.status, {
      'Content-Type': ct,
      'Content-Length': String(buf.byteLength),
    });
    res.end(Buffer.from(buf));
  } catch (e) {
    console.error('[fatsecret-relay] upstream', e);
    jsonError(res, 502, 'upstream failed');
  }
});

if (!SECRET) {
  console.error('Set RELAY_SECRET (long random string). Example: openssl rand -hex 32');
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log(`[fatsecret-relay] http://${HOST}:${PORT}  (POST /relay, GET /health)`);
});
