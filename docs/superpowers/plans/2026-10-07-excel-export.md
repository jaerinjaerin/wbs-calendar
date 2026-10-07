# Excel 일정표 Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 헤더의 "Excel" 버튼 한 번으로 현재 프로젝트 Task를 레퍼런스(`260825_Tab S12F_Schedule_1.xlsx`)와 같은 주차별 간트형 `.xlsx`로 다운로드한다.

**Architecture:** `src/lib/scheduleExport.ts` 하나에 순수 로직을 둔다. 주차 계산 헬퍼 → `buildLayout()`(엑셀 무관 순수 계산) → `renderWorkbook()`(exceljs로 셀 값·병합·스타일 작성) 순서다. `ExportButtons`는 이 모듈을 동적 import해서 메인 번들에 exceljs가 들어가지 않게 하고, `writeBuffer()` → Blob으로 다운로드한다.

**Tech Stack:** Next.js 14 (App Router, client component), TypeScript, exceljs 4.4.0, vitest

**Spec:** `docs/superpowers/specs/2026-10-07-excel-export-design.md`

## Global Constraints

- 폰트: 값이 있는 모든 셀의 폰트 이름은 `Samsung SS Head KR Bold` 또는 `Samsung SS Head KR Medium`이어야 한다. 다른 폰트는 쓰지 않는다.
- 의존성: `exceljs` 추가, `xlsx` 제거. 다른 패키지는 추가하지 않는다.
- 주차 표기: ISO 8601 `W{n}`, 월요일 시작. 월 헤더는 `Jan`~`Dec`.
- 주의 월 귀속: 평일 5일 중 3일 이상이 속한 월 (= 수요일이 속한 월).
- 마일스톤 WBS 이름: `주요 일정` (depth 0, 앞뒤 공백 무시).
- 날짜 셀: `* YYYY.MM.DD Updated`. 각주: `* 상기 일정은 런칭 일정 및 프로젝트 진행상황에 따라 추후 변동 가능`.
- 파일명: `YYMMDD_<프로젝트명>_Schedule.xlsx`.
- UI 문구: 버튼 `Excel` / 진행 중 `내보내는 중…` / 비활성 툴팁 `내보낼 일정이 없습니다` / 실패 토스트 `엑셀 내보내기에 실패했습니다`.
- 색상: 헤더 `#B4C6E7`, 주요 일정 `#FFC000`, 구분/상세 `#F2F2F2`, 날짜 글자 `#0070C0`.
- exceljs 병합은 반드시 `mergeCellsWithoutStyle`을 쓴다. `mergeCells`는 slave 셀이 master의 style 객체를 **공유**하게 만들어서, 이후 셀별 테두리 지정이 master까지 덮어쓴다 (exceljs `lib/doc/cell.js` `merge()`).

## Review Focus

1. **다른 프로젝트의 Task가 섞여 들어옴.** `page.tsx`의 `loadData`는 `tasks`를 프로젝트 필터 없이 전부 가져온다. `wbsNodes`에 없는 `wbs_node_id`의 Task는 조용히 제외되어야 하고, 기간 계산에도 영향을 주면 안 된다. → Task 2 테스트
2. **날짜는 안 겹치지만 같은 주에 있는 Task.** 예: 7/6~7/8, 7/9~7/10. 엑셀 셀 단위는 주이므로 다른 레인으로 가야 한다. 같은 레인에 두면 병합이 충돌해 exceljs가 throw한다. → Task 2 테스트
3. **WBS `color`가 6자리 hex가 아님** (`#abc`, 빈 문자열 등). 내보내기가 실패하면 안 되고 회색 `#D9D9D9`로 대체한다. → Task 3 테스트
4. **프로젝트 이름에 시트/파일명 금지 문자가 있거나 31자를 넘음.** 시트명은 `\/?*[]:`를 제거하고 31자로 자르며, 비면 `Schedule`. 파일명은 `\/:*?"<>|`를 제거하고, 비면 `Project`. → Task 3 테스트
5. **이름에 공백이 붙은 `주요 일정` WBS, 또는 부모가 목록에 없는 WBS(orphan).** `' 주요 일정 '`은 마일스톤으로 인식한다. 부모가 없는 노드는 루트(구분)로 취급한다. → Task 2 테스트

---

## File Structure

