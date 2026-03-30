import { describe, it, expect } from 'vitest';
import { buildFeedSections } from '../feed-sections';
import type { IssueSummary } from '../issues-loader';

function makeIssue(id: string, overrides: Partial<IssueSummary> = {}): IssueSummary {
  return {
    id,
    opinionShift: 73,
    status: null,
    edition: 1,
    headline: `Issue ${id}`,
    context: `Context for ${id}`,
    cards: [{ t: 'hook' }, { t: 'fact', lens: 'Legal' }],
    ...overrides,
  };
}

const now = new Date('2026-03-30');

describe('buildFeedSections', () => {
  it('returns empty array for no issues', () => {
    expect(buildFeedSections([], {}, now)).toEqual([]);
  });

  it('puts all unread issues without sourceDate into Explore', () => {
    const issues = [makeIssue('0001'), makeIssue('0002')];
    const sections = buildFeedSections(issues, {}, now);
    expect(sections).toHaveLength(1);
    expect(sections[0].kind).toBe('explore');
    expect(sections[0].count).toBe(2);
  });

  it('puts started issues into Continue Reading', () => {
    const issues = [makeIssue('0001'), makeIssue('0002')];
    const readMap = { '0001': JSON.stringify({ state: 'started', progress: 3 }) };
    const sections = buildFeedSections(issues, readMap, now);
    expect(sections.find(s => s.kind === 'continue')?.count).toBe(1);
    expect(sections.find(s => s.kind === 'explore')?.count).toBe(1);
  });

  it('puts completed issues into Completed', () => {
    const issues = [makeIssue('0001')];
    const readMap = { '0001': JSON.stringify({ state: 'completed', progress: 6 }) };
    const sections = buildFeedSections(issues, readMap, now);
    expect(sections).toHaveLength(1);
    expect(sections[0].kind).toBe('completed');
  });

  it('handles backward compat "true" as completed', () => {
    const issues = [makeIssue('0001')];
    const readMap = { '0001': 'true' };
    const sections = buildFeedSections(issues, readMap, now);
    expect(sections[0].kind).toBe('completed');
  });

  it('puts recent unread issues into New This Week', () => {
    const issues = [
      makeIssue('0001', { sourceDate: '2026-03-28' }), // 2 days ago
      makeIssue('0002', { sourceDate: '2026-03-15' }), // 15 days ago
    ];
    const sections = buildFeedSections(issues, {}, now);
    expect(sections.find(s => s.kind === 'new')?.count).toBe(1);
    expect(sections.find(s => s.kind === 'explore')?.count).toBe(1);
  });

  it('omits empty sections', () => {
    const issues = [makeIssue('0001')];
    const readMap = { '0001': JSON.stringify({ state: 'completed', progress: 6 }) };
    const sections = buildFeedSections(issues, readMap, now);
    expect(sections).toHaveLength(1);
    expect(sections.some(s => s.kind === 'continue')).toBe(false);
    expect(sections.some(s => s.kind === 'new')).toBe(false);
    expect(sections.some(s => s.kind === 'explore')).toBe(false);
  });

  it('maintains section order: continue, new, explore, completed', () => {
    const issues = [
      makeIssue('0001', { sourceDate: '2026-03-29' }),
      makeIssue('0002'),
      makeIssue('0003'),
      makeIssue('0004'),
    ];
    const readMap = {
      '0002': JSON.stringify({ state: 'started', progress: 2 }),
      '0004': JSON.stringify({ state: 'completed', progress: 6 }),
    };
    const sections = buildFeedSections(issues, readMap, now);
    const kinds = sections.map(s => s.kind);
    expect(kinds).toEqual(['continue', 'new', 'explore', 'completed']);
  });
});
