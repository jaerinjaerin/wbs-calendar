// Mirrors Toast UI's month layout (getMatrices): per week, sort by start asc then
// longer first, drop each event into the first lane whose last event it doesn't overlap.
export interface DayRange { start: string; end: string } // YYYY-MM-DD, inclusive

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Sunday-start weeks covering the month (isAlways6Weeks: false)
export function monthWeeks(year: number, month: number): DayRange[] {
  const d = new Date(year, month, 1);
  d.setDate(1 - d.getDay());
  const last = new Date(year, month + 1, 0);
  const weeks: DayRange[] = [];
  while (d <= last) {
    const start = ymd(d);
    d.setDate(d.getDate() + 6);
    weeks.push({ start, end: ymd(d) });
    d.setDate(d.getDate() + 1);
  }
  return weeks;
}

const days = (r: DayRange) => Date.parse(r.end) - Date.parse(r.start);

export function maxStackDepth(events: DayRange[], weeks: DayRange[]): number {
  let max = 0;
  for (const w of weeks) {
    const inWeek = events
      .filter((e) => e.start <= w.end && e.end >= w.start)
      .sort((a, b) => a.start.localeCompare(b.start) || days(b) - days(a));
    const laneEnds: string[] = [];
    for (const e of inWeek) {
      const lane = laneEnds.findIndex((end) => end < e.start);
      if (lane === -1) laneEnds.push(e.end);
      else laneEnds[lane] = e.end;
    }
    max = Math.max(max, laneEnds.length);
  }
  return max;
}
