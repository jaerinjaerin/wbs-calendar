import type { TaskStatus } from '@/types';

export interface OverviewTask { start_date: string; end_date: string; status: TaskStatus; color: string }
export interface Bar { lane: number; left: number; width: number; color: string } // left/width in % of the month
export interface ProjectOverview { bars: Bar[]; lanes: number; todayPct: number; dueThisWeek: number }

export const MAX_LANES = 5;

const DAY = 86_400_000;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

// Dates are YYYY-MM-DD strings in KST; math runs in UTC so the server's own timezone never matters.
export function seoulToday(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

// The span the home page needs tasks for: this month plus this ISO week (Mon–Sun), which can spill over either edge.
export function overviewWindow(today: string) {
  const t = ms(today);
  const d = new Date(t);
  const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const monthEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
  const weekStart = t - ((d.getUTCDay() + 6) % 7) * DAY;
  const weekEnd = weekStart + 6 * DAY;
  return {
    monthStart, monthEnd, weekStart, weekEnd,
    from: iso(Math.min(monthStart, weekStart)),
    to: iso(Math.max(monthEnd, weekEnd)),
  };
}

// Centre of a day on the month axis, in %; the home page puts its date ticks and today line here.
export function dayPct(date: string, today: string): number {
  const { monthStart, monthEnd } = overviewWindow(today);
  return (((ms(date) - monthStart) / DAY + 0.5) / ((monthEnd - monthStart) / DAY + 1)) * 100;
}

export function buildOverview(tasks: OverviewTask[], today: string): ProjectOverview {
  const { monthStart, monthEnd, weekStart, weekEnd } = overviewWindow(today);
  const days = (monthEnd - monthStart) / DAY + 1;

  const inMonth = tasks
    .filter((t) => ms(t.end_date) >= monthStart && ms(t.start_date) <= monthEnd)
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || b.end_date.localeCompare(a.end_date));

  // greedy lane packing: each task goes in the first lane whose last bar ended before it starts
  const laneEnds: number[] = [];
  const bars: Bar[] = [];
  for (const t of inMonth) {
    const s = Math.max(ms(t.start_date), monthStart);
    const e = Math.min(ms(t.end_date), monthEnd);
    let lane = laneEnds.findIndex((end) => end < s);
    if (lane === -1) lane = laneEnds.length;
    // ponytail: tasks past MAX_LANES are left off the minimap; it's a glance, not the calendar
    if (lane >= MAX_LANES) continue;
    laneEnds[lane] = e;
    bars.push({
      lane,
      left: ((s - monthStart) / DAY / days) * 100,
      width: (((e - s) / DAY + 1) / days) * 100,
      color: t.color,
    });
  }

  return {
    bars,
    lanes: laneEnds.length,
    todayPct: dayPct(today, today),
    dueThisWeek: tasks.filter((t) => t.status !== 'done' && ms(t.end_date) >= weekStart && ms(t.end_date) <= weekEnd).length,
  };
}