| 파일 | 상태 | 책임 |
|---|---|---|
| `package.json` | Modify | `exceljs` 추가, `xlsx` 제거 |
| `src/lib/scheduleExport.ts` | Create | 주차 헬퍼, `buildLayout`, `renderWorkbook`, `barColors`, `sheetName`, `exportFileName` |
| `src/lib/__tests__/scheduleExport.test.ts` | Create | 위 함수 테스트 (node 환경) |
| `src/components/ExportButtons.tsx` | Modify (스텁 교체) | Excel 버튼, 다운로드, 실패 토스트 |
| `src/app/[projectName]/page.tsx` | Modify (139행) | `ExportButtons`에 `projectName` 전달 |
| `docs/superpowers/specs/2026-10-07-excel-export-design.md` | Modify | 글자색 임계값 0.5 → 0.179 정정 (Task 3) |

---

### Task 1: 의존성 교체 + 주차 헬퍼

**Files:**
- Modify: `package.json`
- Create: `src/lib/scheduleExport.ts`
- Test: `src/lib/__tests__/scheduleExport.test.ts`

**Interfaces:**
- Produces:
  - `DAY: number` (86_400_000)
  - `parseDay(s: string): number`: `'YYYY-MM-DD'` → 그 날짜 0시 UTC epoch ms
  - `mondayOf(t: number): number`: 같은 ISO 주의 월요일 (UTC ms)
  - `isoWeek(t: number): number`: ISO 주차 번호
  - `weekMonth(monday: number): { label: string; key: string }`: label=`'Jul'`, key=`'2026-6'`(연-0기준월, 병합 비교용)

- [ ] **Step 1: 의존성 교체**

```bash
npm uninstall xlsx && npm install exceljs@^4.4.0
```

Expected: `package.json` dependencies에 `"exceljs": "^4.4.0"`가 생기고 `"xlsx"`는 사라진다.

- [ ] **Step 2: 실패하는 테스트 작성**

`src/lib/__tests__/scheduleExport.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseDay, mondayOf, isoWeek, weekMonth } from '../scheduleExport';

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
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/__tests__/scheduleExport.test.ts`
Expected: FAIL. `Failed to resolve import "../scheduleExport"`

- [ ] **Step 4: 구현**

`src/lib/scheduleExport.ts`:

```ts
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
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/__tests__/scheduleExport.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json src/lib/scheduleExport.ts src/lib/__tests__/scheduleExport.test.ts
git commit -m "feat: add ISO week helpers for schedule export, swap xlsx for exceljs"
```

---

### Task 2: `buildLayout`: 주 목록, 행 구성, 레인 배치

**Files:**
- Modify: `src/lib/scheduleExport.ts` (Task 1 코드 아래에 추가)
- Test: `src/lib/__tests__/scheduleExport.test.ts`

**Interfaces:**
- Consumes: `DAY`, `parseDay`, `mondayOf`, `isoWeek`, `weekMonth` (Task 1)
- Produces:

```ts
export const MILESTONE_WBS_NAME = '주요 일정';
export interface Week { monday: number; label: string; month: string; monthKey: string } // label 'W28', month 'Jul'
export interface Bar { lane: number; start: number; end: number; text: string; color: string } // start/end: week index, inclusive
export interface Section { name: string; lanes: number; bars: Bar[] } // 상세 (or 주요 일정); lanes >= 1
export interface Group { name: string; sections: Section[] }          // 구분
export interface Layout { weeks: Week[]; milestones: Section; groups: Group[] }
export function buildLayout(tasks: Task[], wbsNodes: WbsNode[]): Layout
```

- [ ] **Step 1: 실패하는 테스트 작성**

테스트 파일 맨 위 import를 다음으로 바꾼다:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseDay, mondayOf, isoWeek, weekMonth, buildLayout } from '../scheduleExport';
import type { Task, WbsNode } from '@/types';
```

파일 끝에 다음을 추가한다. 이 `nodes`/`tasks` 픽스처는 Task 3에서도 쓴다.

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/scheduleExport.test.ts`
Expected: FAIL. `buildLayout is not a function` (또는 export 없음)

- [ ] **Step 3: 구현**

`src/lib/scheduleExport.ts` 맨 위에 import를 추가한다:

```ts
import type { Task, WbsNode } from '@/types';
```

