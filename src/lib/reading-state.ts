/**
 * reading-state.ts — single read/write interface for all tfa-* localStorage keys.
 *
 * Replaces direct `localStorage.getItem`/`setItem` calls scattered across the
 * codebase. Provides:
 *   - Typed getters/setters for every known key
 *   - Idempotent one-shot migration from legacy `tfa-*` to `tfa:v1:*`
 *   - Storage-blocked fallback to an in-memory Map with event emission
 *   - Export / Import / Clear flows for the Reading Progress panel
 *
 * See docs/cross-browser-parity/brief-v3.md Phase 1 and
 * docs/cross-browser-parity/00-audit.md § C for the 14-key inventory.
 *
 * Scope:
 *   - 14 localStorage keys migrated to `tfa:v1:*` namespace.
 *   - 2 sessionStorage keys (`tfa-cinema-dismissed`, `tfa-sw-build`) are
 *     session-scoped and NOT migrated — they regenerate naturally.
 *   - `tfa-read:<id>` is a prefix covering one physical key per started/completed
 *     issue (~86 today). Migration iterates all matching keys.
 */

// --- Key inventory ---------------------------------------------------------

/**
 * The 14 canonical localStorage keys, in stable order. Each entry maps the
 * legacy key name (pre-2026-04-18) to the v1 namespaced name.
 *
 * `tfa-read:*` is a prefix — handled specially in migrate() because it expands
 * to many physical keys.
 */
export const LEGACY_KEYS = {
  READ_PREFIX:       'tfa-read:',              // prefix → 'tfa:v1:read:'
  REACTIONS:         'tfa-reactions',
  POSITION:          'tfa-pos',
  NOTIFICATIONS:     'tfa-notifications',
  ANGLE_CODE:        'tfa-angle-code',
  LAST_SYNC:         'tfa-last-sync',
  DEVICE_ID:         'tfa-device-id',
  INSTALL_DISMISSED: 'tfa-install-dismissed',
  SYNC_BANNER_DISMISSED: 'tfa-sync-banner-dismissed',
  WELCOME_DISMISSED: 'tfa-welcome-dismissed',
  PUSH_SUBSCRIBED:   'tfa-push-subscribed',
  PUSH_ENDPOINT:     'tfa-push-endpoint',
  PUSH_DISMISSED:    'tfa-push-dismissed',
  SYNC_PROMPT_DISMISSED: 'tfa-sync-prompt-dismissed',
} as const;

export const V1_KEYS = {
  READ_PREFIX:       'tfa:v1:read:',
  REACTIONS:         'tfa:v1:reactions',
  POSITION:          'tfa:v1:pos',
  NOTIFICATIONS:     'tfa:v1:notifications',
  ANGLE_CODE:        'tfa:v1:angle-code',
  LAST_SYNC:         'tfa:v1:last-sync',
  DEVICE_ID:         'tfa:v1:device-id',
  INSTALL_DISMISSED: 'tfa:v1:install-dismissed',
  SYNC_BANNER_DISMISSED: 'tfa:v1:sync-banner-dismissed',
  WELCOME_DISMISSED: 'tfa:v1:welcome-dismissed',
  PUSH_SUBSCRIBED:   'tfa:v1:push-subscribed',
  PUSH_ENDPOINT:     'tfa:v1:push-endpoint',
  PUSH_DISMISSED:    'tfa:v1:push-dismissed',
  SYNC_PROMPT_DISMISSED: 'tfa:v1:sync-prompt-dismissed',
} as const;

export const MIGRATION_FLAG = 'tfa:v1:migrated';

// --- Storage backend -------------------------------------------------------

/**
 * Minimal Storage-shaped API. Either browser localStorage or our in-memory
 * fallback will satisfy it.
 */
export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

class InMemoryStorage implements StorageBackend {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  keys(): string[] {
    return Array.from(this.map.keys());
  }
}

