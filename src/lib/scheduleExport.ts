import ExcelJS from 'exceljs';
import type { Task, WbsNode } from '@/types';
import { lighter80 } from './color';

export const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// task dates are calendar days ('YYYY-MM-DD'); work in UTC so the local timezone never shifts a day
export function parseDay(s: string): number {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function mondayOf(t: number): number {
  return t - ((new Date(t).getUTCDay() + 6) % 7) * DAY;
}

// ISO 8601: week 1 is the week containing Jan 4
export function isoWeek(t: number): number {
  const thursday = mondayOf(t) + 3 * DAY;
  const jan4 = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 4);
  return 1 + Math.round((mondayOf(thursday) - mondayOf(jan4)) / (7 * DAY));
}

// the month holding 3+ of Mon–Fri is always Wednesday's month
export function weekMonth(monday: number): { label: string; key: string } {
  const wed = new Date(monday + 2 * DAY);
  return { label: MONTHS[wed.getUTCMonth()], key: `${wed.getUTCFullYear()}-${wed.getUTCMonth()}` };
}

const MILESTONE_LABEL = '주요 일정';

export interface Week { monday: number; label: string; month: string; monthKey: string }
// start/end are week indexes into Layout.weeks, inclusive
export interface Bar { lane: number; start: number; end: number; name: string; dates: string; color: string }
export interface Section { name: string; lanes: number; bars: Bar[] }
export interface Group { name: string; sections: Section[] }
// milestones: one cell per week, names of checked tasks starting that week joined by newlines
export interface Layout { weeks: Week[]; milestones: string[]; groups: Group[] }

interface Item { name: string; s: number; e: number; root: WbsNode; detail: WbsNode | null; color: string; milestone: boolean }

const md = (t: number) => `${new Date(t).getUTCMonth() + 1}/${new Date(t).getUTCDate()}`;
const bySort = (a: WbsNode, b: WbsNode) => a.sort_order - b.sort_order;