파일 끝에 다음을 추가한다:

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/__tests__/scheduleExport.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/scheduleExport.ts src/lib/__tests__/scheduleExport.test.ts
git commit -m "feat: compute weekly gantt layout for schedule export"
```

---

### Task 3: `renderWorkbook` + 이름 헬퍼 + 바 색상

**Files:**
- Modify: `src/lib/scheduleExport.ts`
- Modify: `docs/superpowers/specs/2026-10-07-excel-export-design.md` (5.2절 표의 Task 바 행)
- Test: `src/lib/__tests__/scheduleExport.test.ts`

**Interfaces:**
- Consumes: `Layout`, `Section`, `MILESTONE_WBS_NAME`, `buildLayout` (Task 2). 테스트 픽스처 `nodes`, `tasks` (Task 2)
- Produces:
  - `barColors(hex: string): { fill: string; text: string }`: ARGB 문자열 (`'FF3563E9'`)
  - `sheetName(projectName: string): string`
  - `exportFileName(projectName: string, today: Date): string`
  - `renderWorkbook(layout: Layout, projectName: string, today: Date): ExcelJS.Workbook`

**레이아웃 좌표 (1-based):** A열은 여백, B(2)=구분, C(3)=상세, D(4)부터 주. 2행=제목/날짜, 3행=월, 4행=주차, 5행부터 주요 일정 레인, 그 아래 구분/상세 레인, 마지막 행 + 2에 각주.

- [ ] **Step 1: 스펙 정정**

`docs/superpowers/specs/2026-10-07-excel-export-design.md` 5.2절 표의 Task 바 행에서

`글자색은 배경 상대휘도 > 0.5면 \`#000000\`, 아니면 \`#FFFFFF\``

를

`글자색은 배경 상대휘도 > 0.179면 \`#000000\`, 아니면 \`#FFFFFF\` (흑/백 중 대비가 더 큰 쪽)`

으로 바꾼다. 0.5를 쓰면 `#1a9e8f` 같은 중간 밝기 색에 흰 글씨(대비 3.3)가 붙는다. 검정이면 대비가 6.3이다.

- [ ] **Step 2: 실패하는 테스트 작성**

import 줄을 다음으로 바꾼다:

```ts
import ExcelJS from 'exceljs';
import {
  parseDay, mondayOf, isoWeek, weekMonth, buildLayout,
  barColors, sheetName, exportFileName, renderWorkbook,
} from '../scheduleExport';
```

파일 끝에 다음을 추가한다:

```ts
describe('naming and colors', () => {
  it('picks the higher-contrast text color and falls back on bad hex', () => {
    expect(barColors('#3563e9')).toEqual({ fill: 'FF3563E9', text: 'FFFFFFFF' });
    expect(barColors('#f6c344')).toEqual({ fill: 'FFF6C344', text: 'FF000000' });
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
    await back.xlsx.load((await wb.xlsx.writeBuffer()) as Buffer);
    return back.worksheets[0];
  }

  it('writes title, date, headers and footer where the reference has them', async () => {
    const ws = await roundTrip();
    expect(ws.name).toBe('GalaxyTab');
    expect(ws.views[0].showGridLines).toBe(false);
    expect(ws.getCell('B2').value).toBe('Galaxy/Tab');
    expect(ws.getCell('H2').value).toBe('* 2026.10.07 Updated'); // last week column (W32)
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
    expect(ws.getCell('E5').value).toBe('1차 검증(7/10)');
    expect((ws.getCell('E5').fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFFFC000');

    expect(ws.getCell('B6').value).toBe('Tab S12F 리테일모드');
    expect(ws.getCell('B8').master.address).toBe('B6');  // 구분 spans 체험앱(1 lane) + 스크린세이버(2 lanes)
    expect(ws.getCell('C6').value).toBe('체험앱 컨텐츠');
    expect(ws.getCell('C7').value).toBe('스크린세이버');
    expect(ws.getCell('C8').master.address).toBe('C7');

    expect(ws.getCell('D7').value).toBe('스토리보드 제안(7/7~7/24)');
    expect(ws.getCell('F7').master.address).toBe('D7');
    expect((ws.getCell('F7').fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FF1A9E8F');
    expect(ws.getCell('D8').value).toBe('월페 입수(7/8)');
    expect(ws.getCell('E6').value).toBe('1차 작업 진행(7/14~7/31)');
    expect(ws.getCell('G6').master.address).toBe('E6');

    expect(ws.getCell('B9').value).toBe('카피');
    expect(ws.getCell('C9').value).toBe('-');
    expect(ws.getCell('F9').value).toBe('법인리뷰(7/20~7/24)');
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
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/__tests__/scheduleExport.test.ts`
Expected: FAIL. `barColors`/`sheetName`/`exportFileName`/`renderWorkbook` export 없음

