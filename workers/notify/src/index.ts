/**
 * T4A Push Notification Worker
 * - API: /api/subscribe, /api/unsubscribe, /api/heartbeat
 * - CRON: new issue detection (15min), weekly digest (Mon), re-engagement (daily)
 */

interface Env {
  SUBS: KVNamespace;
  SITE_URL: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  subscribedAt: number;
  lastSeen: number;
  platform: 'chrome' | 'firefox' | 'safari' | 'unknown';
}

function detectPlatform(endpoint: string): Subscription['platform'] {
  if (endpoint.includes('fcm.googleapis.com')) return 'chrome';
  if (endpoint.includes('push.services.mozilla.com')) return 'firefox';
  if (endpoint.includes('web.push.apple.com')) return 'safari';
  return 'unknown';
}

type IssueFeed = Array<{ id: string; headline: string; opinionShift: number; finalScore: number; context: string }>;

// ── CORS — restrict to production + preview origins ──
const PRODUCTION_ORIGIN = 'https://thefourthangle.pages.dev';

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (origin === PRODUCTION_ORIGIN) return true;
  if (origin === 'http://localhost:4321') return true;
  // Allow Cloudflare Pages preview deployments (*.thefourthangle.pages.dev)
  if (/^https:\/\/[a-f0-9]+\.thefourthangle\.pages\.dev$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = isAllowedOrigin(origin) ? origin : PRODUCTION_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(data: unknown, status = 200, request?: Request) {
  const cors = request ? getCorsHeaders(request) : { 'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] };
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

// ── Rate limiting (per-IP, in-memory per isolate) ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;     // max requests per window
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(request: Request): boolean {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// ── Web Push (RFC 8291 payload encryption + RFC 8188 content encoding) ──
// Full implementation using Web Crypto API (ECDH + HKDF + AES-128-GCM)

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concatUint8(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// VAPID JWT for Authorization header (ES256 / ECDSA P-256 + SHA-256)
async function createJWT(audience: string, subject: string, vapidPrivateKey: string, vapidPublicKey: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const headerB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  // Import VAPID private key via JWK — 'raw' format doesn't support ECDSA private keys
  // in Cloudflare Workers. The private key is a 32-byte base64url scalar (d),
  // the public key is a 65-byte uncompressed point (04 || x || y).
  const pubKeyRaw = base64urlToUint8Array(vapidPublicKey);
  // Extract x and y from uncompressed public key (skip the 0x04 prefix byte)
  const x = uint8ArrayToBase64url(pubKeyRaw.slice(1, 33));
  const y = uint8ArrayToBase64url(pubKeyRaw.slice(33, 65));

  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d: vapidPrivateKey, // already base64url
    ext: true,
  };

  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key,
    new TextEncoder().encode(unsigned)
  );

  return `${unsigned}.${uint8ArrayToBase64url(new Uint8Array(sig))}`;
}

// HKDF-SHA-256: extract + expand (RFC 5869)
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key, length * 8
  );
  return new Uint8Array(bits);
}

// Build CEK/nonce info for aes128gcm (RFC 8188 Section 2.2)
// For aes128gcm, the info is simply: "Content-Encoding: <type>\0"
// The public keys are NOT included (unlike the older aesgcm encoding).
function buildCekInfo(type: string): Uint8Array {
  return new TextEncoder().encode(`Content-Encoding: ${type}\0`);
}

// RFC 8291 + RFC 8188: encrypt push payload
async function encryptPayload(
  plaintext: Uint8Array,
  subscriberPublicKeyB64: string,
  subscriberAuthB64: string,
): Promise<{ ciphertext: Uint8Array; serverPublicKey: Uint8Array; salt: Uint8Array }> {
  // 1. Decode subscriber keys
  const subscriberPublicKeyRaw = base64urlToUint8Array(subscriberPublicKeyB64);
  const subscriberAuth = base64urlToUint8Array(subscriberAuthB64);

  // 2. Import subscriber's public key (ECDH P-256, uncompressed 65-byte point)
  const subscriberKey = await crypto.subtle.importKey(
    'raw', subscriberPublicKeyRaw,
    { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );

  // 3. Generate ephemeral ECDH key pair (server-side, per-message)
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );

  // 4. Export server public key (uncompressed, 65 bytes)
  const serverPublicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  );

  // 5. ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: subscriberKey },
      serverKeyPair.privateKey, 256
    )
  );

  // 6. Generate 16-byte random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 7. RFC 8291 Section 3.4: derive IKM from shared secret + auth
  // ikm_info = "WebPush: info\0" || subscriber_public || server_public
  const encoder = new TextEncoder();
  const ikmInfo = concatUint8(
    encoder.encode('WebPush: info\0'),
    subscriberPublicKeyRaw,
    serverPublicKey
  );
  const ikm = await hkdf(subscriberAuth, sharedSecret, ikmInfo, 32);

  // 8. Derive content encryption key (CEK) and nonce from IKM
  // RFC 8188: for aes128gcm, info is just "Content-Encoding: <type>\0" — no keys
  const cekInfo = buildCekInfo('aes128gcm');
  const nonceInfo = buildCekInfo('nonce');
  const cek = await hkdf(salt, ikm, cekInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // 9. Pad plaintext per RFC 8188: plaintext || 0x02 (delimiter) || padding
  // Minimum padding: just the delimiter byte
  const padded = concatUint8(plaintext, new Uint8Array([2]));

  // 10. AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      aesKey, padded
    )
  );

  // 11. Build RFC 8188 aes128gcm content encoding binary:
  // salt (16) || rs (4, big-endian uint32) || idlen (1) || keyid (65) || ciphertext
  const rs = 4096; // record size
  const rsBuf = new Uint8Array(4);
  new DataView(rsBuf.buffer).setUint32(0, rs, false);

  const idlen = new Uint8Array([serverPublicKey.length]); // 65

  const ciphertext = concatUint8(salt, rsBuf, idlen, serverPublicKey, encrypted);

  return { ciphertext, serverPublicKey, salt };
}

