/**
 * Feed section computation.
 * Pure function: issues + readMap → 4 sections.
 * No side effects, no tracking, no profiling.
 */
import type { IssueSummary } from './issues-loader';

export type SectionKind = 'continue' | 'new' | 'explore' | 'completed';

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

/**
 * Build feed sections from a flat issue list and read state map.
 * Empty sections are omitted.
 */
export type SortMode = 'latest' | 'shift';

export function buildFeedSections(
  issues: IssueSummary[],
  readMap: Record<string, string>,
  now: Date = new Date(),
  sortMode: SortMode = 'latest',
): FeedSection[] {
  const continueReading: IssueSummary[] = [];
  const newThisWeek: IssueSummary[] = [];
  const explore: IssueSummary[] = [];
  const completed: IssueSummary[] = [];

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10); // YYYY-MM-DD

  for (const issue of issues) {
    const rs = parseReadState(readMap[issue.id]);

    if (rs?.state === 'completed') {
      completed.push(issue);
    } else if (rs?.state === 'started') {
      continueReading.push(issue);
    } else if (issue.sourceDate && issue.sourceDate >= cutoff) {
      newThisWeek.push(issue);
    } else {
      explore.push(issue);
    }
  }

  // Sort within each bucket
  const sortFn = sortMode === 'shift'
    ? (a: IssueSummary, b: IssueSummary) => b.opinionShift - a.opinionShift
    : (a: IssueSummary, b: IssueSummary) => (b.sourceDate ?? '').localeCompare(a.sourceDate ?? '');

  continueReading.sort(sortFn);
  newThisWeek.sort(sortFn);
  explore.sort(sortFn);
  completed.sort(sortFn);

  const sections: FeedSection[] = [];

  if (continueReading.length > 0) {
    sections.push({ kind: 'continue', label: 'Continue Reading', issues: continueReading, count: continueReading.length });
  }
  if (newThisWeek.length > 0) {
    sections.push({ kind: 'new', label: 'New This Week', issues: newThisWeek, count: newThisWeek.length });
  }
  if (explore.length > 0) {
    sections.push({ kind: 'explore', label: 'Earlier Issues', issues: explore, count: explore.length });
  }
  if (completed.length > 0) {
    sections.push({ kind: 'completed', label: 'Completed', issues: completed, count: completed.length });
  }

  return sections;
}
