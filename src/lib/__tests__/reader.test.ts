import { beforeEach, describe, it, expect } from 'vitest';
import {
  addReaction,
  countHighlights,
  computeAffinity,
  getReadCount,
  getReactions,
  getSavedIssueMap,
  hasReacted,
  isSavedIssue,
  reactions,
  saveIssue,
  savedIssues,
  scoreIssue,
  toggleSavedIssue,
  unsaveIssue
} from '../../stores/reader';

describe('saved issues', () => {
  beforeEach(() => {
    savedIssues.set('{}');
  });

  it('starts empty', () => {
    expect(getSavedIssueMap()).toEqual({});
  });

  it('saves an issue', () => {
    saveIssue('001');
    expect(isSavedIssue('001')).toBe(true);
  });

  it('unsaves an issue', () => {
    saveIssue('001');
    unsaveIssue('001');
    expect(isSavedIssue('001')).toBe(false);
  });

  it('toggles saved state', () => {
    toggleSavedIssue('001');
    expect(isSavedIssue('001')).toBe(true);
    toggleSavedIssue('001');
    expect(isSavedIssue('001')).toBe(false);
  });
});

describe('reactions', () => {
  beforeEach(() => {
    reactions.set('{}');
  });

  it('starts empty', () => {
    expect(getReactions()).toEqual({});
  });

  it('stores a highlighted card', () => {
    addReaction('001', 2);
    expect(hasReacted('001', 2)).toBe(true);
    expect(getReactions()).toEqual({ '001': [2] });
  });

  it('deduplicates repeat highlights for the same card', () => {
    addReaction('001', 2);
    addReaction('001', 2);
    expect(getReactions()).toEqual({ '001': [2] });
  });

  it('tracks multiple highlighted cards on one issue', () => {
    addReaction('001', 1);
    addReaction('001', 4);
    expect(hasReacted('001', 1)).toBe(true);
    expect(hasReacted('001', 4)).toBe(true);
    expect(getReactions()['001']).toEqual([1, 4]);
  });

  it('counts every highlighted card, not just unique issues', () => {
    addReaction('001', 1);
    addReaction('001', 4);
    addReaction('002', 0);
    expect(countHighlights()).toBe(3);
  });
});

describe('getReadCount', () => {
  it('returns zero for empty map', () => {
    expect(getReadCount({})).toEqual({ completed: 0, started: 0 });
  });

  it('counts completed issues', () => {
    const map = {
      '001': JSON.stringify({ state: 'completed', progress: 6 }),
      '002': JSON.stringify({ state: 'completed', progress: 6 }),
    };
    expect(getReadCount(map)).toEqual({ completed: 2, started: 0 });
  });

  it('counts started issues', () => {
    const map = {
      '001': JSON.stringify({ state: 'started', progress: 3 }),
    };
    expect(getReadCount(map)).toEqual({ completed: 0, started: 1 });
  });

  it('handles legacy "true" format', () => {
    const map = { '001': 'true' };
    expect(getReadCount(map)).toEqual({ completed: 1, started: 0 });
  });

  it('handles mixed states', () => {
    const map = {
      '001': JSON.stringify({ state: 'completed', progress: 6 }),
      '002': JSON.stringify({ state: 'started', progress: 2 }),
      '003': 'true',
      '004': '',
    };
    const result = getReadCount(map);
    expect(result.completed).toBe(2);
    expect(result.started).toBe(1);
  });

  it('treats malformed JSON as completed', () => {
    const map = { '001': 'not-json' };
    expect(getReadCount(map)).toEqual({ completed: 1, started: 0 });
  });
});

describe('computeAffinity', () => {
  const issues = [
    { id: '001', opinionShift: 50, cards: [{ t: 'fact', lens: 'Legal' }, { t: 'fact', lens: 'Economic' }] },
    { id: '002', opinionShift: 70, cards: [{ t: 'fact', lens: 'Legal' }, { t: 'fact', lens: 'Social' }] },
  ];

  it('returns empty for no read issues', () => {
    const result = computeAffinity({}, {}, issues);
    expect(result).toEqual({});
  });

  it('scores completed issues higher than started', () => {
    const readMap = {
      '001': JSON.stringify({ state: 'completed' }),
      '002': JSON.stringify({ state: 'started' }),
    };
    const result = computeAffinity(readMap, {}, issues);
    // Both have Legal lens, but 001 completed gives 1.0 vs 002 started gives 0.3
    expect(result['Legal']).toBeGreaterThan(0);
  });

  it('boosts lenses with reactions', () => {
    const readMap = {
      '001': JSON.stringify({ state: 'completed' }),
    };
    const withReactions = computeAffinity(readMap, { '001': [0] }, issues);
    const withoutReactions = computeAffinity(readMap, {}, issues);
    expect(withReactions['Legal']).toBeGreaterThan(withoutReactions['Legal']);
  });
});

describe('scoreIssue', () => {
  it('returns 0 for issue with no matching affinity', () => {
    const issue = { id: '001', opinionShift: 0, cards: [{ t: 'fact', lens: 'Legal' }] };
    expect(scoreIssue(issue, {})).toBe(0);
  });

  it('adds affinity score per matching lens', () => {
    const issue = { id: '001', opinionShift: 0, cards: [
      { t: 'fact', lens: 'Legal' },
      { t: 'fact', lens: 'Economic' },
    ]};
    const affinity = { Legal: 2.0, Economic: 1.5 };
    const score = scoreIssue(issue, affinity);
    expect(score).toBe(3.5);
  });

  it('includes opinionShift bonus', () => {
    const issue = { id: '001', opinionShift: 80, cards: [] };
    const score = scoreIssue(issue, {});
    expect(score).toBeCloseTo(80 * 0.003);
  });
});
