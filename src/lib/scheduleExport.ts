import type { Task, WbsNode } from '@/types';

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

export const MILESTONE_WBS_NAME = '주요 일정';

export interface Week { monday: number; label: string; month: string; monthKey: string }
// start/end are week indexes into Layout.weeks, inclusive
export interface Bar { lane: number; start: number; end: number; text: string; color: string }
export interface Section { name: string; lanes: number; bars: Bar[] }
export interface Group { name: string; sections: Section[] }
export interface Layout { weeks: Week[]; milestones: Section; groups: Group[] }

interface Item { name: string; s: number; e: number; root: WbsNode; detail: WbsNode | null; color: string }

const md = (t: number) => `${new Date(t).getUTCMonth() + 1}/${new Date(t).getUTCDate()}`;
const bySort = (a: WbsNode, b: WbsNode) => a.sort_order - b.sort_order;
const isMilestone = (n: WbsNode) => n.name.trim() === MILESTONE_WBS_NAME;

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

  function section(name: string, list: Item[]): Section {
    const sorted = [...list].sort((x, y) => x.s - y.s || x.e - y.e || x.name.localeCompare(y.name));
    const laneEnds: number[] = []; // last occupied week index per lane
    const bars = sorted.map((i) => {
      const start = weekIndex(i.s);
      const end = weekIndex(i.e);
      let lane = laneEnds.findIndex((occupiedTo) => occupiedTo < start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = end;
      const text = i.s === i.e ? `${i.name}(${md(i.s)})` : `${i.name}(${md(i.s)}~${md(i.e)})`;
      return { lane, start, end, text, color: i.color };
    });
    return { name, lanes: Math.max(1, laneEnds.length), bars };
  }

  const roots = Array.from(new Set(items.map((i) => i.root))).sort(bySort);
  const groups: Group[] = roots.filter((r) => !isMilestone(r)).map((root) => {
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

  return { weeks, milestones: section(MILESTONE_WBS_NAME, items.filter((i) => isMilestone(i.root))), groups };
}