// Send encrypted push notification with RFC 8030 Urgency + Topic headers
async function sendPush(sub: Subscription, payload: string, env: Env, urgency: string = 'normal', topic?: string): Promise<boolean> {
  try {
    const url = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    // VAPID JWT for authorization
    const jwt = await createJWT(audience, env.VAPID_SUBJECT, env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY);

    // RFC 8291: encrypt payload using subscriber's p256dh + auth keys
    const plaintext = new TextEncoder().encode(payload);
    const { ciphertext } = await encryptPayload(plaintext, sub.keys.p256dh, sub.keys.auth);

    const headers: Record<string, string> = {
      'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Content-Length': String(ciphertext.length),
      'TTL': '86400',
      'Urgency': urgency,
    };
    if (topic) headers['Topic'] = topic;

    const response = await fetch(sub.endpoint, {
      method: 'POST',
      headers,
      body: ciphertext,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`Push failed: ${response.status} ${response.statusText} — ${body}`);
    }
    if (response.status === 410 || response.status === 404) {
      return false; // Subscription expired — should be removed
    }
    return response.ok;
  } catch (e: any) {
    console.error(`Push exception: ${e?.message || e}`);
    return false;
  }
}

// ── Notification payloads ──

function newIssuePayload(issue: { id: string; headline: string; opinionShift: number; finalScore: number; context: string }, platform: Subscription['platform'] = 'unknown'): string {
  const base: Record<string, unknown> = {
    title: issue.headline,
    body: issue.context,
    icon: '/icons/icon-192.png',
    tag: `issue-${issue.id}`,
    data: { url: `/issue/${issue.id}?from=notification`, type: 'new-issue' },
  };

  if (platform === 'chrome' || platform === 'unknown') {
    // Chrome: full payload with image, actions, badge
    base.badge = '/icons/badge-96.png';
    base.image = `/og/issue-${issue.id}.png?v=${Date.now()}`;
    base.actions = [
      { action: 'read', title: 'Read' },
      { action: 'dismiss', title: 'Dismiss' },
    ];
  } else if (platform === 'firefox') {
    // Firefox: no image (not rendered), keep actions
    base.badge = '/icons/badge-96.png';
    base.actions = [
      { action: 'read', title: 'Read' },
      { action: 'dismiss', title: 'Dismiss' },
    ];
  }
  // Safari: no actions, no image, no badge (unsupported)

  return JSON.stringify(base);
}

function digestPayload(topHeadline: string, remaining: number): string {
  const body = remaining > 0 ? `${topHeadline} + ${remaining} more` : topHeadline;
  return JSON.stringify({
    title: 'This Week on The Fourth Angle',
    body,
    icon: '/icons/icon-192.png',
    tag: 'weekly-digest',
    data: { url: '/?from=digest', type: 'digest' },
  });
}

