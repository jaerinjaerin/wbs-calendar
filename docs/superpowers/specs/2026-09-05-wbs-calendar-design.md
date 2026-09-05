# WBS Calendar - 설계 문서

## 개요

사내 팀 전용 프로젝트 WBS 관리 캘린더 웹 애플리케이션.
프로젝트별로 WBS(Work Breakdown Structure)를 계층적으로 관리하고, 캘린더 뷰에서 일정을 시각화하며, 팀원들과 공유한다.

## 기술 스택

- **프론트엔드**: Next.js 14 (App Router)
- **DB/백엔드**: Supabase (PostgreSQL + JS Client 직접 CRUD)
- **캘린더**: @toast-ui/react-calendar (월간/주간 뷰, 드래그 앤 드롭)
- **Export**: html2canvas (PNG), xlsx/SheetJS (XLSX)
- **스타일**: CSS Modules
- **배포**: Vercel + Supabase 무료 티어

## 데이터 모델

### projects
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| name | text | 프로젝트명 |
| created_at | timestamptz | 생성일 |
| owner_id | uuid FK → users (nullable) | PM. 프로젝트 생성 시 null, PM 유저 생성 후 업데이트 |

### users
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| name | text | 사용자명 |
| pin_hash | text | 4자리 PIN 해시 |
| role | text | 'pm' 또는 'member' |
| project_id | uuid FK → projects | 소속 프로젝트 |

### wbs_nodes
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| project_id | uuid FK → projects | |
| parent_id | uuid FK → wbs_nodes (nullable) | 자기참조. null이면 최상위 |
| name | text | 노드명 (예: "1. 분석 단계") |
| sort_order | int | 같은 레벨 내 정렬 순서 |
| color | text | Phase 색상 (hex) |
| depth | int | 계층 깊이 (0부터) |

### tasks
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| wbs_node_id | uuid FK → wbs_nodes | 소속 WBS 노드 |
| name | text | 작업명 |
| start_date | date | 시작일 |
| end_date | date | 종료일 |
| assignee_id | uuid FK → users (nullable) | 담당자 |
| status | text | 'todo', 'in_progress', 'done' |

## 페이지 구조

### `/` — 로그인
- 프로젝트 소속 사용자 프로필 카드 목록 표시
- 프로필 선택 → 4자리 PIN 입력 모달 → 인증 후 `/calendar`로 이동
- 세션은 localStorage에 저장 (사내 전용)

### `/calendar` — 메인 캘린더
- **상단 헤더**: 프로젝트 선택, Export(PNG/XLSX) 드롭다운, 작업 추가 버튼, 사용자 아바타
- **왼쪽 사이드바**: WBS 계층 트리 (접기/펼치기, Phase별 색상, 작업 수 표시). 노드 선택 시 하위 작업만 캘린더에 필터링
- **오른쪽 캘린더**: Toast UI Calendar (월간/주간 뷰 전환). 작업이 Phase 색상 바로 표시
- **작업 상세 패널**: 캘린더 바 클릭 시 오른쪽에서 슬라이드. WBS 경로, 상태, 기간, 담당자 표시 및 인라인 수정

### `/settings` — PM 전용 관리
- 팀원 추가/삭제
- 프로젝트 추가/수정/삭제

## 권한 모델

| 기능 | PM | 팀원 |
|------|:--:|:----:|
| 팀원 추가/삭제 | O | X |
| 프로젝트 추가/수정/삭제 | O | X |
| WBS 구조 편집 | O | O |
| 작업 추가/수정/삭제 | O | O |
| 드래그로 일정 변경 | O | O |
| Export (PNG/XLSX) | O | O |

Supabase RLS로 projects, users 테이블은 PM만 쓰기 가능하도록 제한.

## 핵심 인터랙션

- **작업 추가**: 캘린더 빈 날짜 클릭 또는 "+ 작업 추가" 버튼 → 모달 (작업명, 시작/종료일, 담당자, 상태, WBS 노드 선택)
- **작업 수정**: 캘린더 바 클릭 → 상세 패널에서 인라인 수정
- **일정 변경**: 캘린더 바 드래그 앤 드롭 → Toast UI Calendar 기본 기능, drop 시 DB 업데이트
- **WBS 트리**: 사이드바에서 노드 CRUD, 접기/펼치기. 노드 선택 시 캘린더 필터링
- **Export PNG**: html2canvas로 캘린더 컨테이너 캡처 → canvas.toDataURL() → 다운로드
- **Export XLSX**: 현재 필터된 작업 데이터를 SheetJS로 워크시트 변환 → .xlsx 다운로드

## 프로젝트 구조

```
src/
  app/
    page.tsx              ← 로그인
    calendar/page.tsx     ← 메인 캘린더
    settings/page.tsx     ← PM 전용 관리
  components/
    WbsTree.tsx           ← 사이드바 트리
    TaskModal.tsx          ← 작업 추가/수정 모달
    TaskPeekPanel.tsx      ← 작업 상세 패널
    ExportButtons.tsx      ← Export 기능
  lib/
    supabase.ts           ← Supabase 클라이언트
    auth.ts               ← PIN 인증/세션 관리
  types/
    index.ts              ← 공통 타입 정의
```

## 의존성 (5개)

- `next` — 프레임워크
- `@supabase/supabase-js` — DB/백엔드
- `@toast-ui/react-calendar` — 캘린더 UI
- `html2canvas` — PNG Export
- `xlsx` — Excel Export

## 테스트

- 핵심 로직 단위 테스트: PIN 인증, WBS 트리 계층 조작, Export 데이터 변환
- E2E 초기 생략 (사내 소규모, 수동 검증 충분). 필요 시 Playwright 추가

## 배포

- Vercel 무료 티어 (Next.js 네이티브)
- Supabase 무료 티어 (500MB DB)
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
