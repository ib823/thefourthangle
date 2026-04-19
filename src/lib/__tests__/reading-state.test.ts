import { describe, it, expect, beforeEach } from 'vitest';
import {
  LEGACY_KEYS,
  V1_KEYS,
  MIGRATION_FLAG,
  migrate,
  getReadState,
  setReadState,
  listReadStates,
  getPosition,
  setPosition,
  getReactions,
  setReactions,
  getDeviceId,
  ensureDeviceId,
  getAngleCode,
  getLastSync,
  dismissals,
  exportAll,
  importAll,
  clearAll,
  isStorageAvailable,
  subscribe,
  __setBackendForTesting,
  __resetForTesting,
  type StorageBackend,
  type ReadState,
  type SavedPosition,
} from '../reading-state';

class MapBackend implements StorageBackend {
  store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
  keys() { return Array.from(this.store.keys()); }
}

beforeEach(() => {
  __resetForTesting();
});

describe('migration — legacy tfa-* → tfa:v1:*', () => {
  it('migrates all 13 scalar keys when present', () => {
    const b = new MapBackend();
    __setBackendForTesting(b);
    b.setItem(LEGACY_KEYS.REACTIONS, '{"0001":[0,1]}');
    b.setItem(LEGACY_KEYS.POSITION, '{"feedIssueId":"0001","cardIndex":2,"ts":1}');
    b.setItem(LEGACY_KEYS.NOTIFICATIONS, '[]');
    b.setItem(LEGACY_KEYS.ANGLE_CODE, 'ABC123');
    b.setItem(LEGACY_KEYS.LAST_SYNC, '1700000000000');
    b.setItem(LEGACY_KEYS.DEVICE_ID, 'd_abc123');
    b.setItem(LEGACY_KEYS.INSTALL_DISMISSED, '1700000000000');
    b.setItem(LEGACY_KEYS.SYNC_BANNER_DISMISSED, '1');
    b.setItem(LEGACY_KEYS.WELCOME_DISMISSED, '1');
    b.setItem(LEGACY_KEYS.PUSH_SUBSCRIBED, 'true');
    b.setItem(LEGACY_KEYS.PUSH_ENDPOINT, 'https://fcm.example/abc');
    b.setItem(LEGACY_KEYS.PUSH_DISMISSED, '1700000000000');
    b.setItem(LEGACY_KEYS.SYNC_PROMPT_DISMISSED, '1');

    const result = migrate();

    expect(result.alreadyMigrated).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.migratedKeys).toHaveLength(13);

    // All legacy keys gone
    for (const legacy of Object.values(LEGACY_KEYS)) {
      if (legacy === LEGACY_KEYS.READ_PREFIX) continue;
      expect(b.getItem(legacy)).toBeNull();
    }

    // All v1 keys populated
    expect(b.getItem(V1_KEYS.REACTIONS)).toBe('{"0001":[0,1]}');
    expect(b.getItem(V1_KEYS.POSITION)).toBe('{"feedIssueId":"0001","cardIndex":2,"ts":1}');
    expect(b.getItem(V1_KEYS.ANGLE_CODE)).toBe('ABC123');
    expect(b.getItem(V1_KEYS.DEVICE_ID)).toBe('d_abc123');

    // Migration flag set
    expect(b.getItem(MIGRATION_FLAG)).toBe('1');
  });

  it('migrates tfa-read:* prefix keys to tfa:v1:read:*', () => {
    const b = new MapBackend();
    __setBackendForTesting(b);
    b.setItem('tfa-read:0001', JSON.stringify({ state: 'completed', progress: 6 }));
    b.setItem('tfa-read:0002', JSON.stringify({ state: 'started', progress: 3 }));
    b.setItem('tfa-read:0003', 'true'); // legacy bare-string form

    migrate();

    expect(b.getItem('tfa-read:0001')).toBeNull();
    expect(b.getItem('tfa-read:0002')).toBeNull();
    expect(b.getItem('tfa-read:0003')).toBeNull();
    expect(b.getItem('tfa:v1:read:0001')).toBe(JSON.stringify({ state: 'completed', progress: 6 }));
    expect(b.getItem('tfa:v1:read:0002')).toBe(JSON.stringify({ state: 'started', progress: 3 }));
    expect(b.getItem('tfa:v1:read:0003')).toBe('true');
  });

  it('is idempotent — running twice produces the same state', () => {
    const b = new MapBackend();
    __setBackendForTesting(b);
    b.setItem(LEGACY_KEYS.ANGLE_CODE, 'CODE1');
    b.setItem('tfa-read:0001', JSON.stringify({ state: 'completed', progress: 6 }));

    const first = migrate();
    expect(first.alreadyMigrated).toBe(false);
    expect(first.migratedKeys.length).toBe(2);

    const second = migrate();
    expect(second.alreadyMigrated).toBe(true);
    expect(second.migratedKeys.length).toBe(0);

    expect(b.getItem(V1_KEYS.ANGLE_CODE)).toBe('CODE1');
    expect(b.getItem('tfa:v1:read:0001')).toBe(JSON.stringify({ state: 'completed', progress: 6 }));
  });

  it('does not overwrite existing v1 values — v1 wins', () => {
    const b = new MapBackend();
    __setBackendForTesting(b);
    b.setItem(LEGACY_KEYS.ANGLE_CODE, 'LEGACY_CODE');
    b.setItem(V1_KEYS.ANGLE_CODE, 'V1_CODE');

    migrate();

    expect(b.getItem(V1_KEYS.ANGLE_CODE)).toBe('V1_CODE');
    expect(b.getItem(LEGACY_KEYS.ANGLE_CODE)).toBeNull();
  });

  it('is safe with an empty storage', () => {
    const b = new MapBackend();
    __setBackendForTesting(b);
    const result = migrate();
    expect(result.errors).toEqual([]);
    expect(result.migratedKeys).toEqual([]);
    expect(b.getItem(MIGRATION_FLAG)).toBe('1');
  });

  it('re-runs after clearAll', () => {
    const b = new MapBackend();
    __setBackendForTesting(b);
    b.setItem(LEGACY_KEYS.ANGLE_CODE, 'CODE1');
    migrate();
    expect(b.getItem(V1_KEYS.ANGLE_CODE)).toBe('CODE1');

    clearAll();
    expect(b.getItem(V1_KEYS.ANGLE_CODE)).toBeNull();
    expect(b.getItem(MIGRATION_FLAG)).toBeNull();

    b.setItem(LEGACY_KEYS.ANGLE_CODE, 'CODE2');
    migrate();
    expect(b.getItem(V1_KEYS.ANGLE_CODE)).toBe('CODE2');
  });
});

