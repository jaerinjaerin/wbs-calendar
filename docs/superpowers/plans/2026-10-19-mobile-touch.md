# 모바일 터치 조작 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일(767px 이하)에서 작업 상세·추가를 하단 시트로 열고, 마우스 드래그를 "길게 눌러 옮기기"로 바꾼다. PC는 그대로 둔다.

**Architecture:** 날짜 계산과 칸 판정은 순수 함수(`src/lib/mobileDrag.ts`)로 두고 vitest로 테스트한다. 터치 처리는 `useLongPressDrag` 훅이 캘린더 컨테이너에 리스너를 직접 붙여서 맡는다. 미리보기는 Toast UI 인스턴스(`updateEvent`/`createEvents`)로만 그리고, 저장은 놓을 때 한 번만 한다. 하단 시트는 `BottomSheet` 컴포넌트 하나로 만들고, `TaskPeekPanel`·`TaskModal`이 모바일일 때만 그 안에 같은 내용을 렌더링한다.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Toast UI Calendar 2 (`@toast-ui/react-calendar`), vitest

**Spec:** `docs/superpowers/specs/2026-10-19-mobile-touch-design.md`

## Global Constraints

- PC(768px 이상)의 동작과 코드 경로는 바꾸지 않는다. 모바일 분기는 `useIsMobile()`이 `true`일 때만 탄다.
- 모바일 판정: `matchMedia('(max-width: 767px)')`. SSR 첫 렌더는 `false`.
- 길게 누르기: 450ms. 그 전에 10px 넘게 움직이면 취소(스크롤).
- 여러 날 작업 이동: 잡은 날 기준(`moveRange`).
- 새 의존성을 추가하지 않는다.
- 문구(그대로 쓴다): `+ 새로운 작업`, `되돌리기`, `날짜 위로 옮기세요`, `'{작업명}' {M월 D일 (요일)}로 이동`, 안내 `{M월 D일 (요일)} · +N일` / `· -N일` / `· 그대로`, 새 작업 안내 `{M월 D일 (요일)}에 추가`.
- 디자인 토큰은 `DESIGN.md` / `tailwind.config.js`를 따른다(`rounded-xl` 16px, `bg-canvas`, `bg-hairline` 등).
- 서버 액션은 놓을 때 한 번만 호출한다(Next가 서버 액션을 직렬로 보낸다).
- 커밋 메시지 끝에 붙인다:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01NfPfnEUdbRacZxAQSEFEhj
  ```

## Review Focus

1. 메모를 입력하던 중 시트 배경을 탭해서 닫는 경우 → 입력이 저장돼야 한다(iOS는 빈 곳을 탭해도 blur가 안 된다). Task 2의 Step 7에서 확인한다.
2. 들린 상태에서 손가락이 격자 밖(헤더)으로 나갔다가 거기서 놓는 경우 → 아무것도 바뀌지 않고 막대가 원래 자리로 돌아와야 한다. Task 3의 Step 7, 시나리오 E.
3. 첫 주·마지막 주의 회색 날짜(이전/다음 달)에 놓는 경우 → 그 날짜로 옮겨져야 한다. Task 1 `cellAtPoint` 테스트 + Task 3 시나리오 A.
4. 들린 상태에서 두 번째 손가락이 닿는 경우 → 취소되고 원래 자리로 돌아와야 한다. Task 3의 Step 7, 시나리오 F.
5. 공휴일 막대를 길게 누르는 경우 → 공휴일은 움직이지 않고, 빈 칸처럼 "+ 새로운 작업"이 들려야 한다. Task 3의 Step 7, 시나리오 G.

---

## File Structure

| 파일 | 역할 |
|---|---|
| Create `src/lib/mobileDrag.ts` | 순수 함수: `addDays`, `daysBetween`, `moveRange`, `cellAtPoint`, `dayLabel` |
| Create `src/lib/__tests__/mobileDrag.test.ts` | 위 함수 테스트 |
| Create `src/lib/useIsMobile.ts` | `matchMedia` 구독 훅 |
| Create `src/components/BottomSheet.tsx` | 하단 시트 껍데기 |
| Create `src/components/useLongPressDrag.ts` | 캘린더 컨테이너 터치 처리 훅 |
| Modify `tailwind.config.js` | `animate-sheet-up` 추가 |
| Modify `src/components/TaskPeekPanel.tsx` | 모바일이면 `BottomSheet`로 렌더링, `rowCls` 44px |
| Modify `src/components/TaskModal.tsx` | 모바일이면 `BottomSheet`로 렌더링, `autoFocus` 끔 |
| Modify `src/components/ProjectCalendar.tsx` | 모바일에서 투명 클릭 레이어 생략, `onMoveTask`/`onPickDate` 처리 |
| Modify `src/components/Toast.tsx` | `actionLabel` 옵션 |
| Modify `src/components/CalendarView.tsx` | 모바일에서 Toast UI 드래그 끄고 훅 연결, 오버레이·안내 표시 |
| Modify `src/app/globals.css` | 모바일에서 막대 `touch-action: none` |

## 로컬 실행 (Task 2, 3, 4의 확인 단계에서 사용)

배포 DB는 쓰지 않는다. 터미널 3개:

```bash
npm run db:setup   # 한 번만 (로컬 데이터 초기화)
npm run db:api     # PostgREST :3001
npm run dev        # Next :3100
```

시드 프로젝트 URL: `http://localhost:3100/%EC%B0%A8%EC%84%B8%EB%8C%80%20ERP%20%EA%B5%AC%EC%B6%95` ("차세대 ERP 구축"). 아래에서는 `PROJECT_URL`이라고 부른다. 시드 작업이 보이는 달로 이동해서 확인한다.

