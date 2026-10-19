# 모바일 터치 조작 설계

- 작성일: 2026-10-19
- 목업: https://claude.ai/artifact/Cq8w48rvythDNzEV67s4FN (버전 5 기준으로 확정)

## 1. 목표

모바일에서 마우스 드래그를 전제로 한 조작(범위 선택으로 작업 추가, 막대 드래그로 날짜 변경)을 터치에 맞는 방식으로 바꾼다. 모바일 사용 목적은 **조회 + 가벼운 편집**(작업 추가, 날짜·담당자·상태 변경)이다.

**전제**: PC 화면(768px 이상)의 동작과 코드 경로는 바꾸지 않는다.

**성공 기준**
- 작업 막대를 0.45초 누르면 들리고, 끄는 동안 막대가 손가락 아래 날짜로 실시간으로 따라온다. 손을 떼면 그 날짜로 저장되고 "되돌리기" 토스트가 뜬다.
- 빈 칸을 0.45초 누르면 "+ 새로운 작업" 임시 막대가 들리고, 손을 뗀 날짜로 추가 시트가 열린다.
- 들린 상태에서 끄는 동안 화면이 스크롤되지 않는다. 길게 누르기 전에 움직이면 평소처럼 스크롤된다.
- 작업 상세(수정)와 작업 추가가 모바일에서 하단 시트로 열린다.
- PC에서의 드래그, 범위 선택, 팝오버, 가운데 모달은 이전과 똑같이 동작한다.

**범위 밖**
- 화면 가장자리로 끌면 다음/이전 달로 넘어가는 기능
- 하단 시트를 아래로 쓸어내려 닫는 제스처
- WBS 트리(사이드바)의 터치 개선 (hover 버튼, 더블클릭 수정)
- 주간/목록 등 새 뷰

## 2. 확정된 결정

| 항목 | 결정 |
|---|---|
| 모바일 판정 | `matchMedia('(max-width: 767px)')` (Tailwind `md` 미만) |
| 드래그 대체 | 길게 누르기(0.45초) 후 끌기. 방법 A(탭 + 시트만)와 비교 후 선택 |
| 활성 날짜 | 손가락 아래 날짜 한 칸만 강조 (범위를 칠하지 않음) |
| 여러 날 작업 이동 기준 | **잡은 날 기준**: 잡은 칸에서 놓은 칸까지의 일수만큼 시작·종료를 함께 이동 (iOS 캘린더와 같음) |
| 끄는 중 표시 | 막대가 실시간으로 이동(저장하지 않음), 놓을 때 한 번만 저장 |
| 빈 칸 길게 누르기 | 놓은 날짜 하루로 추가 시트를 연다 (기간 선택 아님) |
| 짧은 탭 | 막대 → 상세 시트, 빈 칸 → 그 날짜로 추가 시트 |
| 진동 | Android: 들릴 때 `navigator.vibrate`. iOS: 웹 진동 API가 없어서, 놓을 때(사용자 제스처 안) iOS 18+ switch 우회만 시도 |
| 실수 방지 | 놓은 뒤 "되돌리기" 토스트 (6초) |

## 3. 설계

### 3.1 모바일 판정 — `src/lib/useIsMobile.ts`

```ts
export function useIsMobile(): boolean // matchMedia 구독, SSR 첫 렌더는 false
```

SSR 첫 렌더는 `false`(PC)로 그린 뒤 마운트 후 갱신한다. 캘린더는 이미 클라이언트에서 지연 로드되므로 깜빡임 문제는 없다.

### 3.2 날짜 계산 — `src/lib/mobileDrag.ts` (순수 함수)

```ts
// 잡은 날 기준 이동: grab → over 일수만큼 start/end를 함께 민다
export function moveRange(range: DayRange, grab: string, over: string): DayRange
```

`DayRange`는 `monthStack.ts`의 타입을 재사용한다. vitest로 테스트한다(같은 날, 앞/뒤 이동, 월 경계, 여러 날 작업).

### 3.3 길게 눌러 옮기기 — `CalendarView`