describe('typed accessors', () => {
  it('getReadState returns null for missing, parsed for present', () => {
    const b = new MapBackend();
    __setBackendForTesting(b);
    expect(getReadState('0001')).toBeNull();
    setReadState('0001', { state: 'started', progress: 3 });
    expect(getReadState('0001')).toEqual({ state: 'started', progress: 3 });
  });

  it('getReadState handles legacy "true" as completed+6', () => {
    const b = new MapBackend();
    __setBackendForTesting(b);
    b.setItem(V1_KEYS.READ_PREFIX + '0001', 'true');
    expect(getReadState('0001')).toEqual({ state: 'completed', progress: 6 });
  });

  it('getReadState rejects malformed JSON', () => {
    const b = new MapBackend();
    __setBackendForTesting(b);
    b.setItem(V1_KEYS.READ_PREFIX + '0001', '{"not":"valid"}');
    expect(getReadState('0001')).toBeNull();
  });

  it('listReadStates returns all v1 read keys', () => {
    const b = new MapBackend();
    __setBackendForTesting(b);
    setReadState('0001', { state: 'completed', progress: 6 });
    setReadState('0002', { state: 'started', progress: 3 });
    const all = listReadStates();
    expect(Object.keys(all).sort()).toEqual(['0001', '0002']);
    expect(all['0001']).toEqual({ state: 'completed', progress: 6 });
  });

  it('getPosition / setPosition round-trip', () => {
    __setBackendForTesting(new MapBackend());
    const pos: SavedPosition = { feedIssueId: '0001', cardIndex: 2, ts: 123 };
    setPosition(pos);
    expect(getPosition()).toEqual(pos);
  });

  it('getReactions returns {} when missing', () => {
    __setBackendForTesting(new MapBackend());
    expect(getReactions()).toEqual({});
  });

  it('ensureDeviceId creates once, returns same value', () => {
    __setBackendForTesting(new MapBackend());
    const id1 = ensureDeviceId();
    expect(id1).toMatch(/^d_[0-9a-f]{16}$/);
    const id2 = ensureDeviceId();
    expect(id2).toBe(id1);
  });

  it('dismissals flags default to false, true after dismiss', () => {
    __setBackendForTesting(new MapBackend());
    expect(dismissals.isWelcomeDismissed()).toBe(false);
    dismissals.dismissWelcome();
    expect(dismissals.isWelcomeDismissed()).toBe(true);
  });
});