export function buildLayout(tasks: Task[], wbsNodes: WbsNode[]): Layout {
  const byId = new Map(wbsNodes.map((n) => [n.id, n]));

  // tasks whose node isn't in this project's tree (page loads every task) are dropped here
  const items: Item[] = tasks.filter((t) => byId.has(t.wbs_node_id)).map((t) => {
    const a = parseDay(t.start_date);
    const b = parseDay(t.end_date);
    const chain: WbsNode[] = []; // root first; a node with a missing parent counts as a root
    for (let n = byId.get(t.wbs_node_id); n && !chain.includes(n); n = n.parent_id ? byId.get(n.parent_id) : undefined) {
      chain.unshift(n);
    }
    return {
      name: t.name,
      s: Math.min(a, b),
      e: Math.max(a, b),
      root: chain[0],
      detail: chain[1] ?? null,
      color: byId.get(t.wbs_node_id)!.color,
      milestone: !!t.is_milestone,
    };
  });

  const weeks: Week[] = [];
  if (items.length) {
    const last = mondayOf(Math.max(...items.map((i) => i.e)));
    for (let m = mondayOf(Math.min(...items.map((i) => i.s))); m <= last; m += 7 * DAY) {
      const { label, key } = weekMonth(m);
      weeks.push({ monday: m, label: `W${isoWeek(m)}`, month: label, monthKey: key });
    }
  }
  const weekIndex = (t: number) => Math.round((mondayOf(t) - weeks[0].monday) / (7 * DAY));

  const chrono = (list: Item[]) => [...list].sort((x, y) => x.s - y.s || x.e - y.e || x.name.localeCompare(y.name));

  function section(name: string, list: Item[]): Section {
    const sorted = chrono(list);
    const laneEnds: number[] = []; // last occupied week index per lane
    const bars = sorted.map((i) => {
      const start = weekIndex(i.s);
      const end = weekIndex(i.e);
      let lane = laneEnds.findIndex((occupiedTo) => occupiedTo < start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = end;
      const dates = i.s === i.e ? md(i.s) : `${md(i.s)}~${md(i.e)}`;
      return { lane, start, end, name: i.name, dates, color: i.color };
    });
    return { name, lanes: Math.max(1, laneEnds.length), bars };
  }

  const roots = Array.from(new Set(items.map((i) => i.root))).sort(bySort);
  const groups: Group[] = roots.map((root) => {
    const mine = items.filter((i) => i.root === root);
    const direct = mine.filter((i) => !i.detail);
    const details = Array.from(new Set(mine.flatMap((i) => (i.detail ? [i.detail] : [])))).sort(bySort);
    return {
      name: root.name,
      sections: [
        ...(direct.length ? [section('-', direct)] : []),
        ...details.map((d) => section(d.name, mine.filter((i) => i.detail === d))),
      ],
    };
  });

  const milestones = weeks.map(() => [] as string[]);
  for (const i of chrono(items.filter((i) => i.milestone))) milestones[weekIndex(i.s)].push(i.name);

  return { weeks, milestones: milestones.map((names) => names.join('\n')), groups };
}

const FONT_BOLD = 'Samsung SS Head KR Bold';
const FONT_MEDIUM = 'Samsung SS Head KR Medium';
const ARGB = {
  header: 'FFB4C6E7',
  milestone: 'FFFFC000',
  side: 'FFF2F2F2',
  fallbackBar: 'FFD9D9D9',
  date: 'FF0070C0',
  black: 'FF000000',
  white: 'FFFFFFFF',
};
const FIRST_WEEK_COL = 4;
const HEADER_ROW = 3;
const FOOTNOTE = '* 상기 일정은 런칭 일정 및 프로젝트 진행상황에 따라 추후 변동 가능';
const pad = (n: number) => String(n).padStart(2, '0');

// black text when it out-contrasts white (relative luminance above ~0.179)
export function barColors(hex: string): { fill: string; text: string } {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return { fill: ARGB.fallbackBar, text: ARGB.black };
  hex = lighter80(hex); // bars use Excel's "Lighter 80%" of the category color
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { fill: 'FF' + hex.slice(1).toUpperCase(), text: luminance > 0.179 ? ARGB.black : ARGB.white };
}

export function sheetName(projectName: string): string {
  // exceljs also rejects names wrapped in apostrophes and the reserved name "History"
  const name = projectName.replace(/[\\/?*[\]:]/g, '').slice(0, 31).replace(/^[\s']+|[\s']+$/g, '');
  return name && name !== 'History' ? name : 'Schedule';
}

export function exportFileName(projectName: string, today: Date): string {
  const yymmdd = `${String(today.getFullYear()).slice(2)}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
  return `${yymmdd}_${projectName.replace(/[\\/:*?"<>|]/g, '').trim() || 'Project'}_Schedule.xlsx`;
}

// rough glyph widths in Excel column units at 10pt; Hangul/CJK/emoji run about twice as wide as Latin
const glyphWidth = (ch: string) =>
  ch === ' ' ? 0.5 : /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/.test(ch) || ch.codePointAt(0)! > 0xffff ? 1.6 : 0.9;

// ponytail: estimates Excel's word wrap from glyph widths, because Excel won't auto-fit row heights we set.
// Tune glyphWidth if real files still clip.
export function textLines(text: string, size: number, width: number): number {
  const usable = width - 1.5; // cell padding
  const scale = size / 10;
  let lines = 0;
  for (const para of text.split('\n')) {
    lines++;
    let line = 0;
    for (const word of para.split(' ')) {
      const w = Array.from(word).reduce((sum, ch) => sum + glyphWidth(ch) * scale, 0);
      const needed = line > 0 ? line + 0.5 * scale + w : w;
      if (line > 0 && needed > usable) {
        lines++;
        line = w;
      } else {
        line = needed;
      }
      while (line > usable) { // a word wider than the cell breaks by character
        lines++;
        line -= usable;
      }
    }
  }
  return lines;
}

export function renderWorkbook(layout: Layout, projectName: string, today: Date): ExcelJS.Workbook {
  const { weeks, milestones, groups } = layout;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName(projectName), { views: [{ showGridLines: false, zoomScale: 96 }] });
  const lastCol = FIRST_WEEK_COL + weeks.length - 1;

  const bold = (size = 10): Partial<ExcelJS.Font> => ({ name: FONT_BOLD, size });
  const medium: Partial<ExcelJS.Font> = { name: FONT_MEDIUM, size: 10 };
  const center: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
  function put(r: number, c: number, value: ExcelJS.CellValue, font: Partial<ExcelJS.Font>, fill?: string, alignment = center) {
    const cell = ws.getCell(r, c);
    if (value !== null) cell.value = value;
    cell.font = font;
    cell.alignment = alignment;
    if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  }
  // mergeCells would make slaves share the master's style object, so later per-cell borders would clobber each other
  const merge = (top: number, left: number, bottom: number, right: number) => {
    if (bottom > top || right > left) ws.mergeCellsWithoutStyle(top, left, bottom, right);
  };

  ws.getColumn(1).width = 3.66;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 12.66;
  for (let c = FIRST_WEEK_COL; c <= lastCol; c++) ws.getColumn(c).width = 13.66;
  const spanWidth = (from: number, to: number) => {
    let w = 0;
    for (let c = from; c <= to; c++) w += ws.getColumn(c).width ?? 0;
    return w;
  };

  // title and updated date each get their own merged span so the date can't spill over the title.
  // ponytail: the date always takes the last two columns (~27 units fits "* YYYY.MM.DD Updated" at 14pt)
  const dateCol = Math.max(3, lastCol - 1);
  const titleLines = textLines(projectName, 22, spanWidth(2, dateCol - 1));
  ws.getRow(2).height = titleLines === 1 ? 33 : titleLines * 31;
  const updated = `* ${today.getFullYear()}.${pad(today.getMonth() + 1)}.${pad(today.getDate())} Updated`;
  for (let c = 2; c <= lastCol; c++) {
    if (c < dateCol) put(2, c, c === 2 ? projectName : null, bold(22), undefined, { horizontal: 'left', vertical: 'bottom', wrapText: true });
    else put(2, c, c === dateCol ? updated : null, { ...bold(14), color: { argb: ARGB.date } }, undefined, { horizontal: 'right', vertical: 'bottom' });
  }
  merge(2, 2, 2, dateCol - 1);
  merge(2, dateCol, 2, lastCol);

  // two-row header: 구분 / 상세 / month (merged) / week
  ws.getRow(4).height = 27.75;
  for (const r of [3, 4]) {
    put(r, 2, r === 3 ? '구분' : null, bold(), ARGB.header);
    put(r, 3, r === 3 ? '상세' : null, bold(), ARGB.header);
  }
  merge(3, 2, 4, 2);
  merge(3, 3, 4, 3);
  weeks.forEach((w, i) => {
    put(3, FIRST_WEEK_COL + i, w.month, bold(11), ARGB.header);
    put(4, FIRST_WEEK_COL + i, w.label, bold(), ARGB.header);
  });
  for (let i = 0; i < weeks.length; ) {
    let j = i;
    while (j + 1 < weeks.length && weeks[j + 1].monthKey === weeks[i].monthKey) j++;
    merge(3, FIRST_WEEK_COL + i, 3, FIRST_WEEK_COL + j);
    i = j + 1;
  }

  let row = 5;
  // one row, one unmerged cell per week; grows to fit the busiest week
  const msTop = row;
  ws.getRow(msTop).height = Math.max(43, ...milestones.map((t, i) => textLines(t, 10, ws.getColumn(FIRST_WEEK_COL + i).width ?? 0) * 14 + 4));
  milestones.forEach((t, i) => put(msTop, FIRST_WEEK_COL + i, t || null, bold(), ARGB.milestone));
  put(msTop, 2, MILESTONE_LABEL, bold(), ARGB.header);
  put(msTop, 3, null, bold(), ARGB.header);
  merge(msTop, 2, msTop, 3);
  const msBottom = row++;

  // writes the week area of one section's lanes; returns its first row
  function writeLanes(sec: Section): number {
    const top = row;
    for (let l = 0; l < sec.lanes; l++, row++) {
      ws.getRow(row).height = 30;
      for (let c = FIRST_WEEK_COL; c <= lastCol; c++) put(row, c, null, medium);
    }
    for (const bar of sec.bars) {
      const r = top + bar.lane;
      // grow the lane when the wrapped name + date line won't fit (10pt ≈ 14pt of row, 8pt ≈ 11.2pt, plus padding)
      const width = spanWidth(FIRST_WEEK_COL + bar.start, FIRST_WEEK_COL + bar.end);
      const needed = textLines(bar.name, 10, width) * 14 + textLines(`(${bar.dates})`, 8, width) * 11.2 + 4;
      ws.getRow(r).height = Math.max(ws.getRow(r).height ?? 0, needed);
      const c1 = FIRST_WEEK_COL + bar.start;
      const c2 = FIRST_WEEK_COL + bar.end;
      const { fill, text } = barColors(bar.color);
      const barFont = { ...medium, color: { argb: text } };
      // name on top, dates on a second, smaller line (rich text keeps both in one cell)
      const value = { richText: [{ text: bar.name, font: barFont }, { text: `\n(${bar.dates})`, font: { ...barFont, size: 8 } }] };
      for (let c = c1; c <= c2; c++) put(r, c, c === c1 ? value : null, barFont, fill);
      merge(r, c1, r, c2);
    }
    return top;
  }

  for (const g of groups) {
    const gTop = row;
    for (const s of g.sections) {
      const sTop = writeLanes(s);
      for (let r = sTop; r < row; r++) put(r, 3, r === sTop ? s.name : null, bold(), ARGB.side);
      merge(sTop, 3, row - 1, 3);
    }
    for (let r = gTop; r < row; r++) put(r, 2, r === gTop ? g.name : null, bold(), ARGB.side);
    merge(gTop, 2, row - 1, 2);
  }
  const lastRow = row - 1;

  // borders last, per cell: medium frame, double under the header, thin around 주요 일정 and the side columns, dotted inside
  for (let r = HEADER_ROW; r <= lastRow; r++) {
    for (let c = 2; c <= lastCol; c++) {
      const left = c === 2 ? 'medium' : c === 3 || c === FIRST_WEEK_COL ? 'thin' : 'dotted';
      const right = c === lastCol ? 'medium' : c <= 3 ? 'thin' : 'dotted';
      const top = r === HEADER_ROW ? 'medium' : r === 5 ? 'double' : r === 4 || r === msBottom + 1 ? 'thin' : 'dotted';
      const bottom = r === lastRow ? 'medium' : r === 4 ? 'double' : r === 3 || r === msBottom ? 'thin' : 'dotted';
      ws.getCell(r, c).border = {
        left: { style: left }, right: { style: right }, top: { style: top }, bottom: { style: bottom },
      };
    }
  }

  ws.getRow(lastRow + 2).height = 17.75;
  put(lastRow + 2, 2, FOOTNOTE, bold(11), undefined, { vertical: 'middle' });
  return wb;
}
