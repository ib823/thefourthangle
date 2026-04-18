import { describe, it, expect } from 'vitest';
import { buildFeedSections, FEED_SECTIONS } from '../feed-sections';
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

describe('buildFeedSections — four-section invariant', () => {
  it('returns exactly four sections on empty state (no issues)', () => {
    const sections = buildFeedSections([], {}, now);
    expect(sections).toHaveLength(4);
    expect(sections.map(s => s.kind)).toEqual(['continue', 'new', 'explore', 'completed']);
    expect(sections.every(s => s.count === 0 && s.issues.length === 0)).toBe(true);
  });

  it('returns exactly four sections on partial state (some read, some not)', () => {
    const issues = [
      makeIssue('0001', { sourceDate: '2026-03-29' }),
      makeIssue('0002'),
      makeIssue('0003'),
    ];
    const readMap = { '0002': JSON.stringify({ state: 'started', progress: 2 }) };
    const sections = buildFeedSections(issues, readMap, now);
    expect(sections).toHaveLength(4);
    expect(sections.map(s => s.kind)).toEqual(['continue', 'new', 'explore', 'completed']);
  });

  it('returns exactly four sections on fully-populated state (all four non-empty)', () => {
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
    expect(sections).toHaveLength(4);
    expect(sections.every(s => s.count > 0)).toBe(true);
  });

  it('returns exactly four sections on over-populated state (many issues per bucket)', () => {
    const issues: IssueSummary[] = [];
    for (let i = 0; i < 20; i++) issues.push(makeIssue(`e${i}`));
    for (let i = 0; i < 15; i++) issues.push(makeIssue(`n${i}`, { sourceDate: '2026-03-29' }));
    const readMap: Record<string, string> = {};
    for (let i = 0; i < 10; i++) readMap[`s${i}`] = JSON.stringify({ state: 'started', progress: 3 });
    for (let i = 0; i < 10; i++) readMap[`c${i}`] = JSON.stringify({ state: 'completed', progress: 6 });
    for (let i = 0; i < 10; i++) issues.push(makeIssue(`s${i}`));
    for (let i = 0; i < 10; i++) issues.push(makeIssue(`c${i}`));
    const sections = buildFeedSections(issues, readMap, now);
    expect(sections).toHaveLength(4);
    expect(sections.find(s => s.kind === 'continue')?.count).toBe(10);
    expect(sections.find(s => s.kind === 'new')?.count).toBe(15);
    expect(sections.find(s => s.kind === 'explore')?.count).toBe(20);
    expect(sections.find(s => s.kind === 'completed')?.count).toBe(10);
  });

  it('preserves canonical section order regardless of input', () => {
    const issues = [
      makeIssue('0001', { sourceDate: '2026-03-29' }),
      makeIssue('0002'),
    ];
    const readMap = { '0001': JSON.stringify({ state: 'completed', progress: 6 }) };
    const sections = buildFeedSections(issues, readMap, now);
    expect(sections.map(s => s.kind)).toEqual(['continue', 'new', 'explore', 'completed']);
  });

  it('labels match the FEED_SECTIONS const', () => {
    const sections = buildFeedSections([], {}, now);
    for (const section of sections) {
      const canonical = FEED_SECTIONS.find(s => s.kind === section.kind);
      expect(canonical).toBeDefined();
      expect(section.label).toBe(canonical!.label);
    }
  });

  it('every section has matching count and issues.length', () => {
    const issues = [
      makeIssue('0001', { sourceDate: '2026-03-29' }),
      makeIssue('0002'),
      makeIssue('0003'),
    ];
    const readMap = { '0002': JSON.stringify({ state: 'started', progress: 2 }) };
    const sections = buildFeedSections(issues, readMap, now);
    for (const section of sections) {
      expect(section.count).toBe(section.issues.length);
    }
  });
});

describe('buildFeedSections — bucketing logic (preserved from v2)', () => {
  it('puts all unread issues without sourceDate into Explore', () => {
    const issues = [makeIssue('0001'), makeIssue('0002')];
    const sections = buildFeedSections(issues, {}, now);
    expect(sections.find(s => s.kind === 'explore')?.count).toBe(2);
    expect(sections.find(s => s.kind === 'continue')?.count).toBe(0);
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
    expect(sections.find(s => s.kind === 'completed')?.count).toBe(1);
  });

  it('handles backward-compat "true" value as completed', () => {
    const issues = [makeIssue('0001')];
    const readMap = { '0001': 'true' };
    const sections = buildFeedSections(issues, readMap, now);
    expect(sections.find(s => s.kind === 'completed')?.count).toBe(1);
  });

  it('puts recent unread issues into New This Week (within 7 days)', () => {
    const issues = [
      makeIssue('0001', { sourceDate: '2026-03-28' }),
      makeIssue('0002', { sourceDate: '2026-03-15' }),
    ];
    const sections = buildFeedSections(issues, {}, now);
    expect(sections.find(s => s.kind === 'new')?.count).toBe(1);
    expect(sections.find(s => s.kind === 'explore')?.count).toBe(1);
  });
});

describe('FEED_SECTIONS const', () => {
  it('has exactly four entries', () => {
    expect(FEED_SECTIONS).toHaveLength(4);
  });

  it('is in canonical order', () => {
    expect(FEED_SECTIONS.map(s => s.kind)).toEqual(['continue', 'new', 'explore', 'completed']);
  });

  it('every kind has a non-empty label', () => {
    for (const { label } of FEED_SECTIONS) {
      expect(label).toBeTruthy();
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
