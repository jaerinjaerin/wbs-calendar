// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseDay, mondayOf, isoWeek, weekMonth } from '../scheduleExport';

describe('week helpers', () => {
  it('parses YYYY-MM-DD as a UTC calendar day', () => {
    expect(parseDay('2026-07-10')).toBe(Date.UTC(2026, 6, 10));
  });

  it('finds the monday of the ISO week', () => {
    expect(mondayOf(parseDay('2026-07-12'))).toBe(parseDay('2026-07-06')); // Sun → Mon
    expect(mondayOf(parseDay('2026-07-06'))).toBe(parseDay('2026-07-06')); // Mon → itself
  });

  it('computes ISO week numbers', () => {
    expect(isoWeek(parseDay('2026-07-10'))).toBe(28); // reference: 1차 검증(7/10) sits in W28
    expect(isoWeek(parseDay('2026-12-31'))).toBe(53);
    expect(isoWeek(parseDay('2027-01-01'))).toBe(53); // Fri still in 2026-W53
    expect(isoWeek(parseDay('2027-01-04'))).toBe(1);
  });

  it('assigns a week to the month holding 3+ of its weekdays (matches reference header)', () => {
    expect(weekMonth(parseDay('2026-06-29')).label).toBe('Jul'); // W27
    expect(weekMonth(parseDay('2026-08-31')).label).toBe('Sep'); // W36
    expect(weekMonth(parseDay('2026-09-28')).label).toBe('Sep'); // W40
    expect(weekMonth(parseDay('2026-10-05')).label).toBe('Oct'); // W41
    expect(weekMonth(parseDay('2026-12-28')).key).not.toBe(weekMonth(parseDay('2027-01-25')).key);
  });
});
