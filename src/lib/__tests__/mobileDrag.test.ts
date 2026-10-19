import { describe, it, expect } from 'vitest';
import { addDays, daysBetween, moveRange, cellAtPoint, dayLabel } from '../mobileDrag';
import { monthWeeks } from '../monthStack';

describe('addDays / daysBetween', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-10-20', '2026-10-23')).toBe(3);
    expect(daysBetween('2026-10-23', '2026-10-20')).toBe(-3);
  });
});

describe('moveRange (grab-point)', () => {
  const range = { start: '2026-10-20', end: '2026-10-22' }; // 3 days

  it('shifts both ends by grab → over and keeps the length', () => {
    // grab day 3 (22nd), drop on 25th → +3
    expect(moveRange(range, '2026-10-22', '2026-10-25')).toEqual({ start: '2026-10-23', end: '2026-10-25' });
  });

  it('moves backwards', () => {
    expect(moveRange(range, '2026-10-20', '2026-10-10')).toEqual({ start: '2026-10-10', end: '2026-10-12' });
  });

  it('is unchanged when dropped on the grabbed day', () => {
    expect(moveRange(range, '2026-10-21', '2026-10-21')).toEqual(range);
  });

  it('crosses into the next month', () => {
    expect(moveRange({ start: '2026-10-30', end: '2026-10-30' }, '2026-10-30', '2026-11-02')).toEqual({ start: '2026-11-02', end: '2026-11-02' });
  });
});

describe('cellAtPoint', () => {
  const weeks = monthWeeks(2026, 9); // Oct 2026: rows start 09-27, 10-04, 10-11, 10-18, 10-25
  const rows = weeks.map((_, i) => ({ left: 10, top: 100 + i * 50, width: 350, height: 50 })); // 50px per column

  it('maps a point to row and column', () => {
    expect(cellAtPoint(10 + 50 * 2 + 1, 100 + 50 * 3 + 10, rows, weeks)).toEqual({ date: '2026-10-20', rowIndex: 3, col: 2 });
  });

  it('returns out-of-month dates in the first row', () => {
    expect(cellAtPoint(11, 101, rows, weeks)).toEqual({ date: '2026-09-27', rowIndex: 0, col: 0 });
  });

  it('clamps the right edge to Saturday', () => {
    expect(cellAtPoint(10 + 349.9, 101, rows, weeks)?.col).toBe(6);
  });

  it('is null outside the grid', () => {
    expect(cellAtPoint(5, 120, rows, weeks)).toBeNull();   // left of grid
    expect(cellAtPoint(100, 99, rows, weeks)).toBeNull();  // above (header)
    expect(cellAtPoint(100, 350, rows, weeks)).toBeNull(); // below last row
  });

  it('ignores rows scrolled out of the visible clip area', () => {
    // container scrolled so rows 0-1 sit above its top edge (under the header on screen)
    const clip = { left: 10, top: 200, width: 350, height: 300 };
    expect(cellAtPoint(100, 120, rows, weeks, clip)).toBeNull();
    expect(cellAtPoint(10 + 50 * 2 + 1, 260, rows, weeks, clip)?.date).toBe('2026-10-20');
  });
});

describe('dayLabel', () => {
  it('formats month, day and weekday in Korean', () => {
    expect(dayLabel('2026-10-23')).toBe('10월 23일 (금)');
    expect(dayLabel('2026-10-18')).toBe('10월 18일 (일)');
  });
});
