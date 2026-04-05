/**
 * TFA Angle Code Sync Worker
 *
 * Anonymous reading state sync via 6-character Angle Codes.
 * No accounts, no PII, no tracking. Just reading continuity.
 *
 * Endpoints:
 *   POST /api/sync/create   — Generate a new Angle Code
 *   POST /api/sync/push     — Push local state to KV
 *   GET  /api/sync/pull     — Pull remote state from KV
 *   POST /api/sync/merge    — Merge local + remote, return merged
 */

interface Env {
  SYNC: KVNamespace;
  SITE_URL: string;
}

interface SyncState {
  /** Per-issue read state: { [issueId]: { state, progress } } */
  readMap: Record<string, { state: 'started' | 'completed'; progress: number }>;
  /** Per-issue highlighted card indices: { [issueId]: [cardIndex, ...] } */
  reactions: Record<string, number[]>;
  /** Last reading position */
  position: { feedIssueId: string; cardIndex: number; ts: number } | null;
  /** Last sync timestamp (ms) */
  lastSync: number;
}

// --- Token generation ---

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion

function generateToken(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}

async function createUniqueToken(kv: KVNamespace, maxAttempts = 10): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const token = generateToken();
    const existing = await kv.get(`angle:${token}`);
    if (!existing) return token;
  }
  return null;
}

// --- CORS ---