describe('storage-blocked fallback', () => {
  it('isStorageAvailable reports false when backend is in-memory', () => {
    __setBackendForTesting(new MapBackend(), false);
    expect(isStorageAvailable()).toBe(false);
  });

  it('reads and writes still work in in-memory mode', () => {
    __setBackendForTesting(new MapBackend(), false);
    setReadState('0001', { state: 'started', progress: 2 });
    expect(getReadState('0001')).toEqual({ state: 'started', progress: 2 });
  });
});

describe('export / import', () => {
  it('exports then imports round-trips state', () => {
    const b1 = new MapBackend();
    __setBackendForTesting(b1);
    ensureDeviceId();
    setReadState('0001', { state: 'completed', progress: 6 });
    setReadState('0002', { state: 'started', progress: 3 });
    setPosition({ feedIssueId: '0002', cardIndex: 3, ts: 12345 });
    setReactions({ '0001': [0, 1, 2] });
    dismissals.dismissWelcome();

    const exported = exportAll();
    expect(exported.version).toBe(1);
    expect(exported.deviceId).toMatch(/^d_/);
    expect(exported.reads['0001']).toEqual({ state: 'completed', progress: 6 });
    expect(exported.position).toEqual({ feedIssueId: '0002', cardIndex: 3, ts: 12345 });

    // Import into a fresh backend
    const b2 = new MapBackend();
    __setBackendForTesting(b2);
    const result = importAll(exported);
    expect(result.errors).toEqual([]);
    expect(result.imported).toBeGreaterThan(0);
    expect(getReadState('0001')).toEqual({ state: 'completed', progress: 6 });
    expect(getReadState('0002')).toEqual({ state: 'started', progress: 3 });
    expect(getPosition()).toEqual({ feedIssueId: '0002', cardIndex: 3, ts: 12345 });
    expect(getReactions()).toEqual({ '0001': [0, 1, 2] });
    expect(dismissals.isWelcomeDismissed()).toBe(true);
  });

  it('import merges reads — higher progress wins', () => {
    __setBackendForTesting(new MapBackend());
    setReadState('0001', { state: 'started', progress: 2 });

    importAll({
      version: 1,
      exportedAt: '2026-04-18T00:00:00Z',
      deviceId: null,
      reads: { '0001': { state: 'started', progress: 5 } },
      reactions: {},
      position: null,
      angleCode: null,
      lastSync: 0,
      notifications: null,
      dismissals: {},
    });

    expect(getReadState('0001')).toEqual({ state: 'started', progress: 5 });
  });

  it('import merges reads — completed beats started', () => {
    __setBackendForTesting(new MapBackend());
    setReadState('0001', { state: 'started', progress: 5 });

    importAll({
      version: 1,
      exportedAt: '2026-04-18T00:00:00Z',
      deviceId: null,
      reads: { '0001': { state: 'completed', progress: 6 } },
      reactions: {},
      position: null,
      angleCode: null,
      lastSync: 0,
      notifications: null,
      dismissals: {},
    });

    expect(getReadState('0001')).toEqual({ state: 'completed', progress: 6 });
  });

  it('import preserves local state when remote is older', () => {
    __setBackendForTesting(new MapBackend());
    setReadState('0001', { state: 'completed', progress: 6 });

    importAll({
      version: 1,
      exportedAt: '2026-04-18T00:00:00Z',
      deviceId: null,
      reads: { '0001': { state: 'started', progress: 2 } },
      reactions: {},
      position: null,
      angleCode: null,
      lastSync: 0,
      notifications: null,
      dismissals: {},
    });

    expect(getReadState('0001')).toEqual({ state: 'completed', progress: 6 });
  });

  it('import rejects wrong version', () => {
    __setBackendForTesting(new MapBackend());
    const result = importAll({ version: 2 });
    expect(result.errors[0]).toMatch(/version/i);
    expect(result.imported).toBe(0);
  });

  it('import rejects non-object', () => {
    __setBackendForTesting(new MapBackend());
    expect(importAll('nope').errors.length).toBeGreaterThan(0);
    expect(importAll(null).errors.length).toBeGreaterThan(0);
  });

  it('import skips corrupted reads per-entry', () => {
    __setBackendForTesting(new MapBackend());
    const result = importAll({
      version: 1,
      exportedAt: '2026-04-18',
      deviceId: null,
      reads: {
        '0001': { state: 'completed', progress: 6 },
        '0002': { state: 'nope', progress: 99 } as unknown as ReadState,
      },
      reactions: {},
      position: null,
      angleCode: null,
      lastSync: 0,
      notifications: null,
      dismissals: {},
    });
    expect(result.imported).toBeGreaterThan(0);
    expect(result.skipped).toBeGreaterThan(0);
    expect(getReadState('0001')).not.toBeNull();
    expect(getReadState('0002')).toBeNull();
  });
});

