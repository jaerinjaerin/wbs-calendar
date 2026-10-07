# Excel 일정표 Export 설계

- 작성일: 2026-10-07
- 레퍼런스: `260825_Tab S12F_Schedule_1.xlsx` (시트 `Tab S12F`)

## 1. 목표

현재 프로젝트의 Task를 레퍼런스 엑셀(주차별 간트형 일정표)과 같은 형태의 `.xlsx`로 내보낸다. 사내 공유용 일정표를 손으로 만드는 작업을 대체하고, 세부 수정은 내보낸 뒤 엑셀에서 직접 한다.

**성공 기준**
- 헤더 버튼 한 번으로 `.xlsx`가 다운로드된다.
- 레퍼런스와 같은 구조: 제목·업데이트 날짜, 월/ISO 주차 2단 헤더, 노란 `주요 일정` 행, 구분/상세 행, 하단 각주.
- 모든 셀의 폰트가 `Samsung SS Head KR` 계열이다.

**범위 밖**
- 레퍼런스의 `Ref_*` 시트, 화살표 도형, 이미지
- 기간 선택 UI
- 폰트 파일 임베드: xlsx 포맷은 폰트를 내장할 수 없다. 받는 사람 PC에 폰트가 설치되어 있어야 한다.

## 2. 확정된 결정

| 항목 | 결정 |
|---|---|
| 폰트 | `Samsung SS Head KR` 전용. 굵기는 폰트 이름으로 구분: `Samsung SS Head KR Bold` / `Samsung SS Head KR Medium` |
| 기간 표현 | 가로 셀 병합 + WBS 색상 채우기 (간트 바) |
| 주요 일정 | 이름이 정확히 `주요 일정`인 최상위(depth 0) WBS 아래 Task를 노란 행에 표시 |
| 내보낼 기간 | 전체 Task의 최소 시작일이 속한 주부터 최대 종료일이 속한 주까지 자동 |
| 주차 표기 | ISO 8601 주차 `W{n}` (월요일 시작) |
| 월 귀속 | 그 주의 평일(월~금) 5일 중 3일 이상이 속한 월 |
| 구현 | 브라우저에서 exceljs로 처음부터 생성 (서버, 템플릿 없음) |
| 숨긴 WBS | 사이드바에서 숨긴 WBS의 Task는 제외 (`filteredTasks` 그대로 사용) |

## 3. 구조

| 파일 | 역할 |
|---|---|
| `src/lib/scheduleExport.ts` | 순수 로직. `buildLayout()` + `renderWorkbook()` + 파일명/시트명 헬퍼 |
| `src/components/ExportButtons.tsx` | 현재 스텁. "Excel" 버튼을 만들고, exceljs 동적 import → 생성 → Blob 다운로드 |
| `src/lib/__tests__/scheduleExport.test.ts` | vitest 테스트 |

**의존성**
- `exceljs` 추가
- `xlsx` 제거 (`src`에서 사용처 없음)

**데이터 흐름**
```
filteredTasks + wbsNodes + projectName + today
  → buildLayout()     // 순수 계산: 주 목록, 행 목록, 배치
  → renderWorkbook()  // exceljs 셀 값/병합/스타일
  → workbook.xlsx.writeBuffer() → Blob → <a download>
```

`ExportButtons`의 props 중 `users`와 `calendarRef`는 이번 작업에서 사용하지 않는다. page의 호출부는 그대로 둔다.

## 4. 레이아웃 계산 (`buildLayout`)

### 4.1 주 목록
- 기간: `min(start_date)`가 속한 ISO 주의 월요일부터 `max(end_date)`가 속한 ISO 주까지, 7일씩 순회한다.
- 각 주: `{ isoWeek, monday, month }`. `month`는 평일 과반 규칙으로 정하며, `Jan`~`Dec` 영문 약어로 표기한다.
- 연속된 같은 `month`의 주는 월 헤더 셀 하나로 병합한다. 연도를 넘어도 날짜 순서대로 이어진다.

### 4.2 행 구성
- **주요 일정**: 이름이 `주요 일정`인 depth 0 WBS의 모든 하위 Task를 모은다. 이 WBS는 구분/상세 영역에는 나오지 않는다. 해당 WBS가 없거나 Task가 0개여도 행은 1줄(빈 노란 행)로 유지한다.
- **구분** = depth 0 WBS, **상세** = depth 1 WBS. 형제 노드 사이에서는 `sort_order` 오름차순이다.
- depth 2 이상 WBS의 Task는 depth 1 조상의 상세 행에 합친다.
- depth 0에 직접 달린 Task는 상세 `-` 행에 넣는다. 이 행은 해당 구분의 상세 행들보다 앞에 둔다.
- 내보낼 Task가 하나도 없는 구분이나 상세는 행을 만들지 않는다.

### 4.3 레인 배치
- 한 상세(또는 주요 일정) 안에서 Task를 `start_date`, `end_date`, `name` 순으로 정렬한다.
- 각 Task는 주 범위가 겹치지 않는 첫 번째 레인에 넣고, 그런 레인이 없으면 새 레인을 만든다.
- 상세 셀은 레인 수만큼 세로 병합한다. 구분 셀은 하위 레인 전체를 세로 병합한다.

