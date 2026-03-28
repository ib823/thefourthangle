/**
 * TFA Push Notification Worker
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
}

type IssueFeed = Array<{ id: string; headline: string; opinionShift: number; finalScore: number; context: string }>;

// ── CORS — restrict to production origin ──
const ALLOWED_ORIGINS = [
  'https://thefourthangle.pages.dev',
  'http://localhost:4321', // dev only
];

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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

// ── Web Push (RFC 8291 / RFC 8188) ──
// Lightweight push implementation using Web Crypto API

async function importVapidKey(base64url: string): Promise<CryptoKey> {
  const raw = base64urlToUint8Array(base64url);
  return crypto.subtle.importKey('pkcs8', raw, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

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

async function createJWT(audience: string, subject: string, vapidPrivateKey: string, vapidPublicKey: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const headerB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  // Import private key for signing
  const keyData = base64urlToUint8Array(vapidPrivateKey);
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key,
    new TextEncoder().encode(unsigned)
  );

  // Convert DER signature to raw r||s format
  const sigArray = new Uint8Array(sig);
  const sigB64 = uint8ArrayToBase64url(sigArray);

  return `${unsigned}.${sigB64}`;
}

async function sendPush(sub: Subscription, payload: string, env: Env): Promise<boolean> {
  try {
    const url = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const jwt = await createJWT(audience, env.VAPID_SUBJECT, env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY);

    const response = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
      },
      body: payload,
    });

    if (response.status === 410 || response.status === 404) {
      return false; // Subscription expired — should be removed
    }
    return response.ok;
  } catch {
    return false;
  }
}

// ── Notification payloads ──

function newIssuePayload(issue: { id: string; headline: string; opinionShift: number; finalScore: number }): string {
  return JSON.stringify({
    title: issue.headline,
    body: `${issue.opinionShift}% Opinion Shift · Neutrality: ${Math.round(issue.finalScore)}/100 — 10-second read. What every side left out.`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    image: `/og/issue-${issue.id}.png`,
    tag: `issue-${issue.id}`,
    data: { url: `/issue/${issue.id}?from=notification`, type: 'new-issue' },
    actions: [
      { action: 'read', title: 'Read' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  });
}

function digestPayload(count: number, topIssue: { headline: string; opinionShift: number }): string {
  return JSON.stringify({
    title: `Your Weekly Digest — ${count} New Issue${count > 1 ? 's' : ''}`,
    body: `Highest shift this week: ${topIssue.opinionShift}% on "${topIssue.headline.slice(0, 60)}${topIssue.headline.length > 60 ? '...' : ''}"`,
    icon: '/icons/icon-192.png',
    tag: 'weekly-digest',
    data: { url: '/?from=digest', type: 'digest' },
    actions: [{ action: 'read', title: 'Open Digest' }],
  });
}

function reEngagementPayload(count: number): string {
  return JSON.stringify({
    title: `${count} Issue${count > 1 ? 's' : ''} Since Your Last Visit`,
    body: `What every side left out. Catch up on the latest analysis.`,
    icon: '/icons/icon-192.png',
    tag: 're-engagement',
    data: { url: '/?from=re-engage', type: 're-engagement' },
    actions: [{ action: 'read', title: 'Catch Up' }],
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

  // New issues found — the newest are at the start of the array
  const newIssues = feed.slice(0, currentCount - lastCount);
  const subs = await getAllSubscriptions(env);

  // Send notification for the most recent new issue only (avoid spam)
  if (newIssues.length > 0 && subs.length > 0) {
    const payload = newIssuePayload(newIssues[0]);
    const expired: string[] = [];

    for (const { key, sub } of subs) {
      const ok = await sendPush(sub, payload, env);
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

  // Count issues published this week (approximation: use last 7 issues)
  const recentIssues = feed.slice(0, 7);
  if (recentIssues.length === 0) return;

  const topIssue = recentIssues.reduce((a, b) => a.opinionShift > b.opinionShift ? a : b);
  const payload = digestPayload(recentIssues.length, topIssue);

  for (const { key, sub } of subs) {
    await sendPush(sub, payload, env);
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

  for (const { key, sub } of subs) {
    if (now - sub.lastSeen > fourteenDays) {
      // Check we haven't already sent re-engagement recently
      const lastReEngage = parseInt(await env.SUBS.get(`reengaged:${key}`) || '0', 10);
      if (now - lastReEngage < 30 * 24 * 60 * 60 * 1000) continue; // Max once per 30 days

      const payload = reEngagementPayload(feed.length);
      await sendPush(sub, payload, env);
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
      if (!ALLOWED_ORIGINS.includes(origin)) {
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

    return json({ error: 'Not found' }, 404, request);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      const minute = new Date(event.scheduledTime).getUTCMinutes();
      const hour = new Date(event.scheduledTime).getUTCHours();
      const day = new Date(event.scheduledTime).getUTCDay();

      // Monday midnight UTC = Monday 8am MYT → weekly digest
      if (day === 1 && hour === 0 && minute === 0) {
        ctx.waitUntil(sendWeeklyDigest(env));
        return;
      }

      // Daily 1am UTC = 9am MYT → re-engagement check
      if (hour === 1 && minute === 0) {
        ctx.waitUntil(checkReEngagement(env));
        return;
      }

      // Every 15 min → check for new issues
      ctx.waitUntil(checkNewIssues(env));
    } catch (e: any) {
      console.error('Scheduled task failed:', e?.message || e);
    }
  },
};
