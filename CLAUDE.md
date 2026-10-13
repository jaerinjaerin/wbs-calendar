# WBS Calendar

사내 팀 전용 프로젝트 WBS 관리 캘린더 웹 애플리케이션.

## 프로젝트 현황 문서

- **아티팩트**: https://claude.ai/code/artifact/b6970244-3608-4f74-8a39-3ad6bd67900a
- 구현 진행률, Task 현황, 프로젝트 구조, 데이터 모델, 남은 작업 정리

## 추가 아티팩트

- **프로젝트 현황 (10-13 기준)**: https://claude.ai/artifact/PYj2hViBSnhJnmLurCz1ry — 변경 이력, 서버 액션 구조, 요청 제한 반영
- **DB 남용 방지 결정 기록**: https://claude.ai/artifact/HXkXt7jE6NbGEKEQ8GZV36 — 문제 발견부터 배포·RLS 잠금까지 옵션과 선택 이유
- **로딩 속도 개선 (10-13)**: https://claude.ai/artifact/JzVv6YrpWDe1UJY4JAYXM2 — 함수 리전 불일치·직렬 서버 액션 원인과 해결, 전후 측정값

## 관련 문서

- 설계 문서: `docs/superpowers/specs/2026-09-05-wbs-calendar-design.md`
- 구현 계획: `docs/superpowers/plans/2026-09-05-wbs-calendar.md`
- DB 남용 방지 설계: `docs/superpowers/specs/2026-10-12-db-abuse-protection-design.md`
- DB 남용 방지 계획: `docs/superpowers/plans/2026-10-12-db-abuse-protection.md`

## 디자인시스템

`DESIGN.md` (Cal.com 기반) — UI 작업 시 반드시 참조. Inter 폰트, #111111 primary, 8px rounded 버튼, 12px rounded 카드.

## 기술 스택

Next.js 14 (App Router) + Supabase + Toast UI Calendar + TypeScript + Tailwind CSS

## 개발 서버

```bash
npm run dev  # localhost:3100
```

## 환경변수

`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` (서버 전용, 서버 액션만 DB에 접근)

## 성능 규칙

- Vercel 함수는 `vercel.json`으로 `icn1`(서울)에 고정한다. Supabase가 ap-northeast-2에 있어서, 리전이 다르면 서버 액션 하나에 1~2초가 걸린다.
- 페이지 첫 데이터는 서버 컴포넌트에서 조회해 props로 넘긴다(`/`, `/[projectName]`). 클라이언트에서 서버 액션으로 처음 로드하지 않는다. Next는 서버 액션을 한 번에 하나씩만 보내므로 여러 개를 호출하면 직렬로 쌓인다.