에뮬레이션 확인은 Playwright MCP의 `browser_run_code_unsafe`로 한다. 터치는 CDP `Input.dispatchTouchEvent`로 보낸다. `isMobile: false` + `hasTouch: true`로 컨텍스트를 만든다(`isMobile: true`는 viewport meta가 없는 페이지를 980px로 그려서 좌표가 어긋난다).

---

### Task 1: 날짜 계산 순수 함수

**Files:**
- Create: `src/lib/mobileDrag.ts`
- Test: `src/lib/__tests__/mobileDrag.test.ts`

**Interfaces:**
- Consumes: `DayRange` from `src/lib/monthStack.ts` (`{ start: string; end: string }`, YYYY-MM-DD, 양 끝 포함)
- Produces:
  - `addDays(date: string, n: number): string`
  - `daysBetween(from: string, to: string): number`
  - `moveRange(range: DayRange, grab: string, over: string): DayRange`
  - `interface RectLike { left: number; top: number; width: number; height: number }`
  - `interface Cell { date: string; rowIndex: number; col: number }`
  - `cellAtPoint(x: number, y: number, rows: RectLike[], weeks: DayRange[]): Cell | null`
  - `dayLabel(date: string): string` → `"10월 23일 (금)"`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/mobileDrag.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { addDays, daysBetween, moveRange, cellAtPoint, dayLabel } from '../mobileDrag';
import { monthWeeks } from '../monthStack';

describe('addDays / daysBetween', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-10-20', '2026-10-23')).toBe(3);
    expect(daysBetween('2026-10-23', '2026-10-20')).toBe(-3);
  });
});

describe('moveRange (grab-point)', () => {
  const range = { start: '2026-10-20', end: '2026-10-22' }; // 3 days

  it('shifts both ends by grab → over and keeps the length', () => {
    // grab day 3 (22nd), drop on 25th → +3
    expect(moveRange(range, '2026-10-22', '2026-10-25')).toEqual({ start: '2026-10-23', end: '2026-10-25' });
  });

  it('moves backwards', () => {
    expect(moveRange(range, '2026-10-20', '2026-10-10')).toEqual({ start: '2026-10-10', end: '2026-10-12' });
  });

  it('is unchanged when dropped on the grabbed day', () => {
    expect(moveRange(range, '2026-10-21', '2026-10-21')).toEqual(range);
  });

  it('crosses into the next month', () => {
    expect(moveRange({ start: '2026-10-30', end: '2026-10-30' }, '2026-10-30', '2026-11-02')).toEqual({ start: '2026-11-02', end: '2026-11-02' });
  });
});

describe('cellAtPoint', () => {
  const weeks = monthWeeks(2026, 9); // Oct 2026: rows start 09-27, 10-04, 10-11, 10-18, 10-25
  const rows = weeks.map((_, i) => ({ left: 10, top: 100 + i * 50, width: 350, height: 50 })); // 50px per column

  it('maps a point to row and column', () => {
    expect(cellAtPoint(10 + 50 * 2 + 1, 100 + 50 * 3 + 10, rows, weeks)).toEqual({ date: '2026-10-20', rowIndex: 3, col: 2 });
  });

  it('returns out-of-month dates in the first row', () => {
    expect(cellAtPoint(11, 101, rows, weeks)).toEqual({ date: '2026-09-27', rowIndex: 0, col: 0 });
  });

  it('clamps the right edge to Saturday', () => {
    expect(cellAtPoint(10 + 349.9, 101, rows, weeks)?.col).toBe(6);
  });

  it('is null outside the grid', () => {
    expect(cellAtPoint(5, 120, rows, weeks)).toBeNull();   // left of grid
    expect(cellAtPoint(100, 99, rows, weeks)).toBeNull();  // above (header)
    expect(cellAtPoint(100, 350, rows, weeks)).toBeNull(); // below last row
  });
});

