import { describe, it, expect } from 'vitest';
import { isoWeek, maxStackDepth, monthWeeks } from '../monthStack';

describe('monthWeeks', () => {
  it('covers the month with Sunday-start weeks', () => {
    const w = monthWeeks(2026, 9); // Oct 2026: 1st is Thursday
    expect(w[0]).toEqual({ start: '2026-09-27', end: '2026-10-03' });
    expect(w[w.length - 1]).toEqual({ start: '2026-10-25', end: '2026-10-31' });
    expect(w).toHaveLength(5);
  });
});

describe('maxStackDepth', () => {
  const week = [{ start: '2026-10-11', end: '2026-10-17' }];

  it('stacks overlapping events, reuses lanes for back-to-back ones', () => {
    expect(maxStackDepth([
      { start: '2026-10-12', end: '2026-10-14' },
      { start: '2026-10-13', end: '2026-10-13' },
      { start: '2026-10-15', end: '2026-10-16' }, // fits lane 0 after the first
    ], week)).toBe(2);
  });

  it('takes the densest week and counts events crossing in from another week', () => {
    expect(maxStackDepth([
      { start: '2026-10-08', end: '2026-10-12' },
      { start: '2026-10-12', end: '2026-10-12' },
      { start: '2026-10-12', end: '2026-10-12' },
    ], monthWeeks(2026, 9))).toBe(3);
  });

  it('is 0 with no events', () => {
    expect(maxStackDepth([], week)).toBe(0);
  });
});

describe('isoWeek', () => {
  it('numbers weeks across year boundaries', () => {
    expect(isoWeek('2026-10-26')).toBe(44);
    expect(isoWeek('2026-12-31')).toBe(53);
    expect(isoWeek('2027-01-04')).toBe(1);
    expect(isoWeek('2027-01-01')).toBe(53); // Friday of 2026-W53
  });
});
