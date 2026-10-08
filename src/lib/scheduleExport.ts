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
