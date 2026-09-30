import KoreanLunarCalendar from 'korean-lunar-calendar';

interface Holiday {
  name: string;
  date: string;
}

const FIXED_HOLIDAYS: { month: number; day: number; name: string }[] = [
  { month: 1, day: 1, name: '신정' },
  { month: 3, day: 1, name: '삼일절' },
  { month: 5, day: 5, name: '어린이날' },
  { month: 6, day: 6, name: '현충일' },
  { month: 8, day: 15, name: '광복절' },
  { month: 10, day: 3, name: '개천절' },
  { month: 10, day: 9, name: '한글날' },
  { month: 12, day: 25, name: '크리스마스' },
];

// ponytail: lunar holidays defined as lunar dates, converted at runtime
const LUNAR_HOLIDAYS: { month: number; day: number; name: string; offsets?: number[] }[] = [
  { month: 1, day: 1, name: '설날', offsets: [-1, 0, 1] },
  { month: 4, day: 8, name: '부처님오신날' },
  { month: 8, day: 15, name: '추석', offsets: [-1, 0, 1] },
];

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function fmt(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function lunarToSolar(year: number, month: number, day: number): { year: number; month: number; day: number } | null {
  try {
    const cal = new KoreanLunarCalendar();
    cal.setLunarDate(year, month, day, false);
    const s = cal.getSolarCalendar();
    return { year: s.year, month: s.month, day: s.day };
  } catch {
    return null;
  }
}

function getDayOfWeek(y: number, m: number, d: number) {
  return new Date(y, m - 1, d).getDay();
}

function addDays(y: number, m: number, d: number, offset: number) {
  const date = new Date(y, m - 1, d + offset);
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

export function getHolidays(year: number): Holiday[] {
  const seen = new Set<string>();
  const holidays: Holiday[] = [];

  function add(date: string, name: string) {
    if (seen.has(date)) return;
    seen.add(date);
    holidays.push({ name, date });
  }

  for (const h of FIXED_HOLIDAYS) {
    add(fmt(year, h.month, h.day), h.name);
  }

  for (const lh of LUNAR_HOLIDAYS) {
    const offsets = lh.offsets ?? [0];
    for (const offset of offsets) {
      const base = addDays(year, lh.month, lh.day, offset);
      const solar = lunarToSolar(year, base.month === lh.month ? lh.month : lh.month, base.day);
      if (!solar) continue;
      // ponytail: recalculate with offset from the base lunar date
      const baseSolar = lunarToSolar(year, lh.month, lh.day);
      if (!baseSolar) continue;
      const shifted = addDays(baseSolar.year, baseSolar.month, baseSolar.day, offset);
      const label = offset === 0 ? lh.name : `${lh.name} 연휴`;
      add(fmt(shifted.year, shifted.month, shifted.day), label);
    }
  }

  // 대체공휴일: 공휴일이 일요일이면 다음 평일
  const holidayDates = new Set(holidays.map((h) => h.date));
  const substitutes: Holiday[] = [];
  for (const h of holidays) {
    const [y, m, d] = h.date.split('-').map(Number);
    if (getDayOfWeek(y, m, d) === 0 && h.name !== '신정') {
      let sub = addDays(y, m, d, 1);
      while (holidayDates.has(fmt(sub.year, sub.month, sub.day)) || getDayOfWeek(sub.year, sub.month, sub.day) === 0) {
        sub = addDays(sub.year, sub.month, sub.day, 1);
      }
      const subDate = fmt(sub.year, sub.month, sub.day);
      if (!holidayDates.has(subDate)) {
        substitutes.push({ name: `대체공휴일(${h.name})`, date: subDate });
        holidayDates.add(subDate);
      }
    }
  }

  return [...holidays, ...substitutes];
}

export function getHolidayMap(year: number): Map<string, string> {
  const map = new Map<string, string>();
  for (const h of getHolidays(year)) {
    map.set(h.date, h.name);
  }
  return map;
}