- [ ] **Step 4: 구현**

`src/lib/scheduleExport.ts` 맨 위 import를 다음으로 만든다:

```ts
import ExcelJS from 'exceljs';
import type { Task, WbsNode } from '@/types';
```

파일 끝에 다음을 추가한다:

```ts
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
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { fill: 'FF' + hex.slice(1).toUpperCase(), text: luminance > 0.179 ? ARGB.black : ARGB.white };
}

export function sheetName(projectName: string): string {
  return projectName.replace(/[\\/?*[\]:]/g, '').trim().slice(0, 31) || 'Schedule';
}

export function exportFileName(projectName: string, today: Date): string {
  const yymmdd = `${String(today.getFullYear()).slice(2)}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
  return `${yymmdd}_${projectName.replace(/[\\/:*?"<>|]/g, '').trim() || 'Project'}_Schedule.xlsx`;
}

export function renderWorkbook(layout: Layout, projectName: string, today: Date): ExcelJS.Workbook {
  const { weeks, milestones, groups } = layout;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName(projectName), { views: [{ showGridLines: false, zoomScale: 96 }] });
  const lastCol = FIRST_WEEK_COL + weeks.length - 1;

  const bold = (size = 10): Partial<ExcelJS.Font> => ({ name: FONT_BOLD, size });
  const medium: Partial<ExcelJS.Font> = { name: FONT_MEDIUM, size: 10 };
  const center: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
  function put(r: number, c: number, value: string | null, font: Partial<ExcelJS.Font>, fill?: string, alignment = center) {
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

  // title + updated date
  ws.getRow(2).height = 33;
  put(2, 2, projectName, bold(22), undefined, { vertical: 'bottom' });
  put(2, lastCol, `* ${today.getFullYear()}.${pad(today.getMonth() + 1)}.${pad(today.getDate())} Updated`,
    { ...bold(14), color: { argb: ARGB.date } }, undefined, { horizontal: 'right', vertical: 'bottom' });

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
  // writes the week area of one section's lanes; returns its first row
  function writeLanes(sec: Section, isMilestone: boolean): number {
    const top = row;
    const font = isMilestone ? bold() : medium;
    for (let l = 0; l < sec.lanes; l++, row++) {
      ws.getRow(row).height = isMilestone ? 43 : 30;
      for (let c = FIRST_WEEK_COL; c <= lastCol; c++) put(row, c, null, font, isMilestone ? ARGB.milestone : undefined);
    }
    for (const bar of sec.bars) {
      const r = top + bar.lane;
      const c1 = FIRST_WEEK_COL + bar.start;
      const c2 = FIRST_WEEK_COL + bar.end;
      const { fill, text } = isMilestone ? { fill: ARGB.milestone, text: ARGB.black } : barColors(bar.color);
      for (let c = c1; c <= c2; c++) put(r, c, c === c1 ? bar.text : null, { ...font, color: { argb: text } }, fill);
      merge(r, c1, r, c2);
    }
    return top;
  }

  const msTop = writeLanes(milestones, true);
  for (let r = msTop; r < row; r++) {
    put(r, 2, r === msTop ? MILESTONE_WBS_NAME : null, bold(), ARGB.header);
    put(r, 3, null, bold(), ARGB.header);
  }
  merge(msTop, 2, row - 1, 3);
  const msBottom = row - 1;

  for (const g of groups) {
    const gTop = row;
    for (const s of g.sections) {
      const sTop = writeLanes(s, false);
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
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/__tests__/scheduleExport.test.ts`
Expected: PASS (20 tests)

border 테스트가 `undefined`로 실패하면 `merge` 헬퍼가 `mergeCells`를 쓰고 있는지 먼저 확인한다 (Global Constraints 참고).

- [ ] **Step 6: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 7: 커밋**

```bash
git add src/lib/scheduleExport.ts src/lib/__tests__/scheduleExport.test.ts docs/superpowers/specs/2026-10-07-excel-export-design.md
git commit -m "feat: render schedule layout to styled xlsx with Samsung SS Head KR"
```

---

### Task 4: Excel 버튼 연결

**Files:**
- Modify: `src/components/ExportButtons.tsx` (전체 교체)
- Modify: `src/app/[projectName]/page.tsx:139`

**Interfaces:**
- Consumes: `buildLayout`, `renderWorkbook`, `exportFileName` from `@/lib/scheduleExport` (동적 import). `useToast` from `./Toast` (`showToast({ message })`, `toastNode`)
- Produces: `ExportButtons` props에 `projectName: string` 추가. `users`와 `calendarRef`는 받기만 하고 쓰지 않는다 (스펙 3장).

- [ ] **Step 1: `ExportButtons.tsx` 교체**

```tsx
'use client';

import { useState } from 'react';
import type { RefObject } from 'react';
import type { Task, WbsNode, User } from '@/types';
import type { CalendarViewHandle } from './CalendarView';
import { useToast } from './Toast';

interface ExportButtonsProps {
  tasks: Task[];
  wbsNodes: WbsNode[];
  users: User[];
  calendarRef: RefObject<CalendarViewHandle>;
  projectName: string;
}

export default function ExportButtons({ tasks, wbsNodes, projectName }: ExportButtonsProps) {
  const [busy, setBusy] = useState(false);
  const { showToast, toastNode } = useToast();
  const nodeIds = new Set(wbsNodes.map((n) => n.id));
  const empty = !tasks.some((t) => nodeIds.has(t.wbs_node_id));

  async function handleExport() {
    setBusy(true);
    try {
      // dynamic import keeps exceljs out of the main bundle
      const { buildLayout, renderWorkbook, exportFileName } = await import('@/lib/scheduleExport');
      const today = new Date();
      const buffer = await renderWorkbook(buildLayout(tasks, wbsNodes), projectName, today).xlsx.writeBuffer();
      const url = URL.createObjectURL(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName(projectName, today);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error(e);
      showToast({ message: '엑셀 내보내기에 실패했습니다' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="px-2.5 md:px-3.5 py-1.5 rounded-md text-[11px] md:text-xs font-medium border border-white/10 bg-white/[0.08] text-on-dark cursor-pointer disabled:opacity-40 disabled:cursor-default"
        disabled={empty || busy}
        title={empty ? '내보낼 일정이 없습니다' : undefined}
        onClick={handleExport}
      >
        {busy ? '내보내는 중…' : 'Excel'}
      </button>
      {toastNode}
    </>
  );
}
```

- [ ] **Step 2: page에서 `projectName` 전달**

`src/app/[projectName]/page.tsx` 139행을

```tsx
          <ExportButtons tasks={filteredTasks()} wbsNodes={wbsNodes} users={users} calendarRef={calendarRef} />
```

다음으로 바꾼다:

```tsx
          <ExportButtons tasks={filteredTasks()} wbsNodes={wbsNodes} users={users} calendarRef={calendarRef} projectName={projectName} />
```

- [ ] **Step 3: 타입 체크, 전체 테스트, 빌드**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: 타입 에러 없음, 모든 테스트 PASS, 빌드 성공. 빌드 로그에서 `/[projectName]` 라우트의 First Load JS가 exceljs(약 900KB)만큼 커지지 않았는지 확인한다. 동적 import라서 별도 chunk로 빠져야 한다.

- [ ] **Step 4: 브라우저 수동 확인**

1. `npm run dev` → `http://localhost:3100/<프로젝트명>` 접속
2. 헤더의 `Excel` 버튼 클릭 → `YYMMDD_<프로젝트명>_Schedule.xlsx` 다운로드 확인
3. Excel(또는 Numbers)에서 열어 레퍼런스 `260825_Tab S12F_Schedule_1.xlsx`와 나란히 비교
   - 2단 헤더, 노란 주요 일정, 회색 구분/상세, 바 병합, 테두리(외곽 굵은선, 헤더 하단 이중선, 내부 점선), 눈금선 숨김
   - 셀 폰트가 `Samsung SS Head KR Bold`/`Medium`으로 표시되는지 (폰트가 설치된 PC에서)
4. 사이드바에서 모든 WBS 체크 해제 → 버튼 비활성화, 툴팁 `내보낼 일정이 없습니다`

- [ ] **Step 5: 커밋**

```bash
git add src/components/ExportButtons.tsx "src/app/[projectName]/page.tsx"
git commit -m "feat: Excel export button in project header"
```