### 4.4 Task 셀
- 열 범위: `start_date`의 주 ~ `end_date`의 주. 2주 이상이면 가로 병합한다.
- `start_date > end_date`이면 두 날짜를 바꿔서 처리한다.
- 텍스트: 하루짜리는 `이름(M/D)`, 여러 날짜는 `이름(M/D~M/D)`.

## 5. 렌더링 (`renderWorkbook`)

### 5.1 셀 배치
| 위치 | 내용 |
|---|---|
| A열 | 여백 (너비 3.66) |
| B2 | 제목 = 프로젝트 이름 |
| 마지막 주 열의 2행 | `* YYYY.MM.DD Updated` (오른쪽 정렬) |
| B3:B4 / C3:C4 | `구분` / `상세` (세로 병합) |
| D3~ | 월 헤더 (가로 병합) |
| D4~ | `W{n}` |
| 5행~ | `주요 일정` (B:C 병합) 레인들 |
| 그 아래 | 구분/상세 레인들 |
| 표 아래 1행 띄우고 B열 | `* 상기 일정은 런칭 일정 및 프로젝트 진행상황에 따라 추후 변동 가능` |

### 5.2 스타일
| 요소 | 폰트 | 크기 | 채우기 | 기타 |
|---|---|---|---|---|
| 제목 | SS Head KR Bold | 22 | - | 행 높이 33 |
| 업데이트 날짜 | SS Head KR Bold | 14 | - | 글자색 `#0070C0` |
| 헤더(구분/상세/월/주) | SS Head KR Bold | 10 (월 11) | `#B4C6E7` | 행 높이 4행=27.75 |
| 주요 일정 라벨 | SS Head KR Bold | 10 | `#B4C6E7` | |
| 주요 일정 주 셀 | SS Head KR Bold | 10 | `#FFC000` | 레인 높이 43 |
| 구분/상세 | SS Head KR Bold | 10 | `#F2F2F2` | |
| Task 바 | SS Head KR Medium | 10 | WBS `color` | 글자색은 배경 상대휘도 > 0.5면 `#000000`, 아니면 `#FFFFFF` |
| 빈 주 셀 | SS Head KR Medium | 10 | - | 레인 높이 30 |
| 각주 | SS Head KR Bold | 11 | - | |

- 모든 셀: 가운데 정렬(제목, 각주, 날짜 제외), 세로 가운데 정렬, 자동 줄바꿈.
- 테두리
  - 표 외곽: medium
  - 헤더 4행 하단: double
  - 주요 일정 하단과 구분 사이: thin
  - 구분/상세 열 오른쪽: thin
  - 주 사이와 레인 사이: dotted
- 열 너비: B=14, C=12.66, 주 열=13.66
- 시트: 이름은 프로젝트 이름(`\/?*[]:` 제거, 31자 제한, 비면 `Schedule`), 눈금선 숨김, 확대 96%.

### 5.3 파일명
`YYMMDD_<프로젝트명>_Schedule.xlsx`. 날짜는 내보낸 날이다. 프로젝트명에서 파일명 금지 문자 `\/:*?"<>|`는 제거한다.

## 6. UI와 예외 처리

| 상황 | 동작 |
|---|---|
| 기본 | 헤더 `ExportButtons` 위치에 "Excel" 버튼. DESIGN.md 버튼 규칙(8px rounded)을 따른다. |
| 내보낼 Task 0개 | 버튼 비활성화, `title="내보낼 일정이 없습니다"` |
| 생성 중 | "내보내는 중…" 표시, 비활성화 |
| 실패 | 기존 `Toast`로 "엑셀 내보내기에 실패했습니다", `console.error` |

## 7. 테스트

`src/lib/__tests__/scheduleExport.test.ts` (vitest)
- ISO 주차: 2026-07-10 → W28. 연말 경계: 2026-12-31 → W53, 2027-01-04 → W1.
- 월 귀속: 2026 W27 → Jul, W36 → Sep, W40 → Sep, W41 → Oct.
- 레인: 같은 상세에서 주가 겹치는 Task 2개 → 레인 2. 겹치지 않으면 → 레인 1.
- depth 2 Task는 depth 1 상세로 합쳐지고, depth 0 직속 Task는 상세 `-` 행에 들어간다.
- `주요 일정` WBS는 별도 행으로 빠지고, 구분 목록에는 없다.
- `start_date > end_date` 입력은 날짜를 바꿔서 처리한다.
- `renderWorkbook` 스모크: `writeBuffer` → exceljs로 다시 로드 → 값이 있는 모든 셀의 폰트 이름이 `Samsung SS Head KR`로 시작하는지, 헤더 `W28` 위치, Task 병합 범위가 맞는지 확인한다.

수동 확인: 내보낸 파일을 Excel에서 열어 레퍼런스와 나란히 비교한다.
