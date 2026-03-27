/**
 * Lazy data loader for issues.
 * Feed summaries are fetched once on app init.
 * Full issue data is fetched on demand when the reader opens.
 */
import type { Issue } from '../data/issues';

/** Feed summary — same as Issue but cards lack big/sub text */
export interface IssueSummary {
  id: string;
  opinionShift: number;
  status: "new" | "updated" | null;
  edition: number;
  headline: string;
  context: string;
  stageScores?: { pa: number; ba: number; fc: number; af: number; ct: number; sr: number };
  finalScore?: number;
  cards: Array<{ t: string; lens?: string }>;
}

// --- Feed summaries cache ---
let feedCache: IssueSummary[] | null = null;
let feedPromise: Promise<IssueSummary[]> | null = null;

export function loadFeedIssues(): Promise<IssueSummary[]> {
  if (feedCache) return Promise.resolve(feedCache);
  if (feedPromise) return feedPromise;

  feedPromise = fetch('/issues-feed.json')
    .then(res => res.json())
    .then((data: IssueSummary[]) => {
      feedCache = data;
      return data;
    });

  return feedPromise;
}

/** Synchronous access after load — returns null if not yet loaded */
export function getFeedIssues(): IssueSummary[] | null {
  return feedCache;
}

// --- Full issue cache ---
const issueCache = new Map<string, Issue>();
const issuePromises = new Map<string, Promise<Issue | null>>();

export function loadFullIssue(id: string): Promise<Issue | null> {
  const cached = issueCache.get(id);
  if (cached) return Promise.resolve(cached);

  const existing = issuePromises.get(id);
  if (existing) return existing;

  const promise = fetch(`/issues/${id}.json`)
    .then(res => {
      if (!res.ok) return null;
      return res.json();
    })
    .then((data: Issue | null) => {
      if (data) issueCache.set(id, data);
      return data;
    })
    .catch(() => null);

  issuePromises.set(id, promise);
  return promise;
}

/** Synchronous access — returns cached full issue or null */
export function getFullIssue(id: string): Issue | null {
  return issueCache.get(id) ?? null;
}

// --- Fact graph cache ---
interface FactConnection {
  id: string;
  weight: number;
  sharedEntities: string[];
}

interface FactGraph {
  connections: Record<string, FactConnection[]>;
  connectionCounts: Record<string, number>;
  entities: Record<string, { name: string; type: string; issues: string[]; count: number }>;
  meta: { generatedAt: string; issueCount: number; entityCount: number; connectedIssues: number; totalEdges: number };
}

let graphCache: FactGraph | null = null;
let graphPromise: Promise<FactGraph | null> | null = null;

export function loadFactGraph(): Promise<FactGraph | null> {
  if (graphCache) return Promise.resolve(graphCache);
  if (graphPromise) return graphPromise;

  graphPromise = fetch('/fact-graph.json')
    .then(res => {
      if (!res.ok) return null;
      return res.json();
    })
    .then((data: FactGraph | null) => {
      if (data) graphCache = data;
      return data;
    })
    .catch(() => null);

  return graphPromise;
}

/** Get connections for a specific issue. Returns empty array if graph not loaded or no connections. */
export function getConnections(issueId: string): FactConnection[] {
  return graphCache?.connections[issueId] ?? [];
}

/** Get connection count for feed display. Returns 0 if graph not loaded. */
export function getConnectionCount(issueId: string): number {
  return graphCache?.connectionCounts[issueId] ?? 0;
}

/** Check if fact graph is loaded */
export function isFactGraphLoaded(): boolean {
  return graphCache !== null;
}
