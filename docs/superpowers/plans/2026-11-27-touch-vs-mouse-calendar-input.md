# 달력 조작: 입력 장치 기준 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 터치 로직은 터치스크린 기기에서, 마우스 로직은 폰 화면이 아닐 때 켜서 아이패드에서 둘 다 동작하게 한다.

**Architecture:** `useHasTouch` 훅 하나를 추가하고 `CalendarView`에서 터치 관련 조건만 `mobile` → `touch`로 바꾼다. 마우스 로직 조건(`isReadOnly`, `gridSelection`)과 화면 배치는 그대로.

**Tech Stack:** Next.js 14, React, Toast UI Calendar, Tailwind

**Spec:** `docs/superpowers/specs/2026-11-27-touch-vs-mouse-calendar-input-design.md`

## Global Constraints

- 화면 배치 기준은 768px(`useIsMobile`) 그대로. `TaskModal`, `TaskPeekPanel`, `ProjectCalendar`는 건드리지 않는다.
- 폰(<768px, 터치)과 일반 PC(≥768px, 터치 없음)의 동작은 바뀌면 안 된다.

## Review Focus

- 아이패드 손가락 탭 한 번이 Toast UI 클릭으로도 처리되어 두 번 반응하는 경우 — 터치 로직의 touchend `preventDefault`가 막아야 한다.
- 아이패드에서 길게 누를 때 글자 선택·iOS 메뉴가 뜨는 경우 — 선택 방지 CSS가 터치 기기에 적용돼야 한다.
- 마우스로 빈 날짜를 드래그할 때 터치 로직이 끼어드는 경우 — 터치 로직은 touch 이벤트만 듣는다.
- 첫 렌더(서버)에서 터치 여부를 모를 때 — false로 시작해 마운트 후 갱신, 하이드레이션 경고 없어야 한다.
- 트랙패드 없는 아이패드 세로(≥768px)에서 상세가 열린 채 날짜 탭 — 투명 덮개가 상세만 닫아야 한다.

---

### Task 1: 터치 판별 훅과 CalendarView 조건 분리

**Files:**
- Create: `src/lib/useHasTouch.ts`
- Modify: `src/components/CalendarView.tsx` (149-151, 189, 191)

**Interfaces:**
- Produces: `useHasTouch(): boolean` — 서버와 첫 렌더는 `false`, 마운트 후 `navigator.maxTouchPoints > 0`.

- [ ] **Step 1: `useHasTouch` 작성** — `useIsMobile`과 같은 패턴(useState false → useEffect에서 설정). 값이 바뀌지 않으니 리스너는 없다.
- [ ] **Step 2: `CalendarView` 수정**
  - `const touch = useHasTouch();`
  - `useLongPressDrag({ enabled: touch, ... })`
  - 진동 스위치 `{touch && (...)}`
  - 컨테이너의 `max-md:select-none max-md:[-webkit-touch-callout:none]` → `touch`일 때 `select-none [-webkit-touch-callout:none]`
  - `isReadOnly={mobile}`, `gridSelection={!mobile}`는 그대로.
- [ ] **Step 3: 타입 검사·테스트** — `npx tsc --noEmit && npx vitest run` 통과.
- [ ] **Step 4: 브라우저 확인**
  - 데스크톱(터치 없음): 드래그 범위 선택 → 새 작업 창, 막대 드래그 이동.
  - 태블릿 크기 + 터치 흉내(maxTouchPoints > 0): 빈 날짜 탭 → 하루짜리 새 작업 창 한 번만, 마우스 드래그 범위 선택도 동작.
  - 모바일 375px: 기존 탭 생성 그대로.
- [ ] **Step 5: Commit**

```bash
git add src/lib/useHasTouch.ts src/components/CalendarView.tsx docs/superpowers/specs/2026-11-27-touch-vs-mouse-calendar-input-design.md docs/superpowers/plans/2026-11-27-touch-vs-mouse-calendar-input.md
git commit -m "fix: enable touch gestures on touchscreen tablets alongside mouse"
```
