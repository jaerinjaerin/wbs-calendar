import type { DayRange } from './monthStack';

export interface RectLike { left: number; top: number; width: number; height: number }
export interface Cell { date: string; rowIndex: number; col: number }

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function addDays(date: string, n: number): string {
  const d = toDate(date);
  d.setDate(d.getDate() + n);
  return fmt(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS);
}

// grab-point move: the grabbed day lands on `over`, both ends shift together
export function moveRange(range: DayRange, grab: string, over: string): DayRange {
  const n = daysBetween(grab, over);
  return { start: addDays(range.start, n), end: addDays(range.end, n) };
}

// Geometry, not elementFromPoint: event bars sit on top of the cells and hide the date.
// rows[i] is the rect of week row i, weeks[i] its date range (Sunday start).
export function cellAtPoint(x: number, y: number, rows: RectLike[], weeks: DayRange[]): Cell | null {
  for (let i = 0; i < rows.length && i < weeks.length; i++) {
    const r = rows[i];
    if (x < r.left || x >= r.left + r.width || y < r.top || y >= r.top + r.height) continue;
    const col = Math.min(6, Math.floor((x - r.left) / (r.width / 7)));
    return { date: addDays(weeks[i].start, col), rowIndex: i, col };
  }
  return null;
}

const DOW = '일월화수목금토';

export function dayLabel(date: string): string {
  const d = toDate(date);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
}