function reEngagementPayload(topHeadline: string, remaining: number): string {
  const body = remaining > 0 ? `${topHeadline} + ${remaining} more since your last visit` : topHeadline;
  return JSON.stringify({
    title: 'You Missed This',
    body,
    icon: '/icons/icon-192.png',
    tag: 're-engagement',
    data: { url: '/?from=re-engage', type: 're-engagement' },
  });
}

// ── API Handlers ──

async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  try {
    if (!checkRateLimit(request)) {
      return json({ error: 'Too many requests' }, 429, request);
    }

    const body = await request.json() as { endpoint: string; keys: { p256dh: string; auth: string } };
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return json({ error: 'Invalid subscription' }, 400, request);
    }

    // Validate endpoint is a valid HTTPS URL pointing to a known push service
    try {
      const epUrl = new URL(body.endpoint);
      if (epUrl.protocol !== 'https:') {
        return json({ error: 'Invalid endpoint' }, 400, request);
      }
    } catch {
      return json({ error: 'Invalid endpoint' }, 400, request);
    }

    const sub: Subscription = {
      endpoint: body.endpoint,
      keys: body.keys,
      subscribedAt: Date.now(),
      lastSeen: Date.now(),
      platform: detectPlatform(body.endpoint),
    };

    const key = `sub:${Date.now()}_${body.endpoint.slice(-20).replace(/[^a-zA-Z0-9]/g, '')}`;
    await env.SUBS.put(key, JSON.stringify(sub));

    return json({ success: true }, 200, request);
  } catch {
    return json({ error: 'Subscribe failed' }, 500, request);
  }
}

async function handleUnsubscribe(request: Request, env: Env): Promise<Response> {
  try {
    if (!checkRateLimit(request)) {
      return json({ error: 'Too many requests' }, 429, request);
    }

    const body = await request.json() as { endpoint: string };
    if (!body.endpoint) return json({ error: 'Missing endpoint' }, 400, request);

    const subs = await getAllSubscriptions(env);
    for (const { key, sub } of subs) {
      if (sub.endpoint === body.endpoint) {
        await env.SUBS.delete(key);
        break;
      }
    }
    return json({ success: true }, 200, request);
  } catch {
    return json({ error: 'Unsubscribe failed' }, 500, request);
  }
}

async function handleHeartbeat(request: Request, env: Env): Promise<Response> {
  try {
    if (!checkRateLimit(request)) {
      return json({ error: 'Too many requests' }, 429, request);
    }

    const body = await request.json() as { endpoint: string };
    if (!body.endpoint) return json({ error: 'Missing endpoint' }, 400, request);

    const subs = await getAllSubscriptions(env);
    for (const { key, sub } of subs) {
      if (sub.endpoint === body.endpoint) {
        sub.lastSeen = Date.now();
        await env.SUBS.put(key, JSON.stringify(sub));
        break;
      }
    }
    return json({ success: true }, 200, request);
  } catch {
    return json({ error: 'Heartbeat failed' }, 500, request);
  }
}

// ── CRON Handlers ──