모바일일 때만:
- Toast UI 옵션: `isReadOnly: true`(라이브러리 드래그·리사이즈 끔), `gridSelection: false`.
- 캘린더 컨테이너(`containerRef`)에 직접 만든 터치 처리기를 붙인다. 상태: `idle → pressing → lifted → idle`.

**날짜 판정**: `elementFromPoint`를 쓰지 않는다(막대가 칸 위를 덮어 날짜를 못 찾는다, 목업에서 확인). 주(week) 행 DOM의 rect로 행을 찾고, `floor((x - left) / (width / 7))`로 열을 구한다. 행 i의 첫 날짜는 `monthWeeks(viewMonth)`의 i번째 `start`.

**흐름**
1. `touchstart`(1개 손가락): 대상이 막대(`[data-event-id]`, 공휴일 제외)인지 빈 칸인지 기록하고 450ms 타이머를 시작한다.
2. 타이머 전에 10px 넘게 움직이면 취소한다(스크롤로 판단).
3. 타이머가 끝나면 `lifted`: 진동(Android), 막대 강조, 다른 막대 흐리게, 안내 문구 표시(아래 "표시" 참고).
4. `touchmove`(lifted): 손가락 아래 날짜가 바뀔 때마다
   - 막대: `inst.updateEvent(id, calendarId, moveRange(...))`로 미리보기만 한다.
   - 빈 칸: 임시 이벤트 `__new`를 `inst.createEvents` / `updateEvent`로 그 날짜에 둔다.
5. `touchend`:
   - 짧은 탭: 막대면 `onClickEvent(id, rect)`, 빈 칸이면 `onPickDate(date)`.
   - 막대를 놓음: 날짜가 바뀌었으면 `onMoveTask(id, next, prev)`를 한 번 호출한다. 그대로면 미리보기를 원래대로 되돌린다.
   - 빈 칸을 놓음: `__new`를 지우고 `onPickDate(놓은 날짜)`.
6. `touchcancel` / 멀티터치: 미리보기를 원래대로 되돌리고 `idle`.
7. 들린 상태에서 손가락이 캘린더 격자 밖(헤더 등)으로 나가면 미리보기를 원래 자리로 되돌리고 안내를 "날짜 위로 옮기세요"로 바꾼다. 그 상태에서 놓으면 아무것도 바뀌지 않는다.
8. 공휴일 막대를 누르면 빈 칸과 같이 처리한다(공휴일은 옮길 수 없다).

**표시**: 강조 칸은 컨테이너 안의 절대 위치 오버레이로 그린다. 안내 문구("10월 23일 (금) · +3일")는 끄는 동안 헤더의 "2026년 10월" 자리에 대신 표시한다. 목업의 손가락 위 칩은 막대가 실시간으로 움직이므로 넣지 않는다.

**목업에서 확인한 필수 규칙**
- 막대에 `touch-action: none`을 주지 않는다. 처음에는 누르는 순간 네이티브 스크롤이 시작되어 길게 누르기가 취소되던 문제(Claude 앱 iPhone)를 막으려고 넣었지만, 막대에서 시작한 스크롤까지 막혀서 뺐다(10-19). 들린 뒤의 스크롤은 아래 document 리스너가 막는다.
- 스크롤을 막는 non-passive `touchmove` 리스너(`lifted`일 때만 `preventDefault`)는 **document에 처음부터** 등록한다. 브라우저는 `touchstart` 시점에 `touchmove`를 취소할 수 있는지를 정하므로, 제스처 도중에 붙인 리스너로는 스크롤을 못 막는다(빈 칸 드래그 중 스크롤되던 원인).
- `touchmove`/`touchend`/`touchcancel`은 **손가락을 댄 요소에도 직접** 붙인다. 미리보기로 캘린더가 다시 그려져 그 요소가 DOM에서 빠지면 이벤트가 document까지 버블링되지 않는다(실시간 미리보기 중 멈추던 원인).
- `touchend`에서 `preventDefault`로 뒤따르는 합성 click을 막는다. 탭 처리는 위 5번 한 곳에서만 한다.
- 컨테이너에 `-webkit-touch-callout: none; user-select: none`(모바일만)을 줘서 길게 누를 때 텍스트 선택·메뉴가 뜨지 않게 한다.