class LocalStorageBackend implements StorageBackend {
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  }
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }
  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
  keys(): string[] {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null) out.push(k);
    }
    return out;
  }
}

// --- Module state ----------------------------------------------------------

let backend: StorageBackend;
let storageAvailable = true;
const listeners = new Set<() => void>();

/**
 * Try to set a probe key; on failure, fall back to in-memory storage.
 * Runs once on first access.
 */
function probeAndSelectBackend(): void {
  if (backend) return;

  const probeKey = '__tfa_probe__';
  try {
    if (typeof localStorage === 'undefined') throw new Error('no localStorage');
    localStorage.setItem(probeKey, '1');
    localStorage.removeItem(probeKey);
    backend = new LocalStorageBackend();
    storageAvailable = true;
  } catch {
    backend = new InMemoryStorage();
    storageAvailable = false;
    emitStorageUnavailable();
  }
}

function emitStorageUnavailable(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('tfa:storage-unavailable'));
  } catch {
    // ignore in non-browser contexts
  }
}

function notify(): void {
  for (const fn of listeners) {
    try { fn(); } catch { /* ignore listener errors */ }
  }
}

export function isStorageAvailable(): boolean {
  probeAndSelectBackend();
  return storageAvailable;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// --- Typed value schemas ---------------------------------------------------

export type ReadState = { state: 'started' | 'completed'; progress: number };
export type SavedPosition = { feedIssueId: string; cardIndex: number; ts: number };
export type ReactionMap = Record<string, number[]>;

function parseJSON<T>(raw: string | null, validate: (v: unknown) => v is T): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return validate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isReadState(v: unknown): v is ReadState {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (o.state === 'started' || o.state === 'completed')
    && typeof o.progress === 'number'
    && o.progress >= 0 && o.progress <= 6;
}

function isSavedPosition(v: unknown): v is SavedPosition {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.feedIssueId === 'string'
    && typeof o.cardIndex === 'number'
    && typeof o.ts === 'number';
}

function isReactionMap(v: unknown): v is ReactionMap {
  if (!v || typeof v !== 'object') return false;
  for (const val of Object.values(v as Record<string, unknown>)) {
    if (!Array.isArray(val)) return false;
    if (!val.every(x => typeof x === 'number')) return false;
  }
  return true;
}

// --- Migration -------------------------------------------------------------

interface MigrationResult {
  migratedKeys: string[];
  errors: Array<{ key: string; error: string }>;
  alreadyMigrated: boolean;
}

/**
 * Idempotent migration from legacy `tfa-*` to `tfa:v1:*`.
 *
 * Contract:
 *  - Runs on module load (via `ensureMigrated()`). Safe to call multiple times.
 *  - For each legacy key with a value: copy to the v1 key. Only if the copy
 *    succeeds is the legacy key deleted. If the v1 key already has a value,
 *    it wins (this is the idempotent-on-rerun property).
 *  - A sentinel key `tfa:v1:migrated` is set once the pass completes, short-
 *    circuiting future calls. If the sentinel is removed (user cleared data,
 *    storage restored), migration runs again safely.
 *  - `tfa-read:*` prefix expands to many keys; each is migrated individually.
 *  - Errors per-key are collected and returned; migration does not abort
 *    on a single corrupt value.
 */
export function migrate(): MigrationResult {
  probeAndSelectBackend();
  const result: MigrationResult = { migratedKeys: [], errors: [], alreadyMigrated: false };

  if (backend.getItem(MIGRATION_FLAG) === '1') {
    result.alreadyMigrated = true;
    return result;
  }

  // Scalar keys
  const scalarPairs: Array<[string, string]> = [
    [LEGACY_KEYS.REACTIONS, V1_KEYS.REACTIONS],
    [LEGACY_KEYS.POSITION, V1_KEYS.POSITION],
    [LEGACY_KEYS.NOTIFICATIONS, V1_KEYS.NOTIFICATIONS],
    [LEGACY_KEYS.ANGLE_CODE, V1_KEYS.ANGLE_CODE],
    [LEGACY_KEYS.LAST_SYNC, V1_KEYS.LAST_SYNC],
    [LEGACY_KEYS.DEVICE_ID, V1_KEYS.DEVICE_ID],
    [LEGACY_KEYS.INSTALL_DISMISSED, V1_KEYS.INSTALL_DISMISSED],
    [LEGACY_KEYS.SYNC_BANNER_DISMISSED, V1_KEYS.SYNC_BANNER_DISMISSED],
    [LEGACY_KEYS.WELCOME_DISMISSED, V1_KEYS.WELCOME_DISMISSED],
    [LEGACY_KEYS.PUSH_SUBSCRIBED, V1_KEYS.PUSH_SUBSCRIBED],
    [LEGACY_KEYS.PUSH_ENDPOINT, V1_KEYS.PUSH_ENDPOINT],
    [LEGACY_KEYS.PUSH_DISMISSED, V1_KEYS.PUSH_DISMISSED],
    [LEGACY_KEYS.SYNC_PROMPT_DISMISSED, V1_KEYS.SYNC_PROMPT_DISMISSED],
  ];

  for (const [legacy, v1] of scalarPairs) {
    try {
      const legacyValue = backend.getItem(legacy);
      if (legacyValue === null) continue;
      const existingV1 = backend.getItem(v1);
      if (existingV1 === null) {
        backend.setItem(v1, legacyValue);
      }
      // Delete legacy key regardless of whether v1 already had a value —
      // the legacy key served its purpose.
      backend.removeItem(legacy);
      result.migratedKeys.push(legacy);
    } catch (e) {
      result.errors.push({ key: legacy, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Prefix keys: tfa-read:* → tfa:v1:read:*
  try {
    const allKeys = backend.keys();
    for (const key of allKeys) {
      if (!key.startsWith(LEGACY_KEYS.READ_PREFIX)) continue;
      const suffix = key.slice(LEGACY_KEYS.READ_PREFIX.length);
      const v1Key = V1_KEYS.READ_PREFIX + suffix;
      try {
        const value = backend.getItem(key);
        if (value === null) continue;
        if (backend.getItem(v1Key) === null) {
          backend.setItem(v1Key, value);
        }
        backend.removeItem(key);
        result.migratedKeys.push(key);
      } catch (e) {
        result.errors.push({ key, error: e instanceof Error ? e.message : String(e) });
      }
    }
  } catch (e) {
    result.errors.push({ key: '(enumeration)', error: e instanceof Error ? e.message : String(e) });
  }

  try {
    backend.setItem(MIGRATION_FLAG, '1');
  } catch (e) {
    result.errors.push({ key: MIGRATION_FLAG, error: e instanceof Error ? e.message : String(e) });
  }

  if (result.migratedKeys.length > 0) notify();
  return result;
}

let migrationRun = false;
function ensureMigrated(): void {
  if (migrationRun) return;
  migrationRun = true;
  migrate();
}

// --- Typed accessors -------------------------------------------------------

export function getReadState(id: string): ReadState | null {
  ensureMigrated();
  const raw = backend.getItem(V1_KEYS.READ_PREFIX + id);
  if (!raw) return null;
  if (raw === 'true') return { state: 'completed', progress: 6 };
  return parseJSON(raw, isReadState);
}

export function setReadState(id: string, state: ReadState): void {
  ensureMigrated();
  backend.setItem(V1_KEYS.READ_PREFIX + id, JSON.stringify(state));
  notify();
}

export function listReadStates(): Record<string, ReadState> {
  ensureMigrated();
  const out: Record<string, ReadState> = {};
  for (const key of backend.keys()) {
    if (!key.startsWith(V1_KEYS.READ_PREFIX)) continue;
    const id = key.slice(V1_KEYS.READ_PREFIX.length);
    const rs = getReadState(id);
    if (rs) out[id] = rs;
  }
  return out;
}

export function getPosition(): SavedPosition | null {
  ensureMigrated();
  return parseJSON(backend.getItem(V1_KEYS.POSITION), isSavedPosition);
}

export function setPosition(pos: SavedPosition): void {
  ensureMigrated();
  backend.setItem(V1_KEYS.POSITION, JSON.stringify(pos));
  notify();
}

export function getReactions(): ReactionMap {
  ensureMigrated();
  const raw = backend.getItem(V1_KEYS.REACTIONS);
  return parseJSON(raw, isReactionMap) ?? {};
}

export function setReactions(r: ReactionMap): void {
  ensureMigrated();
  backend.setItem(V1_KEYS.REACTIONS, JSON.stringify(r));
  notify();
}

export function getDeviceId(): string | null {
  ensureMigrated();
  return backend.getItem(V1_KEYS.DEVICE_ID);
}

export function ensureDeviceId(): string {
  ensureMigrated();
  let id = backend.getItem(V1_KEYS.DEVICE_ID);
  if (id) return id;
  const bytes = new Uint8Array(8);
  (globalThis.crypto ?? (globalThis as { msCrypto?: Crypto }).msCrypto!)
    .getRandomValues(bytes);
  id = 'd_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  backend.setItem(V1_KEYS.DEVICE_ID, id);
  return id;
}

export function getAngleCode(): string | null {
  ensureMigrated();
  return backend.getItem(V1_KEYS.ANGLE_CODE);
}

export function getLastSync(): number {
  ensureMigrated();
  const raw = backend.getItem(V1_KEYS.LAST_SYNC);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

// UI-dismissal flags — small and uniform, one accessor per flag.
function getFlag(key: string): boolean {
  ensureMigrated();
  return backend.getItem(key) === '1' || backend.getItem(key) !== null;
}

function setFlag(key: string): void {
  ensureMigrated();
  backend.setItem(key, '1');
  notify();
}

export const dismissals = {
  isInstallDismissed:      () => backend.getItem(V1_KEYS.INSTALL_DISMISSED) !== null,
  dismissInstall:          () => setFlag(V1_KEYS.INSTALL_DISMISSED),
  isSyncBannerDismissed:   () => getFlag(V1_KEYS.SYNC_BANNER_DISMISSED),
  dismissSyncBanner:       () => setFlag(V1_KEYS.SYNC_BANNER_DISMISSED),
  isWelcomeDismissed:      () => getFlag(V1_KEYS.WELCOME_DISMISSED),
  dismissWelcome:          () => setFlag(V1_KEYS.WELCOME_DISMISSED),
  isPushDismissed:         () => backend.getItem(V1_KEYS.PUSH_DISMISSED) !== null,
  dismissPush:             () => setFlag(V1_KEYS.PUSH_DISMISSED),
  isSyncPromptDismissed:   () => getFlag(V1_KEYS.SYNC_PROMPT_DISMISSED),
  dismissSyncPrompt:       () => setFlag(V1_KEYS.SYNC_PROMPT_DISMISSED),
};

// --- Export / Import -------------------------------------------------------

export interface ExportedState {
  version: 1;
  exportedAt: string;
  deviceId: string | null;
  reads: Record<string, ReadState>;
  reactions: ReactionMap;
  position: SavedPosition | null;
  angleCode: string | null;
  lastSync: number;
  notifications: string | null; // opaque JSON array
  dismissals: Record<string, string | null>;
}

export function exportAll(): ExportedState {
  ensureMigrated();
  const dismissalEntries: Record<string, string | null> = {};
  for (const key of [
    V1_KEYS.INSTALL_DISMISSED,
    V1_KEYS.SYNC_BANNER_DISMISSED,
    V1_KEYS.WELCOME_DISMISSED,
    V1_KEYS.PUSH_SUBSCRIBED,
    V1_KEYS.PUSH_ENDPOINT,
    V1_KEYS.PUSH_DISMISSED,
    V1_KEYS.SYNC_PROMPT_DISMISSED,
  ]) {
    dismissalEntries[key] = backend.getItem(key);
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    deviceId: getDeviceId(),
    reads: listReadStates(),
    reactions: getReactions(),
    position: getPosition(),
    angleCode: getAngleCode(),
    lastSync: getLastSync(),
    notifications: backend.getItem(V1_KEYS.NOTIFICATIONS),
    dismissals: dismissalEntries,
  };
}

export function importAll(data: unknown): { imported: number; skipped: number; errors: string[] } {
  ensureMigrated();
  const errors: string[] = [];
  let imported = 0, skipped = 0;

  if (!data || typeof data !== 'object') {
    errors.push('Invalid export: expected object');
    return { imported, skipped, errors };
  }
  const d = data as Partial<ExportedState>;
  if (d.version !== 1) {
    errors.push(`Unsupported version: ${d.version}`);
    return { imported, skipped, errors };
  }

  // Reads — merge: keep the more-progressed state per issue.
  if (d.reads && typeof d.reads === 'object') {
    for (const [id, rs] of Object.entries(d.reads)) {
      if (!isReadState(rs)) { skipped++; continue; }
      const existing = getReadState(id);
      if (!existing) {
        setReadState(id, rs);
        imported++;
      } else if (existing.state === 'started' && rs.state === 'completed') {
        setReadState(id, rs); imported++;
      } else if (existing.state === rs.state && rs.progress > existing.progress) {
        setReadState(id, rs); imported++;
      } else {
        skipped++;
      }
    }
  }

  // Reactions — union.
  if (isReactionMap(d.reactions)) {
    const current = getReactions();
    const merged: ReactionMap = { ...current };
    for (const [id, cardIndexes] of Object.entries(d.reactions)) {
      const union = new Set([...(merged[id] ?? []), ...cardIndexes]);
      merged[id] = Array.from(union).sort((a, b) => a - b);
    }
    setReactions(merged);
    imported++;
  }

  // Position — latest ts wins.
  if (d.position && isSavedPosition(d.position)) {
    const existing = getPosition();
    if (!existing || d.position.ts > existing.ts) {
      setPosition(d.position);
      imported++;
    } else {
      skipped++;
    }
  }

  // Notifications: opaque; prefer imported if present.
  if (typeof d.notifications === 'string') {
    try {
      JSON.parse(d.notifications);
      backend.setItem(V1_KEYS.NOTIFICATIONS, d.notifications);
      imported++;
    } catch {
      errors.push('notifications: invalid JSON');
    }
  }

  // Dismissals: imported truthiness wins (idempotent; OR semantics).
  if (d.dismissals && typeof d.dismissals === 'object') {
    for (const [key, value] of Object.entries(d.dismissals)) {
      if (value !== null && backend.getItem(key) === null) {
        backend.setItem(key, value);
        imported++;
      }
    }
  }

  notify();
  return { imported, skipped, errors };
}

export function clearAll(): void {
  ensureMigrated();
  for (const key of backend.keys()) {
    if (key.startsWith('tfa:v1:') || key.startsWith('tfa-')) {
      backend.removeItem(key);
    }
  }
  migrationRun = false; // allow migration to re-run on next access
  notify();
}

// --- Testing hooks ---------------------------------------------------------

/**
 * Force a specific backend. For tests only.
 */
export function __setBackendForTesting(b: StorageBackend, available = true): void {
  backend = b;
  storageAvailable = available;
  migrationRun = false;
}

/**
 * Reset internal module state. For tests only.
 */
export function __resetForTesting(): void {
  backend = new InMemoryStorage();
  storageAvailable = true;
  migrationRun = false;
  listeners.clear();
}
