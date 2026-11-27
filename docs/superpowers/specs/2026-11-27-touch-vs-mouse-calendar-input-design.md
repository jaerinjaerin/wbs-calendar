# 달력 조작: 뷰포트 대신 입력 장치 기준 (설계, 작은 변경)

## 의도
아이패드는 너비 768px 이상이라 PC 로직(Toast UI 마우스 드래그)을 타는데, Toast UI는 마우스 이벤트만 처리한다. 손가락으로는 날짜 선택·작업 이동이 안 된다. 반대로 모바일 로직으로 돌리면 유니버설 컨트롤 마우스가 안 된다. 아이패드에서 둘 다 되게 한다.

## 목표 / 비목표
- 목표: 터치스크린 기기에서 손가락 로직(탭 생성, 길게 눌러 이동), 폰이 아닌 화면에서 마우스 로직(드래그 범위 선택, 막대 이동·기간 조절). 둘 다 해당하면 둘 다 켠다.
- 비목표: 화면 배치 기준 변경(768px 유지), PC/모바일 동작 차이 정리(날짜 한 번 클릭 등), 모바일 기간 조절.
- 안티골: 폰과 일반 PC의 동작이 조금이라도 바뀌는 것.

## 접근
1. **`navigator.maxTouchPoints > 0` 훅 (선택)** — 아이패드 Safari가 Mac으로 보고해도 정확. 기존 두 로직을 그대로 둔 채 켜는 조건만 바꾼다.
2. CSS `pointer: coarse` — JS 훅에도 같은 판별이 필요해 중복.
3. 이벤트마다 입력 종류 판별 — 두 로직을 다시 짜야 해서 과함.

## 설계
- `src/lib/useHasTouch.ts`: 서버/첫 렌더는 false, 마운트 후 `navigator.maxTouchPoints > 0`.
- `CalendarView.tsx`
  - `useLongPressDrag({ enabled: touch })`, iOS 진동 스위치, 길게 누르기 방해 CSS(`select-none`, `-webkit-touch-callout:none`): `touch`일 때.
  - `isReadOnly={mobile}`, `gridSelection={!mobile}`: 그대로(마우스 로직은 폰 화면에서만 끔).
- 탭 중복 없음: `useLongPressDrag`가 touchend에서 `preventDefault`로 합성 마우스 이벤트를 막는다.
- 상세가 열린 상태: PC 배치의 투명 덮개(`ProjectCalendar`)가 탭을 먼저 받아 상세만 닫는다.

## 빌더 몫
- 실제 아이패드·유니버설 컨트롤 확인은 사용자가 한다. 로컬에서는 브라우저 터치 흉내 + 마우스로 각각 확인.
