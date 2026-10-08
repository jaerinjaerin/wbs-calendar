// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseDay, mondayOf, isoWeek, weekMonth, buildLayout } from '../scheduleExport';
import type { Task, WbsNode } from '@/types';

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

const node = (id: string, name: string, parent_id: string | null, sort_order: number, color = '#3563e9'): WbsNode =>
  ({ id, project_id: 'p1', parent_id, name, sort_order, color, depth: parent_id ? 1 : 0 });
const task = (id: string, wbs_node_id: string, name: string, start_date: string, end_date: string): Task =>
  ({ id, wbs_node_id, name, start_date, end_date, assignee_id: null, status: 'todo' });

const nodes: WbsNode[] = [
  node('ms', '주요 일정', null, 0, '#ffc000'),
  node('retail', 'Tab S12F 리테일모드', null, 1),
  node('ss', '스크린세이버', 'retail', 2, '#1a9e8f'),
  node('app', '체험앱 컨텐츠', 'retail', 1, '#f6c344'),
  { ...node('deep', '더미 에셋', 'app', 1), depth: 2 },
  node('copy', '카피', null, 2, '#e5484d'),
];
const tasks: Task[] = [
  task('t1', 'ms', '1차 검증', '2026-07-10', '2026-07-10'),
  task('t2', 'ss', '스토리보드 제안', '2026-07-07', '2026-07-24'),
  task('t3', 'ss', '월페 입수', '2026-07-08', '2026-07-08'),
  task('t4', 'app', '1차 작업 진행', '2026-07-14', '2026-07-31'),
  task('t5', 'deep', '더미 에셋 제작', '2026-08-03', '2026-08-07'),
  task('t6', 'copy', '법인리뷰', '2026-07-20', '2026-07-24'),
  task('t7', 'other-project-node', '남의 일정', '2025-01-01', '2027-12-31'),
];

describe('buildLayout', () => {
  const layout = buildLayout(tasks, nodes);

  it('spans weeks from the earliest start to the latest end, ignoring tasks of unknown WBS nodes', () => {
    expect(layout.weeks.map((w) => w.label)).toEqual(['W28', 'W29', 'W30', 'W31', 'W32']);
    expect(layout.weeks.map((w) => w.month)).toEqual(['Jul', 'Jul', 'Jul', 'Jul', 'Aug']);
  });

  it('pulls 주요 일정 tasks into the milestone row and out of the groups', () => {
    expect(layout.milestones.bars).toEqual([{ lane: 0, start: 0, end: 0, text: '1차 검증(7/10)', color: '#ffc000' }]);
    expect(layout.groups.map((g) => g.name)).toEqual(['Tab S12F 리테일모드', '카피']);
  });

  it('orders details by sort_order and rolls depth-2 tasks into their depth-1 detail', () => {
    const retail = layout.groups[0];
    expect(retail.sections.map((s) => s.name)).toEqual(['체험앱 컨텐츠', '스크린세이버']);
    expect(retail.sections[0].bars.map((b) => [b.text, b.lane, b.start, b.end])).toEqual([
      ['1차 작업 진행(7/14~7/31)', 0, 1, 3],
      ['더미 에셋 제작(8/3~8/7)', 0, 4, 4],
    ]);
  });

  it('stacks tasks that share a week into separate lanes', () => {
    const ss = layout.groups[0].sections[1];
    expect(ss.lanes).toBe(2);
    expect(ss.bars.map((b) => [b.text, b.lane])).toEqual([['스토리보드 제안(7/7~7/24)', 0], ['월페 입수(7/8)', 1]]);
  });

  it('puts tasks attached directly to a 구분 into a "-" detail', () => {
    expect(layout.groups[1].sections).toEqual([
      { name: '-', lanes: 1, bars: [{ lane: 0, start: 2, end: 2, text: '법인리뷰(7/20~7/24)', color: '#e5484d' }] },
    ]);
  });

  it('lanes by week, not by date: back-to-back tasks in one week still stack', () => {
    const l = buildLayout(
      [task('a', 'ss', 'A', '2026-07-06', '2026-07-08'), task('b', 'ss', 'B', '2026-07-09', '2026-07-10')],
      nodes,
    );
    expect(l.groups[0].sections[0].lanes).toBe(2);
  });

  it('swaps start/end when start_date > end_date', () => {
    const l = buildLayout([task('a', 'ss', 'A', '2026-07-24', '2026-07-07')], nodes);
    expect(l.groups[0].sections[0].bars[0]).toMatchObject({ start: 0, end: 2, text: 'A(7/7~7/24)' });
  });

  it('matches a padded "주요 일정" name and treats orphan nodes as roots', () => {
    const l = buildLayout(
      [task('a', 'ms2', 'M', '2026-07-06', '2026-07-06'), task('b', 'orphan', 'O', '2026-07-06', '2026-07-06')],
      [node('ms2', ' 주요 일정 ', null, 0), node('orphan', '고아', 'missing-parent', 1)],
    );
    expect(l.milestones.bars).toHaveLength(1);
    expect(l.groups.map((g) => g.name)).toEqual(['고아']);
  });

  it('returns no weeks and a one-lane empty milestone row when nothing is exportable', () => {
    const l = buildLayout([tasks[6]], nodes);
    expect(l.weeks).toEqual([]);
    expect(l.groups).toEqual([]);
    expect(l.milestones).toEqual({ name: '주요 일정', lanes: 1, bars: [] });
  });
});