describe('dayLabel', () => {
  it('formats month, day and weekday in Korean', () => {
    expect(dayLabel('2026-10-23')).toBe('10월 23일 (금)');
    expect(dayLabel('2026-10-18')).toBe('10월 18일 (일)');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/mobileDrag.test.ts`
Expected: FAIL — `Failed to resolve import "../mobileDrag"`

- [ ] **Step 3: 구현**

`src/lib/mobileDrag.ts`:

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/__tests__/mobileDrag.test.ts`
Expected: PASS (5 describe, 11 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/mobileDrag.ts src/lib/__tests__/mobileDrag.test.ts
git commit -m "feat: date math for mobile long-press drag

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NfPfnEUdbRacZxAQSEFEhj"
```

---

### Task 2: 하단 시트 (상세·추가)

**Files:**
- Create: `src/lib/useIsMobile.ts`
- Create: `src/components/BottomSheet.tsx`
- Modify: `tailwind.config.js` (`theme.extend`에 `keyframes`, `animation`)
- Modify: `src/components/TaskPeekPanel.tsx`
- Modify: `src/components/TaskModal.tsx`
- Modify: `src/components/ProjectCalendar.tsx:192-206` (투명 클릭 레이어)

**Interfaces:**
- Produces:
  - `useIsMobile(): boolean` (default export 아님, named export)
  - `BottomSheet` default export: `({ onClose, children }: { onClose: () => void; children: ReactNode }) => JSX.Element`

- [ ] **Step 1: `useIsMobile` 작성**

`src/lib/useIsMobile.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px)'; // Tailwind md breakpoint

// false on the server and first client render, then follows the media query
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}
```

- [ ] **Step 2: 시트 애니메이션 추가**

`tailwind.config.js`의 `theme.extend` 안, `boxShadow` 다음에 추가:

```js
      keyframes: {
        'sheet-up': { from: { transform: 'translateY(100%)' } },
      },
      animation: {
        'sheet-up': 'sheet-up 200ms ease-out',
      },
```

- [ ] **Step 3: `BottomSheet` 작성**

`src/components/BottomSheet.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';

interface BottomSheetProps {
  onClose: () => void;
  children: ReactNode;
}

// Mobile-only container for TaskPeekPanel / TaskModal. Esc is handled by those children.
export default function BottomSheet({ onClose, children }: BottomSheetProps) {
  function close() {
    // iOS doesn't blur an input when you tap empty space; blur so save-on-blur fields commit first
    (document.activeElement as HTMLElement | null)?.blur();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/30 flex flex-col justify-end" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-canvas rounded-t-xl max-h-[85dvh] overflow-y-auto px-md pt-xs pb-[calc(16px+env(safe-area-inset-bottom))] flex flex-col gap-xs animate-sheet-up motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-1 rounded-pill bg-hairline self-center mb-xxs shrink-0" />
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `TaskPeekPanel`을 모바일에서 시트로**

`src/components/TaskPeekPanel.tsx`:

1. import 추가:
```ts
import BottomSheet from './BottomSheet';
import { useIsMobile } from '@/lib/useIsMobile';
```
2. `rowCls`에 모바일 44px 추가(PC는 그대로 `min-h-9`):
```ts
export const rowCls = 'flex items-center gap-xs min-h-9 max-md:min-h-11 text-body-xs [&+&]:border-t [&+&]:border-hairline';
```
3. 컴포넌트 첫 줄(`const panelRef = ...` 위)에:
```ts
  const mobile = useIsMobile();
```
4. `return (` 이하를 다음 구조로 바꾼다. 안쪽 네 블록(제목+기간 / 속성 / 메모+URL / 삭제 버튼)의 JSX는 **지금 코드를 한 글자도 바꾸지 않고** `body`로 옮긴다:
```tsx
  const body = (
    <>
      {/* title + period */}
      {/* ...현재 108~141행 블록 그대로... */}

      {/* attributes */}
      {/* ...현재 144~176행 블록 그대로... */}

      {/* memo + url */}
      {/* ...현재 179~200행 블록 그대로... */}

      {/* ...현재 202~204행 삭제 버튼 블록 그대로... */}
    </>
  );

  if (mobile) return <BottomSheet onClose={onClose}>{body}</BottomSheet>;

  return (
    <div
      ref={panelRef}
      style={{ width: POPOVER_W, left, top }}
      className="fixed z-50 bg-canvas rounded-lg shadow-card border border-hairline p-xs flex flex-col gap-xs"
    >
      {body}
    </div>
  );
```
`useLayoutEffect` 두 개는 `panelRef.current`가 없으면 바로 return하므로 모바일에서도 그대로 둔다.

- [ ] **Step 5: `TaskModal`을 모바일에서 시트로**

`src/components/TaskModal.tsx`:

1. import 추가:
```ts
import BottomSheet from './BottomSheet';
import { useIsMobile } from '@/lib/useIsMobile';
```
2. 컴포넌트 첫 줄에 `const mobile = useIsMobile();`
3. 이름 input의 `autoFocus`를 `autoFocus={!mobile}`로 바꾼다(시트가 열리자마자 키보드가 화면을 가리지 않게).
4. `return (` 이하를 다음 구조로 바꾼다. `<form>` 안의 네 블록(제목+기간 / 속성 / 메모+URL / 버튼 줄)은 **그대로** `fields`로 옮긴다:
```tsx
  const fields = (
    <>
      {/* ...현재 72~97행 title + period 블록 그대로... */}
      {/* ...현재 99~132행 attributes 블록 그대로... */}
      {/* ...현재 134~150행 memo + url 블록 그대로... */}
      {/* ...현재 152~155행 버튼 줄 그대로... */}
    </>
  );

  if (mobile) {
    return (
      <BottomSheet onClose={onClose}>
        <form className="flex flex-col gap-sm" onSubmit={handleSubmit}>{fields}</form>
      </BottomSheet>
    );
  }

  return (
    <div className={modalOverlay} onClick={onClose}>
      <form
        className="w-[calc(100%-32px)] max-w-[460px] bg-canvas rounded-lg shadow-card p-md flex flex-col gap-sm"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        {fields}
      </form>
    </div>
  );
```

- [ ] **Step 6: `ProjectCalendar`에서 모바일 투명 레이어 생략**

`src/components/ProjectCalendar.tsx`:

1. import 추가: `import { useIsMobile } from '@/lib/useIsMobile';`
2. 컴포넌트 안 state 선언들 아래에 `const mobile = useIsMobile();`
3. 선택된 작업 블록(현재 192~206행)의 투명 레이어를 PC에서만 렌더링한다(모바일은 `BottomSheet` 배경이 대신한다):
```tsx
      {selectedTask && (
        <>
        {!mobile && <div className="fixed inset-0 z-40" onClick={() => setSelectedTaskId(null)} />}
        <TaskPeekPanel
          ...그대로...
        />
        </>
      )}
```

- [ ] **Step 7: 확인 (타입, 테스트, 화면)**

Run: `npx tsc --noEmit && npm test`
Expected: 오류 없음, 모든 테스트 PASS

로컬 실행(위 "로컬 실행" 참고) 후 Playwright MCP `browser_run_code_unsafe`로 확인한다. 이 Task에서는 길게 누르기 훅이 아직 없으므로 Toast UI의 클릭이 그대로 동작한다.

```js
async (page) => {
  const PROJECT_URL = 'http://localhost:3100/%EC%B0%A8%EC%84%B8%EB%8C%80%20ERP%20%EA%B5%AC%EC%B6%95';
  const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(PROJECT_URL);
  const block = p.locator('.toastui-calendar-weekday-event-block:not([data-calendar-id="_holiday"])').first();
  await block.waitFor();                 // 안 보이면 시드 작업이 있는 달로 '다음 달'을 눌러 이동
  await block.click();
  const sheet = p.locator('[role="dialog"]');
  const opened = await sheet.isVisible();
  // Review Focus 1: 메모 입력 후 배경 탭으로 닫으면 저장된다
  await sheet.locator('textarea').fill('시트 메모 테스트');
  await p.mouse.click(195, 40);          // 시트 위쪽 배경
  await p.waitForTimeout(1500);          // 저장 + 재조회
  await block.click();
  const memo = await p.locator('[role="dialog"] textarea').inputValue();
  await ctx.close();
  return { opened, memo };
}
```
Expected: `{ opened: true, memo: '시트 메모 테스트' }`

같은 방식으로 390px에서 헤더의 `+`(작업 추가) 버튼을 눌러 추가 폼이 `[role="dialog"]` 안에 뜨는지, 1024px에서는 기존 팝오버와 가운데 모달이 뜨는지(`[role="dialog"]` 없음) 확인한다.

- [ ] **Step 8: 커밋**

```bash
git add src/lib/useIsMobile.ts src/components/BottomSheet.tsx tailwind.config.js src/components/TaskPeekPanel.tsx src/components/TaskModal.tsx src/components/ProjectCalendar.tsx
git commit -m "feat: open task detail and add form as bottom sheets on mobile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NfPfnEUdbRacZxAQSEFEhj"
```

---

### Task 3: 길게 눌러 옮기기

**Files:**
- Create: `src/components/useLongPressDrag.ts`
- Modify: `src/components/Toast.tsx`
- Modify: `src/components/CalendarView.tsx`
- Modify: `src/components/ProjectCalendar.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: Task 1의 `moveRange`, `cellAtPoint`, `daysBetween`, `dayLabel`, `RectLike`; Task 2의 `useIsMobile`; `DayRange`, `monthWeeks` from `src/lib/monthStack.ts`
- Produces:
  - `useLongPressDrag(opts: LongPressOptions): DragOverlay | null`
  - `interface DragOverlay { box: { left: number; top: number; width: number; height: number } | null; hint: string }`
  - `NEW_CALENDAR_ID = '_new'`
  - `CalendarView` 새 props: `onMoveTask: (taskId: string, next: DayRange, prev: DayRange) => void`, `onPickDate: (date: string) => void`
  - `ToastData.actionLabel?: string`

- [ ] **Step 1: `Toast`에 버튼 문구 옵션**

`src/components/Toast.tsx`:

```ts
export type ToastData = { message: string; onRetry?: () => void; actionLabel?: string };
```
버튼 텍스트 `다시 시도`를 `{toast.actionLabel ?? '다시 시도'}`로 바꾼다. 기존 호출부는 건드리지 않는다.

- [ ] **Step 2: 모바일 막대 터치 CSS**

`src/app/globals.css` 맨 끝에 추가:

```css
/* Mobile long-press drag: a press on a bar must never start a native scroll,
   or the hold gets cancelled as "scrolling" (seen in the iPhone Claude app). */
@media (max-width: 767px) {
  .toastui-calendar-weekday-event-block { touch-action: none; }
}
```

- [ ] **Step 3: `useLongPressDrag` 작성**

`src/components/useLongPressDrag.ts`:

```ts
'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { DayRange } from '@/lib/monthStack';
import { cellAtPoint, moveRange, daysBetween, dayLabel } from '@/lib/mobileDrag';

const HOLD_MS = 450;
const SLOP = 10;
const NEW_EVENT_ID = '__new';
export const NEW_CALENDAR_ID = '_new';
const ROW_SEL = '.toastui-calendar-month-week-item';
const BLOCK_SEL = '.toastui-calendar-weekday-event-block';

export interface LongPressOptions {
  enabled: boolean;
  containerRef: RefObject<HTMLDivElement>;
  getInstance: () => any;
  weeks: DayRange[];
  getRange: (taskId: string) => DayRange | null;
  onTapTask: (taskId: string, rect: DOMRect) => void;
  onTapDate: (date: string) => void;
  onMoveTask: (taskId: string, next: DayRange, prev: DayRange) => void;
  onDropNew: (date: string) => void;
}

export interface DragOverlay {
  box: { left: number; top: number; width: number; height: number } | null;
  hint: string;
}

interface Drag {
  el: Element;          // element first touched; touch events keep targeting it even after a re-render detaches it
  x0: number;
  y0: number;
  startDate: string;
  taskId: string | null; // null = empty cell (or holiday) → new task
  calendarId: string | null;
  orig: DayRange | null;
  timer: ReturnType<typeof setTimeout>;
  lifted: boolean;
  over: string | null;
  style?: HTMLStyleElement;
}

// Mobile-only replacement for Toast UI's mouse drag. See spec 3.3 for the three touch rules this relies on.
export function useLongPressDrag(opts: LongPressOptions): DragOverlay | null {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [overlay, setOverlay] = useState<DragOverlay | null>(null);
  const { enabled, containerRef } = opts;

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;
    let drag: Drag | null = null;

    const inst = () => optsRef.current.getInstance();
    const rows = () => Array.from(container.querySelectorAll(ROW_SEL)).map((r) => r.getBoundingClientRect());
    const cellAt = (x: number, y: number) => cellAtPoint(x, y, rows(), optsRef.current.weeks);

    function boxOf(rowIndex: number, col: number) {
      const r = rows()[rowIndex];
      const c = container!.getBoundingClientRect();
      const w = r.width / 7;
      return { left: r.left - c.left + container!.scrollLeft + w * col, top: r.top - c.top + container!.scrollTop, width: w, height: r.height };
    }

    function hintFor(d: Drag, over: string) {
      if (!d.taskId) return `${dayLabel(over)}에 추가`;
      const n = daysBetween(d.startDate, over);
      return `${dayLabel(over)} · ${n === 0 ? '그대로' : `${n > 0 ? '+' : ''}${n}일`}`;
    }

    function haptic(inGesture: boolean) {
      try { if (navigator.vibrate?.(15)) return; } catch {}
      // iOS has no vibrate; the switch-input trick only works inside a real user gesture (touchend)
      if (inGesture) document.getElementById('haptic-switch')?.click();
    }

    // put the preview back where it started
    function revert(d: Drag) {
      if (d.taskId && d.orig) inst()?.updateEvent(d.taskId, d.calendarId, d.orig);
      else inst()?.deleteEvent(NEW_EVENT_ID, NEW_CALENDAR_ID);
    }

    function release(d: Drag) {
      clearTimeout(d.timer);
      d.style?.remove();
      d.el.removeEventListener('touchmove', onMove);
      d.el.removeEventListener('touchend', onEnd);
      d.el.removeEventListener('touchcancel', onCancel);
      drag = null;
      setOverlay(null);
    }

    function lift() {
      const d = drag;
      if (!d) return;
      d.lifted = true;
      haptic(false);
      const id = d.taskId ?? NEW_EVENT_ID;
      // a <style> survives Toast UI re-rendering the blocks, unlike classes set on them
      d.style = document.createElement('style');
      d.style.textContent =
        `${BLOCK_SEL}:not([data-event-id="${id}"]){opacity:.35}` +
        `${BLOCK_SEL}[data-event-id="${id}"]{z-index:5;filter:drop-shadow(0 4px 8px rgba(0,0,0,.25))}`;
      document.head.appendChild(d.style);
      if (!d.taskId) {
        inst()?.createEvents([{ id: NEW_EVENT_ID, calendarId: NEW_CALENDAR_ID, title: '+ 새로운 작업', start: d.startDate, end: d.startDate, category: 'allday' }]);
      }
      hover(d.x0, d.y0);
    }

    function hover(x: number, y: number) {
      const d = drag!;
      const cell = cellAt(x, y);
      if (!cell) {
        // outside the grid: dropping here changes nothing
        if (d.over !== null) {
          d.over = null;
          if (d.taskId && d.orig) inst()?.updateEvent(d.taskId, d.calendarId, d.orig);
        }
        setOverlay({ box: null, hint: '날짜 위로 옮기세요' });
        return;
      }
      if (cell.date === d.over) return;
      d.over = cell.date;
      if (d.taskId && d.orig) inst()?.updateEvent(d.taskId, d.calendarId, moveRange(d.orig, d.startDate, cell.date));
      else inst()?.updateEvent(NEW_EVENT_ID, NEW_CALENDAR_ID, { start: cell.date, end: cell.date });
      setOverlay({ box: boxOf(cell.rowIndex, cell.col), hint: hintFor(d, cell.date) });
    }

    function onStart(e: TouchEvent) {
      if (drag) { onCancel(); return; } // second finger
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const cell = cellAt(t.clientX, t.clientY);
      if (!cell) return;
      const el = e.target as Element;
      const block = el.closest<HTMLElement>(BLOCK_SEL);
      const calendarId = block?.dataset.calendarId ?? null;
      const taskId = block && calendarId !== '_holiday' && calendarId !== NEW_CALENDAR_ID ? block.dataset.eventId ?? null : null;
      drag = {
        el, x0: t.clientX, y0: t.clientY, startDate: cell.date,
        taskId, calendarId, orig: taskId ? optsRef.current.getRange(taskId) : null,
        timer: setTimeout(lift, HOLD_MS), lifted: false, over: null,
      };
      el.addEventListener('touchmove', onMove, { passive: false });
      el.addEventListener('touchend', onEnd, { passive: false });
      el.addEventListener('touchcancel', onCancel);
    }

    function onMove(e: TouchEvent) {
      const d = drag;
      if (!d) return;
      const t = e.touches[0];
      if (!d.lifted) {
        if (Math.hypot(t.clientX - d.x0, t.clientY - d.y0) > SLOP) release(d); // it's a scroll
        return;
      }
      e.preventDefault();
      hover(t.clientX, t.clientY);
    }

    function onEnd(e: TouchEvent) {
      const d = drag;
      if (!d) return;
      e.preventDefault(); // no synthetic mouse events → Toast UI's own click handling never fires
      release(d);
      const o = optsRef.current;
      if (!d.lifted) {
        if (d.taskId) {
          const bar = d.el.closest(BLOCK_SEL)?.querySelector('.toastui-calendar-weekday-event') ?? d.el;
          o.onTapTask(d.taskId, bar.getBoundingClientRect());
        } else {
          o.onTapDate(d.startDate);
        }
        return;
      }
      if (d.taskId && d.orig) {
        const next = d.over ? moveRange(d.orig, d.startDate, d.over) : d.orig;
        if (next.start === d.orig.start) { revert(d); return; }
        haptic(true);
        o.onMoveTask(d.taskId, next, d.orig);
      } else {
        inst()?.deleteEvent(NEW_EVENT_ID, NEW_CALENDAR_ID);
        if (d.over) { haptic(true); o.onDropNew(d.over); }
      }
    }

    function onCancel() {
      const d = drag;
      if (!d) return;
      release(d);
      if (d.lifted) revert(d);
    }

    // Registered up front: browsers decide at touchstart whether touchmove is cancelable,
    // so a listener added mid-gesture can't stop the scroll (empty-cell drags rely on this).
    const blockScroll = (e: TouchEvent) => { if (drag?.lifted) e.preventDefault(); };
    const noMenu = (e: Event) => e.preventDefault();

    container.addEventListener('touchstart', onStart, { passive: true });
    container.addEventListener('contextmenu', noMenu);
    document.addEventListener('touchmove', blockScroll, { passive: false });
    return () => {
      onCancel();
      container.removeEventListener('touchstart', onStart);
      container.removeEventListener('contextmenu', noMenu);
      document.removeEventListener('touchmove', blockScroll);
    };
  }, [enabled, containerRef]);

  return overlay;
}
```

- [ ] **Step 4: `CalendarView` 연결**

`src/components/CalendarView.tsx`:

1. import 추가:
```ts
import type { DayRange } from '@/lib/monthStack';
import { useIsMobile } from '@/lib/useIsMobile';
import { useLongPressDrag, NEW_CALENDAR_ID } from '@/components/useLongPressDrag';
```
`maxStackDepth, monthWeeks` import는 그대로 둔다.

2. props 인터페이스에 추가:
```ts
  onMoveTask: (taskId: string, next: DayRange, prev: DayRange) => void;
  onPickDate: (date: string) => void;
```
구조 분해에도 `onMoveTask, onPickDate`를 추가한다.

3. `calendars` 배열에 새 작업 미리보기용 캘린더를 추가한다:
```ts
    const calendars = [
      ...toCalendarInfos(wbsNodes),
      { id: '_holiday', name: '공휴일', backgroundColor: '#fef2f2', borderColor: '#ef4444' },
      { id: NEW_CALENDAR_ID, name: '새 작업', backgroundColor: '#ffffff', borderColor: '#111111' },
    ];
```

4. `const neededHeight = ...` 바로 아래에 훅 호출을 둔다(모든 훅 호출은 조건문 밖이어야 한다):
```ts
    const mobile = useIsMobile();
    const overlay = useLongPressDrag({
      enabled: mobile,
      containerRef,
      getInstance: () => calRef.current?.getInstance?.(),
      weeks,
      getRange: (id) => {
        const t = tasks.find((x) => x.id === id);
        return t ? { start: t.start_date, end: t.end_date } : null;
      },
      onTapTask: onClickEvent,
      onTapDate: onPickDate,
      onMoveTask,
      onDropNew: onPickDate,
    });
```
`containerRef`의 타입이 `useRef<HTMLDivElement>(null)`인지 확인한다(이미 그렇다).

5. 월 제목 자리에 끄는 중 안내를 대신 보여 준다:
```tsx
            <span className={`text-title-md md:text-title-lg ${overlay ? 'text-accent' : ''}`}>{overlay ? overlay.hint : dateLabel}</span>
```

6. 캘린더 컨테이너 div에 `relative`와 모바일 길게 누르기 메뉴 차단을 추가하고, 강조 오버레이와 iOS 진동용 숨은 스위치를 넣는다:
```tsx
        <div ref={containerRef} className="relative flex-1 overflow-auto p-2 md:p-4 md:px-5 max-md:select-none max-md:[-webkit-touch-callout:none]" onMouseDown={(e) => { mouseDownPos.current = { x: e.clientX, y: e.clientY }; }}>
          {overlay?.box && <div className="absolute z-[1] pointer-events-none rounded-sm bg-accent/15 ring-2 ring-accent" style={overlay.box} />}
          {mobile && (
            // iOS 18+ plays a haptic when a switch toggles; clicked from touchend only
            <label id="haptic-switch" aria-hidden="true" className="fixed -left-[9999px] opacity-0">
              <input type="checkbox" tabIndex={-1} {...{ switch: '' }} />
            </label>
          )}
          {CalendarComp && (
            <CalendarComp
              ...
```

7. `CalendarComp`에 모바일 옵션을 준다(PC에서는 기존과 같은 값):
```tsx
              isReadOnly={mobile}
              gridSelection={!mobile}
```
기존 `gridSelection={true}` 줄은 위 줄로 바꾼다.

- [ ] **Step 5: `ProjectCalendar`에서 저장·되돌리기·추가 처리**

`src/components/ProjectCalendar.tsx`:

1. import 추가:
```ts
import { dayLabel } from '@/lib/mobileDrag';
import type { DayRange } from '@/lib/monthStack';
```
2. `handleSaveTask` 위에 추가:
```ts
  // mobile long-press drop: save once, offer undo with the same update path
  function handleMoveTask(taskId: string, next: DayRange, prev: DayRange) {
    const name = tasks.find((t) => t.id === taskId)?.name ?? '작업';
    handleUpdateTask(taskId, { start_date: next.start, end_date: next.end });
    showToast({
      message: `'${name}' ${dayLabel(next.start)}로 이동`,
      actionLabel: '되돌리기',
      onRetry: () => { hideToast(); handleUpdateTask(taskId, { start_date: prev.start, end_date: prev.end }); },
    });
  }

  function openAddFor(date: string) {
    setModalDefaultStart(date); setModalDefaultEnd(date); setModalOpen(true);
  }
```
3. `<CalendarView ...>`에 props 추가:
```tsx
          onMoveTask={handleMoveTask}
          onPickDate={openAddFor}
```

- [ ] **Step 6: 타입·테스트 확인**

Run: `npx tsc --noEmit && npm test`
Expected: 오류 없음, 모든 테스트 PASS

- [ ] **Step 7: 터치 에뮬레이션 확인**

로컬 실행 후 Playwright MCP `browser_run_code_unsafe`. 아래 헬퍼를 각 시나리오 앞에 붙인다:

```js
async (page) => {
  const PROJECT_URL = 'http://localhost:3100/%EC%B0%A8%EC%84%B8%EB%8C%80%20ERP%20%EA%B5%AC%EC%B6%95';
  const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(PROJECT_URL);
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const hold = async (x, y) => { await touch('touchStart', x, y); await p.waitForTimeout(600); };
  const drag = async (x0, y0, x1, y1, steps = 5) => { for (let i = 1; i <= steps; i++) { await touch('touchMove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await p.waitForTimeout(30); } };
  const task = p.locator('.toastui-calendar-weekday-event-block:not([data-calendar-id="_holiday"])').first();
  await task.waitFor();
  // ---- 시나리오 본문 ----
}
```

**A. 막대 이동 + 되돌리기** (Review Focus 3: 마지막 주 회색 날짜로 놓기도 한 번 해 본다)
```js
  const id = await task.getAttribute('data-event-id');
  const b = await task.boundingBox();
  const x = b.x + 10, y = b.y + b.height / 2;
  await hold(x, y);
  const colW = (await p.locator('.toastui-calendar-month-week-item').first().boundingBox()).width / 7;
  await drag(x, y, x + colW * 2, y);
  const hint = await p.locator('span.text-accent').textContent();
  await touch('touchEnd');
  await p.waitForTimeout(1500);
  const toast = await p.locator('[role="status"]').textContent();
  await p.locator('[role="status"] button', { hasText: '되돌리기' }).click();
  await p.waitForTimeout(1500);
  return { id, hint, toast, errs };
```
Expected: `hint`가 `· +2일`로 끝남(그 주 토요일을 넘으면 다음 줄로 판정되니 같은 주 안에서 시작하는 막대를 고른다), `toast`에 `로 이동`과 `되돌리기`, `errs` 비어 있음. 되돌리기 후 막대가 원래 칸에 있다.

**B. 빈 칸 길게 눌러 추가**
```js
  const rows = p.locator('.toastui-calendar-month-week-item');
  const r = await rows.nth(3).boundingBox();
  const colW = r.width / 7;
  const x0 = r.x + colW * 2 + 5, y0 = r.y + 8;     // 넷째 줄 화요일 날짜 숫자 근처
  const r1 = await rows.nth(1).boundingBox();
  const x1 = r1.x + colW * 6 + 5, y1 = r1.y + 8;   // 둘째 줄 토요일
  await hold(x0, y0);
  await drag(x0, y0, x1, y1);
  const placeholder = await p.locator('[data-event-id="__new"]').count();
  await touch('touchEnd');
  await p.waitForTimeout(300);
  const dates = await p.locator('[role="dialog"] input[type="date"]').evaluateAll((els) => els.map((e) => e.value));
  const leftover = await p.locator('[data-event-id="__new"]').count();
  return { placeholder, dates, leftover, errs };
```
Expected: `placeholder >= 1`, `dates`가 둘째 줄 토요일 날짜 두 개(시작=종료), `leftover === 0`

**C. 들린 상태에서는 스크롤되지 않음 / 그냥 쓸어올리면 스크롤됨**
```js
  await p.setViewportSize({ width: 390, height: 500 });
  const sc = p.locator('.toastui-calendar-month-week-item').first();
  const scroller = await p.evaluateHandle(() => document.querySelector('.toastui-calendar-month-week-item').closest('.overflow-auto'));
  await scroller.evaluate((el) => { el.scrollTop = 60; });
  const r = await p.locator('.toastui-calendar-month-week-item').nth(2).boundingBox();
  const x = r.x + 20, y = r.y + 8;
  await hold(x, y); await drag(x, y, x, y - 120); 
  const s1 = await scroller.evaluate((el) => el.scrollTop);
  await touch('touchEnd'); await p.waitForTimeout(300);
  await p.keyboard.press('Escape');
  await touch('touchStart', x, y); await drag(x, y, x, y - 120, 6); await touch('touchEnd'); await p.waitForTimeout(300);
  const s2 = await scroller.evaluate((el) => el.scrollTop);
  return { s1, s2, errs };
```
Expected: `s1 === 60`, `s2 !== 60`(달력이 500px보다 길지 않아 스크롤이 없다면 이 시나리오는 시드 작업이 많은 달에서 하거나 높이를 더 줄인다)

**D. 짧은 탭**
```js
  const b = await task.boundingBox();
  await touch('touchStart', b.x + 10, b.y + 5); await touch('touchEnd');
  await p.waitForTimeout(300);
  const detail = await p.locator('[role="dialog"]').count();
  return { detail, errs };
```
Expected: `detail === 1`(상세 시트). 빈 칸 날짜 숫자를 짧게 탭하면 추가 시트가 그 날짜로 열린다.

**E. 격자 밖으로 끌고 가서 놓기** (Review Focus 2)
```js
  const before = await task.boundingBox();
  const x = before.x + 10, y = before.y + before.height / 2;
  await hold(x, y);
  await drag(x, y, x, 60);                       // 헤더 쪽
  const hint = await p.locator('span.text-accent').textContent();
  await touch('touchEnd'); await p.waitForTimeout(500);
  const after = await task.boundingBox();
  const toasts = await p.locator('[role="status"]').count();
  return { hint, same: Math.abs(after.x - before.x) < 2 && Math.abs(after.y - before.y) < 2, toasts, errs };
```
Expected: `hint === '날짜 위로 옮기세요'`, `same === true`, `toasts === 0`

**F. 두 번째 손가락** (Review Focus 4)
```js
  const before = await task.boundingBox();
  const x = before.x + 10, y = before.y + before.height / 2;
  await hold(x, y);
  const colW = (await p.locator('.toastui-calendar-month-week-item').first().boundingBox()).width / 7;
  await drag(x, y, x + colW, y);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x + colW, y }, { x: 200, y: 400 }] });
  await touch('touchEnd'); await p.waitForTimeout(500);
  const after = await task.boundingBox();
  return { same: Math.abs(after.x - before.x) < 2, toasts: await p.locator('[role="status"]').count(), errs };
```
Expected: `same === true`, `toasts === 0`

**G. 공휴일 막대 길게 누르기** (Review Focus 5) — 공휴일이 있는 달(예: 10월)로 이동한 뒤
```js
  const hol = p.locator('.toastui-calendar-weekday-event-block[data-calendar-id="_holiday"]').first();
  const hb = await hol.boundingBox();
  await hold(hb.x + 10, hb.y + hb.height / 2);
  const placeholder = await p.locator('[data-event-id="__new"]').count();
  await touch('touchEnd'); await p.waitForTimeout(300);
  const hb2 = await hol.boundingBox();
  return { placeholder, holidayStayed: Math.abs(hb2.x - hb.x) < 2, sheet: await p.locator('[role="dialog"]').count(), errs };
```
Expected: `placeholder >= 1`, `holidayStayed === true`, `sheet === 1`(누른 날짜로 추가 시트)

- [ ] **Step 8: 커밋**

```bash
git add src/components/useLongPressDrag.ts src/components/Toast.tsx src/components/CalendarView.tsx src/components/ProjectCalendar.tsx src/app/globals.css
git commit -m "feat: long-press to move tasks and pick dates on mobile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NfPfnEUdbRacZxAQSEFEhj"
```

---

### Task 4: PC 회귀 확인과 빌드

**Files:** 없음 (확인만. 문제가 나오면 해당 Task 파일을 고친다)

- [ ] **Step 1: 빌드와 린트**

Run: `npm run build && npm run lint && npm test`
Expected: 빌드 성공, 린트 오류 없음, 테스트 PASS

- [ ] **Step 2: PC 동작 확인 (1024px, 마우스)**

Playwright MCP로 `viewport: { width: 1024, height: 768 }`, `hasTouch` 없이:
1. 막대를 마우스로 끌어 다른 날짜에 놓기 → 날짜가 바뀐다(기존 동작).
2. 빈 칸 두 칸을 마우스로 드래그 → 가운데 추가 모달이 그 범위로 열린다.
3. 막대 클릭 → 막대 옆 팝오버(`[role="dialog"]` 없음, `.fixed.z-50` 패널)가 뜬다.
4. 헤더의 연도·월 제목이 평소처럼 보이고, `[data-event-id="__new"]`가 없다.

```js
async (page) => {
  const PROJECT_URL = 'http://localhost:3100/%EC%B0%A8%EC%84%B8%EB%8C%80%20ERP%20%EA%B5%AC%EC%B6%95';
  const ctx = await page.context().browser().newContext({ viewport: { width: 1024, height: 768 } });
  const p = await ctx.newPage();
  await p.goto(PROJECT_URL);
  const task = p.locator('.toastui-calendar-weekday-event-block:not([data-calendar-id="_holiday"])').first();
  await task.waitFor();
  await task.click();
  const popover = await p.locator('div.fixed.z-50').count();
  const sheet = await p.locator('[role="dialog"]').count();
  await ctx.close();
  return { popover, sheet };
}
```
Expected: `{ popover: 1, sheet: 0 }`. 1, 2번은 브라우저에서 직접 끌어서 확인한다.

- [ ] **Step 3: 실기기 확인 안내**

사용자에게 배포 전 Vercel Preview URL에서 iPhone(Claude 앱 또는 Safari)으로 Task 3의 A~D를 확인해 달라고 요청한다. 배포 DB 대상이므로 Preview에서 옮긴 작업은 되돌리기로 원복한다.
