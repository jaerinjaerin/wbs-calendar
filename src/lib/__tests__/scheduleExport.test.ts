// @vitest-environment node
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  parseDay, mondayOf, isoWeek, weekMonth, buildLayout,
  barColors, sheetName, exportFileName, renderWorkbook, textLines,
} from '../scheduleExport';
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
    expect(layout.milestones.bars).toEqual([{ lane: 0, start: 0, end: 0, name: '1차 검증', dates: '7/10', color: '#ffc000' }]);
    expect(layout.groups.map((g) => g.name)).toEqual(['Tab S12F 리테일모드', '카피']);
  });

  it('orders details by sort_order and rolls depth-2 tasks into their depth-1 detail', () => {
    const retail = layout.groups[0];
    expect(retail.sections.map((s) => s.name)).toEqual(['체험앱 컨텐츠', '스크린세이버']);
    expect(retail.sections[0].bars.map((b) => [`${b.name}(${b.dates})`, b.lane, b.start, b.end])).toEqual([
      ['1차 작업 진행(7/14~7/31)', 0, 1, 3],
      ['더미 에셋 제작(8/3~8/7)', 0, 4, 4],
    ]);
  });

  it('stacks tasks that share a week into separate lanes', () => {
    const ss = layout.groups[0].sections[1];
    expect(ss.lanes).toBe(2);
    expect(ss.bars.map((b) => [`${b.name}(${b.dates})`, b.lane])).toEqual([['스토리보드 제안(7/7~7/24)', 0], ['월페 입수(7/8)', 1]]);
  });

  it('puts tasks attached directly to a 구분 into a "-" detail', () => {
    expect(layout.groups[1].sections).toEqual([
      { name: '-', lanes: 1, bars: [{ lane: 0, start: 2, end: 2, name: '법인리뷰', dates: '7/20~7/24', color: '#e5484d' }] },
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
    expect(l.groups[0].sections[0].bars[0]).toMatchObject({ start: 0, end: 2, name: 'A', dates: '7/7~7/24' });
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

describe('naming and colors', () => {
  it('picks the higher-contrast text color and falls back on bad hex', () => {
    // fill is Excel's "Lighter 80%" of the category color, so text ends up black
    expect(barColors('#4472C4')).toEqual({ fill: 'FFD9E1F2', text: 'FF000000' });
    expect(barColors('#FFC000')).toEqual({ fill: 'FFFFF2CC', text: 'FF000000' });
    expect(barColors('#1a9e8f').text).toBe('FF000000');
    expect(barColors('#abc')).toEqual({ fill: 'FFD9D9D9', text: 'FF000000' });
    expect(barColors('')).toEqual({ fill: 'FFD9D9D9', text: 'FF000000' });
  });

  it('sanitizes sheet names', () => {
    expect(sheetName('Tab S12F')).toBe('Tab S12F');
    expect(sheetName('a/b\\c?d*e[f]g:h')).toBe('abcdefgh');
    expect(sheetName('x'.repeat(40))).toHaveLength(31);
    expect(sheetName('[]:')).toBe('Schedule');
  });

  it('produces sheet names exceljs accepts (no edge apostrophes, not "History")', () => {
    expect(sheetName("'26 Tab")).toBe('26 Tab');
    expect(sheetName("Kids'")).toBe('Kids');
    expect(sheetName('History')).toBe('Schedule');
    expect(sheetName('x'.repeat(30) + "'yz")).toBe('x'.repeat(30));
    for (const name of ["'x'", 'History', 'x'.repeat(30) + "'yz"]) {
      expect(() => new ExcelJS.Workbook().addWorksheet(sheetName(name))).not.toThrow();
    }
  });

  it('builds YYMMDD_<name>_Schedule.xlsx', () => {
    const today = new Date(2026, 9, 7);
    expect(exportFileName('Tab S12F', today)).toBe('261007_Tab S12F_Schedule.xlsx');
    expect(exportFileName('a/b:c"d', today)).toBe('261007_abcd_Schedule.xlsx');
    expect(exportFileName('', today)).toBe('261007_Project_Schedule.xlsx');
  });
});

describe('renderWorkbook', () => {
  async function roundTrip() {
    const wb = renderWorkbook(buildLayout(tasks, nodes), 'Galaxy/Tab', new Date(2026, 9, 7));
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(await wb.xlsx.writeBuffer());
    return back.worksheets[0];
  }

  it('writes title, date, headers and footer where the reference has them', async () => {
    const ws = await roundTrip();
    expect(ws.name).toBe('GalaxyTab');
    expect(ws.views[0].showGridLines).toBe(false);
    expect(ws.getCell('B2').value).toBe('Galaxy/Tab');
    expect(ws.getCell('G2').value).toBe('* 2026.10.07 Updated'); // last two week columns (W31–W32)
    expect(ws.getCell('H2').master.address).toBe('G2');
    expect(ws.getCell('B3').value).toBe('구분');
    expect(ws.getCell('C3').value).toBe('상세');
    expect(['D4', 'E4', 'F4', 'G4', 'H4'].map((a) => ws.getCell(a).value)).toEqual(['W28', 'W29', 'W30', 'W31', 'W32']);
    expect(ws.getCell('G3').master.address).toBe('D3'); // Jul merged across W28–W31
    expect(ws.getCell('D3').value).toBe('Jul');
    expect(ws.getCell('H3').value).toBe('Aug');
    expect(ws.getCell('B11').value).toBe('* 상기 일정은 런칭 일정 및 프로젝트 진행상황에 따라 추후 변동 가능');
  });

  it('lays out milestone, groups, details and merged bars', async () => {
    const ws = await roundTrip();
    expect(ws.getCell('B5').value).toBe('주요 일정');
    expect(ws.getCell('C5').master.address).toBe('B5');
    expect(ws.getCell('D5').text).toBe('1차 검증\n(7/10)');
    expect((ws.getCell('D5').fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFFFC000');

    expect(ws.getCell('B6').value).toBe('Tab S12F 리테일모드');
    expect(ws.getCell('B8').master.address).toBe('B6');  // 구분 spans 체험앱(1 lane) + 스크린세이버(2 lanes)
    expect(ws.getCell('C6').value).toBe('체험앱 컨텐츠');
    expect(ws.getCell('C7').value).toBe('스크린세이버');
    expect(ws.getCell('C8').master.address).toBe('C7');

    expect(ws.getCell('D7').text).toBe('스토리보드 제안\n(7/7~7/24)');
    expect(ws.getCell('F7').master.address).toBe('D7');
    expect((ws.getCell('F7').fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFC7F6F0');
    expect(ws.getCell('D8').text).toBe('월페 입수\n(7/8)');
    expect(ws.getCell('E6').text).toBe('1차 작업 진행\n(7/14~7/31)');
    expect(ws.getCell('G6').master.address).toBe('E6');

    expect(ws.getCell('B9').value).toBe('카피');
    expect(ws.getCell('C9').value).toBe('-');
    expect(ws.getCell('F9').text).toBe('법인리뷰\n(7/20~7/24)');
  });

  it('writes bar dates on a second line in a smaller font', async () => {
    const ws = await roundTrip();
    const runs = (ws.getCell('E6').value as ExcelJS.CellRichTextValue).richText;
    expect(runs.map((r) => [r.text, r.font?.size, r.font?.name])).toEqual([
      ['1차 작업 진행', 10, 'Samsung SS Head KR Medium'],
      ['\n(7/14~7/31)', 8, 'Samsung SS Head KR Medium'],
    ]);
    expect(runs[1].font?.color?.argb).toBe(runs[0].font?.color?.argb); // date keeps the bar's text color
  });

  it('gives the title its own merged span so the date never covers it', async () => {
    const ws = await roundTrip();
    expect(ws.getCell('F2').master.address).toBe('B2'); // title B2:F2, date G2:H2
    expect(ws.getCell('B2').alignment.horizontal).toBe('left');
  });

  it('wraps the title and grows row 2 when even the merged span is too narrow', async () => {
    const wb = renderWorkbook(buildLayout([tasks[2]], nodes), 'Galaxy Tab S12 Series Retail Mode', new Date(2026, 9, 7));
    const ws = wb.worksheets[0];
    expect(ws.getCell('B2').alignment.wrapText).toBe(true);
    expect(ws.getRow(2).height).toBeGreaterThan(33);
  });

  it('keeps short bars at 30pt and grows a lane whose bar text wraps', async () => {
    const ws = await roundTrip();
    expect(ws.getRow(6).height).toBe(30); // 1차 작업 진행 over 3 weeks + 더미 에셋 제작 over 1 week: one line each
    const wb = renderWorkbook(
      buildLayout([task('long', 'ss', '아주 긴 이름의 스크린세이버 제작 작업 (SES/C&R)', '2026-07-06', '2026-07-06')], nodes),
      'P', new Date(2026, 9, 7),
    );
    expect(wb.worksheets[0].getRow(6).height).toBeGreaterThan(30);
  });

  it('keeps per-cell borders on merged cells (outer edge medium on both ends of a bar)', async () => {
    const ws = await roundTrip();
    expect(ws.getCell('H6').border.right?.style).toBe('medium'); // 더미 에셋 bar on the table's right edge
    expect(ws.getCell('D7').border.left?.style).toBe('thin');    // first week column
    expect(ws.getCell('F7').border.right?.style).toBe('dotted'); // bar end keeps its own border
    expect(ws.getCell('D4').border.bottom?.style).toBe('double');
    expect(ws.getCell('D9').border.bottom?.style).toBe('medium');
  });

  it('uses only Samsung SS Head KR fonts', async () => {
    const ws = await roundTrip();
    const names = new Set<string>();
    ws.eachRow((row) => row.eachCell((cell) => names.add(cell.font?.name ?? '(none)')));
    expect(Array.from(names).sort()).toEqual(['Samsung SS Head KR Bold', 'Samsung SS Head KR Medium']);
  });
});

describe('textLines', () => {
  it('fits short or widely spanned text on one line', () => {
    expect(textLines('체험앱 검증', 10, 13.66)).toBe(1);
    expect(textLines('스크린세이버 제작 (SES/C&R)', 10, 13.66 * 3)).toBe(1);
  });

  it('wraps on spaces like Excel does', () => {
    expect(textLines('스크린세이버 제작 (SES/C&R)', 10, 13.66)).toBe(2);
    expect(textLines('아주 긴 이름의 스크린세이버 제작 작업 (SES/C&R)', 10, 13.66)).toBeGreaterThanOrEqual(3);
  });

  it('breaks a single word longer than the cell', () => {
    expect(textLines('가'.repeat(20), 10, 13.66)).toBeGreaterThanOrEqual(3);
  });

  it('counts wider text at larger font sizes', () => {
    expect(textLines('Galaxy Tab S12 Series', 22, 14)).toBeGreaterThan(textLines('Galaxy Tab S12 Series', 10, 14));
  });
});
