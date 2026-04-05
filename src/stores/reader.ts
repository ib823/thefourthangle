import { persistentMap, persistentAtom } from '@nanostores/persistent';

export interface ReadState {
  state: 'started' | 'completed';
  progress: number;
}

export const readIssues = persistentMap<Record<string, string>>('tfa-read:', {});

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

export function markCompleted(id: string, cardCount: number = 7) {
  readIssues.setKey(id, JSON.stringify({ state: 'completed', progress: cardCount }));
}

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

export function removeReaction(issueId: string, cardIndex: number): void {
  const r = getReactions();
  const nextCards = (r[issueId] ?? []).filter((index) => index !== cardIndex);
  if (nextCards.length > 0) {
    r[issueId] = nextCards;
  } else {
    delete r[issueId];
  }
  reactions.set(JSON.stringify(r));
}

export function toggleReaction(issueId: string, cardIndex: number): boolean {
  if (hasReacted(issueId, cardIndex)) {
    removeReaction(issueId, cardIndex);
    return false;
  }
  addReaction(issueId, cardIndex);
  return true;
}

export function countHighlights(reactionMap: Record<string, number[]> = getReactions()): number {
  let total = 0;
  for (const cards of Object.values(reactionMap)) {
    total += cards?.length ?? 0;
  }
  return total;
}

// Position persistence — resume reading
const savedPosition = persistentAtom<string>('tfa-pos', '');

export function savePosition(feedIssueId: string, cardIndex: number) {
  savedPosition.set(JSON.stringify({ feedIssueId, cardIndex, ts: Date.now() }));
}

export function getSavedPosition(): { feedIssueId: string; cardIndex: number; ts: number } | null {
  try {
    const raw = savedPosition.get();
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (Date.now() - p.ts > 24 * 60 * 60 * 1000) return null; // Expire after 24h
    return p;
  } catch { return null; }
}

export function clearPosition() {
  savedPosition.set('');
}

// Minimal shape for affinity scoring — compatible with both Issue and IssueSummary
interface AffinityIssue {
  id: string;
  opinionShift: number;
  cards: Array<{ t: string; lens?: string }>;
}

// Affinity-based feed personalization
let _affinityCache: { key: string; result: Record<string, number> } | null = null;

export function computeAffinity(readMap: Record<string, string>, reactionMap: Record<string, number[]>, issues: AffinityIssue[]): Record<string, number> {
  // G2: Memoize — only recompute if inputs changed
  const key = JSON.stringify(readMap) + JSON.stringify(reactionMap);
  if (_affinityCache?.key === key) return _affinityCache.result;

  const lensScores: Record<string, number> = {};
  for (const issue of issues) {
    const read = readMap[issue.id];
    if (!read) continue;
    const completed = read === 'true' || (() => { try { return JSON.parse(read).state === 'completed'; } catch { return false; } })();
    const reacted = reactionMap[issue.id]?.length ?? 0;
    const lenses = issue.cards.filter(c => c.lens).map(c => c.lens!);
    for (const lens of lenses) {
      if (!lensScores[lens]) lensScores[lens] = 0;
      lensScores[lens] += completed ? 1 : 0.3;
      lensScores[lens] += reacted * 0.5;
    }
  }

  _affinityCache = { key, result: lensScores };
  return lensScores;
}

export function scoreIssue(issue: AffinityIssue, affinity: Record<string, number>): number {
  let score = 0;
  const lenses = issue.cards.filter(c => c.lens).map(c => c.lens!);
  for (const lens of lenses) score += affinity[lens] || 0;
  score += issue.opinionShift * 0.003;
  return score;
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
