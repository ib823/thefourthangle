import { persistentMap, persistentAtom } from '@nanostores/persistent';

export interface ReadState {
  state: 'started' | 'completed';
  progress: number;
}

export const readIssues = persistentMap<Record<string, string>>('tfa-read:', {});
export const hasSeenOpinionExplainer = persistentAtom<string>('tfa-os-seen', 'false');

export function getReadState(id: string): ReadState | null {
  const raw = readIssues.get()[id];
  if (!raw) return null;
  // Backward compat: old store had 'true' as value
  if (raw === 'true') return { state: 'completed', progress: 6 };
  try { return JSON.parse(raw); } catch { return null; }
}

export function markStarted(id: string) {
  const current = getReadState(id);
  if (!current) {
    readIssues.setKey(id, JSON.stringify({ state: 'started', progress: 1 }));
  }
}

export function updateProgress(id: string, progress: number) {
  const current = getReadState(id);
  if (current?.state === 'completed') return;
  readIssues.setKey(id, JSON.stringify({ state: 'started', progress }));
}

export function markCompleted(id: string) {
  readIssues.setKey(id, JSON.stringify({ state: 'completed', progress: 6 }));
}

// Legacy compat
export function markRead(id: string) { markCompleted(id); }

// Reactions — "this insight hit hard"
export const reactions = persistentAtom<string>('tfa-reactions', '{}');

export function getReactions(): Record<string, number[]> {
  try { return JSON.parse(reactions.get()); } catch { return {}; }
}

export function hasReacted(issueId: string, cardIndex: number): boolean {
  const r = getReactions();
  return r[issueId]?.includes(cardIndex) ?? false;
}

export function addReaction(issueId: string, cardIndex: number): void {
  const r = getReactions();
  if (!r[issueId]) r[issueId] = [];
  if (!r[issueId].includes(cardIndex)) {
    r[issueId].push(cardIndex);
    reactions.set(JSON.stringify(r));
  }
}

// Simulated baseline count per card (deterministic from content hash)
export function baselineCount(issueId: string, cardIndex: number): number {
  let h = 0;
  const s = issueId + ':' + cardIndex;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return 5 + (Math.abs(h) % 46); // Range 5-50
}

export function getReadCount(map: Record<string, string>): { completed: number; started: number } {
  let completed = 0;
  let started = 0;
  for (const val of Object.values(map)) {
    if (!val) continue;
    if (val === 'true') { completed++; continue; }
    try {
      const parsed: ReadState = JSON.parse(val);
      if (parsed.state === 'completed') completed++;
      else if (parsed.state === 'started') started++;
    } catch { completed++; }
  }
  return { completed, started };
}
