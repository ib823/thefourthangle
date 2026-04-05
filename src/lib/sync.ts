/**
 * Angle Code — anonymous cross-device reading sync.
 *
 * No accounts, no PII, no tracking.
 * A 6-character code carries your reading state across any device.
 */

import { readIssues, getReadState, getReactions, getSavedPosition, reactions, type ReadState } from '../stores/reader';

// --- Config ---

const SYNC_API = 'https://tfa-sync.4thangle.workers.dev';
const DEBOUNCE_MS = 5_000;
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes — pull on refocus after this

// --- Local storage keys ---

const TOKEN_KEY = 'tfa-angle-code';
const LAST_SYNC_KEY = 'tfa-last-sync';
const DEVICE_ID_KEY = 'tfa-device-id';

// --- State ---

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPushTs = 0;
let listeners: Array<() => void> = [];

// --- Token management ---

export function getAngleCode(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setAngleCode(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.toUpperCase().trim());
}

export function clearAngleCode(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
  notifyListeners();
}

export function isLinked(): boolean {
  return !!getAngleCode();
}

export function getLastSyncTime(): number {
  try {
    return parseInt(localStorage.getItem(LAST_SYNC_KEY) || '0', 10);
  } catch { return 0; }
}

function setLastSyncTime(ts: number): void {
  localStorage.setItem(LAST_SYNC_KEY, String(ts));
}

// --- Device ID (random, per-device, for debugging only) ---

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'd_' + crypto.getRandomValues(new Uint8Array(8))
      .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// --- Collect local state into SyncState shape ---

interface SyncState {
  readMap: Record<string, { state: 'started' | 'completed'; progress: number }>;
  reactions: Record<string, number[]>;
  position: { feedIssueId: string; cardIndex: number; ts: number } | null;
  lastSync: number;
}

function collectLocalState(): SyncState {
  // Read the raw nanostores map and parse each value
  const rawMap = readIssues.get();
  const readMap: SyncState['readMap'] = {};
  for (const [id, raw] of Object.entries(rawMap)) {
    if (!raw) continue;
    let parsed: ReadState | null = null;
    if (raw === 'true') {
      parsed = { state: 'completed', progress: 6 };
    } else {
      try { parsed = JSON.parse(raw); } catch { /* skip */ }
    }
    if (parsed) readMap[id] = parsed;
  }

  return {
    readMap,
    reactions: getReactions(),
    position: getSavedPosition(),
    lastSync: Date.now(),
  };
}

// --- Apply remote state to local stores ---

function applyRemoteState(remote: SyncState): void {
  // Merge read states: take the more-progressed per issue
  for (const [id, remoteRead] of Object.entries(remote.readMap)) {
    const localRead = getReadState(id);

    if (!localRead) {
      // Remote has it, local doesn't — adopt it
      readIssues.setKey(id, JSON.stringify(remoteRead));
    } else if (remoteRead.state === 'completed' && localRead.state !== 'completed') {
      readIssues.setKey(id, JSON.stringify(remoteRead));
    } else if (remoteRead.state === localRead.state && remoteRead.progress > localRead.progress) {
      readIssues.setKey(id, JSON.stringify(remoteRead));
    }
  }

  // Merge reactions: union
  const localReactions = getReactions();
  let reactionsChanged = false;
  for (const [id, remoteCards] of Object.entries(remote.reactions)) {
    const localCards = localReactions[id] || [];
    const union = [...new Set([...localCards, ...remoteCards])].sort((a, b) => a - b);
    if (union.length !== localCards.length || union.some((v, i) => v !== localCards[i])) {
      localReactions[id] = union;
      reactionsChanged = true;
    }
  }
  if (reactionsChanged) {
    reactions.set(JSON.stringify(localReactions));
  }

  // Position: only override if remote is newer
  const localPos = getSavedPosition();
  if (remote.position) {
    if (!localPos || remote.position.ts > localPos.ts) {
      localStorage.setItem('tfa-pos', JSON.stringify(remote.position));
    }
  }

  setLastSyncTime(Date.now());
  notifyListeners();
}

// --- API calls ---

export async function createAngleCode(): Promise<string> {
  const res = await fetch(`${SYNC_API}/api/sync/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) throw new Error('Failed to create Angle Code');
  const data = await res.json() as { token: string };
  setAngleCode(data.token);
  notifyListeners();

  // Immediately push current local state
  await pushState();

  return data.token;
}

export async function linkAngleCode(token: string): Promise<boolean> {
  const cleaned = token.toUpperCase().trim().replace(/[^A-Z2-9]/g, '');
  if (cleaned.length !== 6) return false;

  // Verify the token exists by pulling
  const res = await fetch(`${SYNC_API}/api/sync/pull?token=${cleaned}`);
  if (!res.ok) return false;

  setAngleCode(cleaned);
  notifyListeners();

  // Merge remote into local
  const remote = await res.json() as SyncState;
  applyRemoteState(remote);

  // Push merged state back
  await pushState();

  return true;
}

export async function pushState(): Promise<void> {
  const token = getAngleCode();
  if (!token) return;

  const state = collectLocalState();

  try {
    const res = await fetch(`${SYNC_API}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, state }),
    });

    if (res.ok) {
      lastPushTs = Date.now();
      setLastSyncTime(lastPushTs);
    }
  } catch {
    // Offline — will retry on next trigger
  }
}

export async function pullState(): Promise<void> {
  const token = getAngleCode();
  if (!token) return;

  try {
    const res = await fetch(`${SYNC_API}/api/sync/pull?token=${token}`);
    if (!res.ok) return;

    const remote = await res.json() as SyncState;
    applyRemoteState(remote);
  } catch {
    // Offline — will retry on next trigger
  }
}

// --- Debounced push ---

export function schedulePush(): void {
  if (!isLinked()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushState();
  }, DEBOUNCE_MS);
}

// --- Visibility-based sync ---

let visibilityCleanup: (() => void) | null = null;

export function startAutoSync(): void {
  if (visibilityCleanup) return; // Already running

  const onVisibility = () => {
    if (!isLinked()) return;

    if (document.visibilityState === 'visible') {
      // Coming back — pull if stale
      const sinceLastSync = Date.now() - getLastSyncTime();
      if (sinceLastSync > STALE_THRESHOLD_MS) {
        pullState();
      }
    } else {
      // Leaving — push current state
      pushState();
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  visibilityCleanup = () => document.removeEventListener('visibilitychange', onVisibility);
}

export function stopAutoSync(): void {
  visibilityCleanup?.();
  visibilityCleanup = null;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}

// --- Change listeners (for UI updates) ---

export function onSyncChange(fn: () => void): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

function notifyListeners(): void {
  for (const fn of listeners) fn();
}

// --- URL param handling (?sync=XXXXXX) ---

export function checkUrlSync(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const syncParam = params.get('sync');
  if (syncParam && /^[A-Z2-9]{6}$/i.test(syncParam)) {
    // Strip the param from URL without reload
    params.delete('sync');
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params}`
      : window.location.pathname;
    history.replaceState(null, '', newUrl);
    return syncParam.toUpperCase();
  }
  return null;
}