describe('subscribe', () => {
  it('fires on writes', () => {
    __setBackendForTesting(new MapBackend());
    let calls = 0;
    const unsub = subscribe(() => { calls++; });
    setReadState('0001', { state: 'started', progress: 1 });
    setReadState('0002', { state: 'completed', progress: 6 });
    expect(calls).toBe(2);
    unsub();
    setReadState('0003', { state: 'started', progress: 1 });
    expect(calls).toBe(2);
  });
});

describe('clearAll', () => {
  it('removes both v1 and legacy keys', () => {
    const b = new MapBackend();
    __setBackendForTesting(b);
    b.setItem(LEGACY_KEYS.ANGLE_CODE, 'LEGACY');
    b.setItem(V1_KEYS.DEVICE_ID, 'd_1234567890abcdef');
    b.setItem('tfa:v1:read:0001', JSON.stringify({ state: 'completed', progress: 6 }));
    b.setItem('tfa-read:0002', JSON.stringify({ state: 'completed', progress: 6 }));
    // An unrelated key should survive
    b.setItem('unrelated', 'ok');

    clearAll();

    expect(b.getItem(LEGACY_KEYS.ANGLE_CODE)).toBeNull();
    expect(b.getItem(V1_KEYS.DEVICE_ID)).toBeNull();
    expect(b.getItem('tfa:v1:read:0001')).toBeNull();
    expect(b.getItem('tfa-read:0002')).toBeNull();
    expect(b.getItem('unrelated')).toBe('ok');
  });
});