function isAllowedOrigin(origin: string): boolean {
  if (origin === 'https://thefourthangle.pages.dev') return true;
  if (origin === 'http://localhost:4321') return true;
  if (origin === 'http://localhost:5173') return true;
  if (/^https:\/\/[a-f0-9]+\.thefourthangle\.pages\.dev$/.test(origin)) return true;
  return false;
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = isAllowedOrigin(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function corsResponse(request: Request, body: string | null, status: number): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

// --- Rate limiting (in-memory, per-isolate) ---

const RATE_LIMIT = 30;
const RATE_WINDOW = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

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

// SECURITY: Pull endpoint rate-limited more aggressively to prevent Angle Code enumeration
const pullRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const PULL_RATE_LIMIT = 5;
const PULL_RATE_WINDOW = 60_000;

function checkPullRateLimit(request: Request): boolean {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const entry = pullRateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    pullRateLimitMap.set(ip, { count: 1, resetAt: now + PULL_RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= PULL_RATE_LIMIT;
}

// --- Merge logic ---

function mergeStates(local: SyncState, remote: SyncState): SyncState {
  const merged: SyncState = {
    readMap: { ...remote.readMap },
    reactions: { ...remote.reactions },
    position: remote.position,
    lastSync: Date.now(),
  };

  // Read state: take the more-progressed state per issue
  for (const [id, localRead] of Object.entries(local.readMap)) {
    const remoteRead = merged.readMap[id];
    if (!remoteRead) {
      merged.readMap[id] = localRead;
    } else if (localRead.state === 'completed' && remoteRead.state !== 'completed') {
      merged.readMap[id] = localRead;
    } else if (localRead.state === remoteRead.state && localRead.progress > remoteRead.progress) {
      merged.readMap[id] = localRead;
    }
  }

  // Reactions: union of card indices per issue
  for (const [id, localCards] of Object.entries(local.reactions)) {
    const remoteCards = merged.reactions[id] || [];
    const union = [...new Set([...remoteCards, ...localCards])].sort((a, b) => a - b);
    merged.reactions[id] = union;
  }

  // Position: most recent timestamp wins
  if (local.position && (!merged.position || local.position.ts > merged.position.ts)) {
    merged.position = local.position;
  }

  return merged;
}

// --- Validation ---

function isValidToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Z2-9]{6}$/.test(token);
}

function isValidSyncState(data: unknown): data is SyncState {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.readMap !== 'object' || d.readMap === null) return false;
  if (typeof d.reactions !== 'object' || d.reactions === null) return false;
  return true;
}

// KV TTL: 90 days in seconds
const TTL_SECONDS = 90 * 24 * 60 * 60;

// --- Request handler ---

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // CORS check
    const origin = request.headers.get('Origin') || '';
    if (origin && !isAllowedOrigin(origin)) {
      return corsResponse(request, JSON.stringify({ error: 'Forbidden' }), 403);
    }

    // Rate limit
    if (!checkRateLimit(request)) {
      return corsResponse(request, JSON.stringify({ error: 'Rate limited' }), 429);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // POST /api/sync/create — Generate new Angle Code
      if (path === '/api/sync/create' && request.method === 'POST') {
        const token = await createUniqueToken(env.SYNC);
        if (!token) {
          return corsResponse(request, JSON.stringify({ error: 'Could not generate token' }), 500);
        }

        const emptyState: SyncState = {
          readMap: {},
          reactions: {},
          position: null,
          lastSync: Date.now(),
        };

        await env.SYNC.put(`angle:${token}`, JSON.stringify(emptyState), {
          expirationTtl: TTL_SECONDS,
        });

        return corsResponse(request, JSON.stringify({ token }), 201);
      }

      // POST /api/sync/push — Push state
      if (path === '/api/sync/push' && request.method === 'POST') {
        const body = await request.json() as { token?: unknown; state?: unknown };

        if (!isValidToken(body.token)) {
          return corsResponse(request, JSON.stringify({ error: 'Invalid token' }), 400);
        }
        if (!isValidSyncState(body.state)) {
          return corsResponse(request, JSON.stringify({ error: 'Invalid state' }), 400);
        }

        // Verify token exists
        const existing = await env.SYNC.get(`angle:${body.token}`);
        if (!existing) {
          return corsResponse(request, JSON.stringify({ error: 'Token not found' }), 404);
        }

        // Merge with existing remote state
        const remote: SyncState = JSON.parse(existing);
        const merged = mergeStates(body.state as SyncState, remote);

        await env.SYNC.put(`angle:${body.token}`, JSON.stringify(merged), {
          expirationTtl: TTL_SECONDS,
        });

        return corsResponse(request, JSON.stringify({ ok: true, lastSync: merged.lastSync }), 200);
      }

      // GET /api/sync/pull?token=XXXXXX — Pull state
      if (path === '/api/sync/pull' && request.method === 'GET') {
        if (!checkPullRateLimit(request)) {
          return corsResponse(request, JSON.stringify({ error: 'Rate limited', retryAfter: 60 }), 429);
        }

        const token = url.searchParams.get('token');

        // Uniform response for invalid format and not-found to prevent enumeration
        if (!isValidToken(token)) {
          return corsResponse(request, JSON.stringify({ error: 'Invalid or unknown token' }), 404);
        }

        const data = await env.SYNC.get(`angle:${token}`);
        if (!data) {
          return corsResponse(request, JSON.stringify({ error: 'Invalid or unknown token' }), 404);
        }

        // Refresh TTL on read
        await env.SYNC.put(`angle:${token}`, data, {
          expirationTtl: TTL_SECONDS,
        });

        return corsResponse(request, data, 200);
      }

      // POST /api/sync/merge — Merge local + remote, return merged
      if (path === '/api/sync/merge' && request.method === 'POST') {
        const body = await request.json() as { token?: unknown; state?: unknown };

        if (!isValidToken(body.token)) {
          return corsResponse(request, JSON.stringify({ error: 'Invalid token' }), 400);
        }
        if (!isValidSyncState(body.state)) {
          return corsResponse(request, JSON.stringify({ error: 'Invalid state' }), 400);
        }

        const existing = await env.SYNC.get(`angle:${body.token}`);
        if (!existing) {
          return corsResponse(request, JSON.stringify({ error: 'Token not found' }), 404);
        }

        const remote: SyncState = JSON.parse(existing);
        const merged = mergeStates(body.state as SyncState, remote);

        await env.SYNC.put(`angle:${body.token}`, JSON.stringify(merged), {
          expirationTtl: TTL_SECONDS,
        });

        return corsResponse(request, JSON.stringify(merged), 200);
      }

      // Health check
      if (path === '/api/sync/health') {
        return corsResponse(request, JSON.stringify({ status: 'ok' }), 200);
      }

      return corsResponse(request, JSON.stringify({ error: 'Not found' }), 404);
    } catch (err) {
      return corsResponse(request, JSON.stringify({ error: 'Internal error' }), 500);
    }
  },
};
