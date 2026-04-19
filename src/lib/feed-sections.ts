/**
 * Feed section computation.
 *
 * Pure function: `issues` + `readMap` → exactly four sections, in canonical
 * order, always. Empty sections have `count: 0` and `issues: []` — they are
 * never omitted.
 *
 * This invariant is the fix for the "Edge renders differently" report: the
 * sidebar structure must not depend on localStorage state. See
 * docs/cross-browser-parity/brief-v3.md Phase 1.
 *
 * `Today` is not a feed section — it is a separate sibling surface handled
 * elsewhere in the UI. It is always rendered too.
 */
import type { IssueSummary } from './issues-loader';

export type SectionKind = 'continue' | 'new' | 'explore' | 'completed';

/**
 * Canonical section order and labels. Single source of truth: import from here
 * into the sidebar component, the tests, and the docs. Do not re-declare.
 */
export const FEED_SECTIONS = [
  { kind: 'continue',  label: 'Continue Reading' },
  { kind: 'new',       label: 'New This Week' },
  { kind: 'explore',   label: 'Earlier Issues' },
  { kind: 'completed', label: 'Completed' },
] as const satisfies ReadonlyArray<{ kind: SectionKind; label: string }>;

export interface FeedSection {
  kind: SectionKind;
  label: string;
  issues: IssueSummary[];
  count: number;
}

interface ReadState {
  state: 'started' | 'completed';
  progress: number;
}

function parseReadState(raw: string | undefined): ReadState | null {
  if (!raw) return null;
  if (raw === 'true') return { state: 'completed', progress: 6 };
  try { return JSON.parse(raw); } catch { return null; }
}

export type SortMode = 'latest' | 'shift';

export function buildFeedSections(
  issues: IssueSummary[],
  readMap: Record<string, string>,
  now: Date = new Date(),
  sortMode: SortMode = 'latest',
): FeedSection[] {
  const buckets: Record<SectionKind, IssueSummary[]> = {
    continue: [],
    new: [],
    explore: [],
    completed: [],
  };

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);

  for (const issue of issues) {
    const rs = parseReadState(readMap[issue.id]);
    if (rs?.state === 'completed') {
      buckets.completed.push(issue);
    } else if (rs?.state === 'started') {
      buckets.continue.push(issue);
    } else if (issue.sourceDate && issue.sourceDate >= cutoff) {
      buckets.new.push(issue);
    } else {
      buckets.explore.push(issue);
    }
  }

  const sortFn = sortMode === 'shift'
    ? (a: IssueSummary, b: IssueSummary) => b.opinionShift - a.opinionShift
    : (a: IssueSummary, b: IssueSummary) => (b.sourceDate ?? '').localeCompare(a.sourceDate ?? '');

  for (const kind of Object.keys(buckets) as SectionKind[]) {
    buckets[kind].sort(sortFn);
  }

  return FEED_SECTIONS.map(({ kind, label }) => ({
    kind,
    label,
    issues: buckets[kind],
    count: buckets[kind].length,
  }));
}