async function getAllSubscriptions(env: Env): Promise<Array<{ key: string; sub: Subscription }>> {
  const subs: Array<{ key: string; sub: Subscription }> = [];
  let cursor: string | undefined;
  do {
    const list = await env.SUBS.list({ prefix: 'sub:', cursor });
    for (const k of list.keys) {
      const val = await env.SUBS.get(k.name);
      if (val) subs.push({ key: k.name, sub: JSON.parse(val) });
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  return subs;
}

async function checkNewIssues(env: Env): Promise<void> {
  // Fetch current issue feed
  const resp = await fetch(`${env.SITE_URL}/issues-feed.json`);
  if (!resp.ok) return;
  const data = await resp.json();
  const feed = (Array.isArray(data) ? data : data?.issues || []) as IssueFeed;
  if (!Array.isArray(feed) || feed.length === 0) return;

  // Get last known issue count
  const lastCount = parseInt(await env.SUBS.get('meta:issueCount') || '0', 10);
  const currentCount = feed.length;

  if (currentCount <= lastCount) {
    await env.SUBS.put('meta:issueCount', String(currentCount));
    return; // No new issues
  }

  // New issues found — pick the highest opinion shift (most impactful)
  const newIssues = feed.slice(0, currentCount - lastCount);
  const subs = await getAllSubscriptions(env);

  // Send notification for the highest-impact new issue (avoid spam)
  if (newIssues.length > 0 && subs.length > 0) {
    const topIssue = newIssues.reduce((a, b) => a.opinionShift > b.opinionShift ? a : b);
    const expired: string[] = [];

    for (const { key, sub } of subs) {
      const payload = newIssuePayload(topIssue, sub.platform || 'unknown');
      const ok = await sendPush(sub, payload, env, 'normal', `issue-${topIssue.id}`);
      if (!ok) expired.push(key);
    }

    // Clean up expired subscriptions
    for (const key of expired) {
      await env.SUBS.delete(key);
    }
  }

  await env.SUBS.put('meta:issueCount', String(currentCount));
}

async function sendWeeklyDigest(env: Env): Promise<void> {
  const subs = await getAllSubscriptions(env);
  if (subs.length === 0) return; // No subscribers, skip fetch
  const resp = await fetch(`${env.SITE_URL}/issues-feed.json`);
  if (!resp.ok) return;
  const data = await resp.json();
  const feed = (Array.isArray(data) ? data : data?.issues || []) as IssueFeed;
  if (!Array.isArray(feed) || feed.length === 0) return;

  // Recent issues this week (approximation: use last 7 issues)
  const recentIssues = feed.slice(0, 7);
  if (recentIssues.length === 0) return;

  const topIssue = recentIssues.reduce((a, b) => a.opinionShift > b.opinionShift ? a : b);
  const payload = digestPayload(topIssue.headline, recentIssues.length - 1);

  for (const { key, sub } of subs) {
    await sendPush(sub, payload, env, 'low', 'weekly-digest');
  }
}

async function checkReEngagement(env: Env): Promise<void> {
  const subs = await getAllSubscriptions(env);
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const resp = await fetch(`${env.SITE_URL}/issues-feed.json`);
  if (!resp.ok) return;
  const data = await resp.json();
  const feed = (Array.isArray(data) ? data : data?.issues || []) as IssueFeed;
  if (!Array.isArray(feed) || feed.length === 0) return;

  const topIssue = feed.reduce((a, b) => a.opinionShift > b.opinionShift ? a : b);

  for (const { key, sub } of subs) {
    if (now - sub.lastSeen > fourteenDays) {
      // Check we haven't already sent re-engagement recently
      const lastReEngage = parseInt(await env.SUBS.get(`reengaged:${key}`) || '0', 10);
      if (now - lastReEngage < 30 * 24 * 60 * 60 * 1000) continue; // Max once per 30 days

      const payload = reEngagementPayload(topIssue.headline, feed.length - 1);
      await sendPush(sub, payload, env, 'low', 're-engagement');
      await env.SUBS.put(`reengaged:${key}`, String(now));
    }
  }
}

// ── Main Export ──

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: getCorsHeaders(request) });
    }

    // Origin validation for POST requests
    if (request.method === 'POST') {
      const origin = request.headers.get('Origin') || '';
      if (!isAllowedOrigin(origin)) {
        return json({ error: 'Forbidden' }, 403, request);
      }
      if (url.pathname === '/api/subscribe') return handleSubscribe(request, env);
      if (url.pathname === '/api/unsubscribe') return handleUnsubscribe(request, env);
      if (url.pathname === '/api/heartbeat') return handleHeartbeat(request, env);
    }

    // Health check
    if (url.pathname === '/api/health') {
      return json({ status: 'ok' }, 200, request);
    }

    // Manual trigger — fires the new-issue check immediately
    if (url.pathname === '/api/trigger-check' && request.method === 'POST') {
      try {
        await checkNewIssues(env);
        return json({ triggered: true }, 200, request);
      } catch {
        return json({ error: 'Check failed' }, 500, request);
      }
    }

    return json({ error: 'Not found' }, 404, request);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      const hour = new Date(event.scheduledTime).getUTCHours();
      const day = new Date(event.scheduledTime).getUTCDay();

      // Saturday 1am UTC = Saturday 9am MYT → weekly digest
      if (day === 6 && hour === 1) {
        ctx.waitUntil(sendWeeklyDigest(env));
        return;
      }

      // Tuesday/Thursday midnight UTC = 8am MYT → new issue alert
      if ((day === 2 || day === 4) && hour === 0) {
        ctx.waitUntil(checkNewIssues(env));
        return;
      }

      // Daily 1am UTC = 9am MYT → re-engagement check (max once per 30 days per user)
      if (hour === 1) {
        ctx.waitUntil(checkReEngagement(env));
        return;
      }
    } catch (e: any) {
      console.error('Scheduled task failed:', e?.message || e);
    }
  },
};