**새 props** (PC에서는 호출되지 않는다)
```ts
onMoveTask: (taskId: string, next: DayRange, prev: DayRange) => void;
onPickDate: (date: string) => void;
```

### 3.4 저장과 되돌리기 — `ProjectCalendar`

- `onMoveTask`: `handleUpdateTask(id, { start_date, end_date })`를 부르고, 토스트 `'작업명' 10월 23일로 이동` + "되돌리기"(→ `handleUpdateTask(id, prev)`)를 띄운다.
- `onPickDate(date)`: `modalDefaultStart = modalDefaultEnd = date`로 추가 시트를 연다.
- `Toast`: `ToastData`에 `actionLabel?: string`을 추가한다(기본값 "다시 시도"). 기존 호출부는 바꾸지 않는다.

### 3.5 하단 시트 — `src/components/BottomSheet.tsx`

```tsx
<BottomSheet onClose={...}>{children}</BottomSheet>
```

- 화면 하단 고정, 위쪽 모서리 16px 라운드, 상단 손잡이, 배경 `bg-black/30`.
- 배경을 탭하면 닫는다. 닫기 전에 포커스된 입력을 blur해서 "포커스가 빠질 때 저장"되는 필드가 저장되게 한다(iOS는 빈 영역을 탭해도 blur되지 않는다). Esc는 안에 들어가는 `TaskPeekPanel`·`TaskModal`이 이미 처리한다. 최대 높이 `85dvh`, 내용은 내부 스크롤.
- 하단 패딩에 `env(safe-area-inset-bottom)`을 더한다.
- 올라오는 애니메이션 200ms, `prefers-reduced-motion`이면 끈다.
- `z-index`는 기존 모달(`z-[100]`)과 같은 층, 토스트(`z-[110]`)보다 아래.

**적용**
- `TaskPeekPanel`: 모바일이면 위치 계산(`anchorRect`, `useLayoutEffect`) 대신 `BottomSheet` 안에 같은 내용을 렌더링한다. 필드, 포커스가 빠질 때 저장, 삭제 버튼은 그대로다. `ProjectCalendar`의 투명 배경 클릭 레이어는 모바일에서는 `BottomSheet`의 배경이 대신한다.
- `TaskModal`: 모바일이면 `modalOverlay` + 가운데 카드 대신 `BottomSheet` 안에 같은 폼을 렌더링한다. 모바일에서는 이름 칸 `autoFocus`를 끈다(시트가 열리자마자 키보드가 화면을 가리지 않게).
- 모바일에서 행 최소 높이를 44px로 키운다(`rowCls`에 `max-md:min-h-11`).

## 4. 오류 처리

- 저장 실패는 기존 `handleUpdateTask` 흐름을 따른다(실패 토스트 + 재조회로 막대가 원래 날짜로 돌아감).
- 되돌리기도 같은 `handleUpdateTask`라서 실패하면 같은 실패 토스트가 뜬다.
- 들린 상태에서 월 이동 버튼이 눌리는 경우는 없다(손가락 하나로 끄는 중이고, 멀티터치는 취소).

## 5. 테스트

- **단위(vitest)**: `moveRange` — 같은 날, +n/-n일, 월·연 경계, 여러 날 작업 길이 유지.
- **수동/에뮬레이션(Playwright, `hasTouch`)**: 목업에서 쓴 CDP `Input.dispatchTouchEvent` 시나리오를 로컬 앱에 그대로 적용한다.
  1. 막대 길게 누르기 → 2칸 이동 → 놓기: 날짜 저장, 되돌리기 토스트, 되돌리기 후 원래 날짜.
  2. 빈 칸 20일 길게 누르기 → 10일에서 놓기: 추가 시트가 10월 10일로 열림, 임시 막대 사라짐.
  3. 들린 상태로 위로 끌기: `scrollTop` 변화 없음. 길게 누르지 않고 쓸어올리기: 스크롤됨.
  4. 짧은 탭: 막대 → 상세 시트, 빈 칸 → 추가 시트.
  5. 1024px 폭: 기존 마우스 드래그·범위 선택·팝오버가 그대로 동작.
- **실기기**: iPhone(Claude 앱 또는 Safari)에서 1~4번을 확인한다. 배포 전 Vercel Preview URL로 본다.
