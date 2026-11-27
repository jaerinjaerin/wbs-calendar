import { describe, it, expect } from 'vitest';
import { buildOverview, overviewWindow, seoulToday, MAX_LANES } from '../projectOverview';

const t = (start_date: string, end_date: string, status: 'todo' | 'in_progress' | 'done' = 'todo') =>
  ({ start_date, end_date, status, color: '#000' });

describe('overviewWindow', () => {
  it('stretches past the month when this week crosses into the next one', () => {
    // 2026-11-30 is a Monday: its week ends 2026-12-06
    expect(overviewWindow('2026-11-30')).toMatchObject({ from: '2026-11-01', to: '2026-12-06' });
    // 2026-11-01 is a Sunday: its week starts 2026-10-26
    expect(overviewWindow('2026-11-01')).toMatchObject({ from: '2026-10-26', to: '2026-11-30' });
  });
});

describe('seoulToday', () => {
  it('uses the Korean date, not UTC', () => {
    expect(seoulToday(new Date('2026-11-26T16:00:00Z'))).toBe('2026-11-27');
  });
});

describe('buildOverview', () => {
  it('clips bars to the month and packs non-overlapping tasks into one lane', () => {
    const { bars } = buildOverview([t('2026-10-20', '2026-11-05'), t('2026-11-10', '2026-11-12'), t('2026-11-03', '2026-11-04')], '2026-11-27');
    expect(bars.map((b) => b.lane)).toEqual([0, 1, 0]);
    expect(buildOverview([], '2026-11-27').lanes).toBe(0);
    expect(bars[0].left).toBe(0);
    expect(bars[0].width).toBeCloseTo((5 / 30) * 100);
  });

  it('drops tasks past the last lane', () => {
    const many = Array.from({ length: MAX_LANES + 2 }, () => t('2026-11-01', '2026-11-30'));
    expect(buildOverview(many, '2026-11-27').bars).toHaveLength(MAX_LANES);
  });

  it('counts open tasks ending this week', () => {
    const o = buildOverview([
      t('2026-11-20', '2026-11-28', 'in_progress'),
      t('2026-11-20', '2026-11-29', 'done'),
      t('2026-11-20', '2026-11-22'), // ended last week
      t('2026-11-25', '2026-12-01'), // ends next week
    ], '2026-11-27');
    expect(o.dueThisWeek).toBe(1);
  });
});
