# WBS Calendar

사내 팀 전용 프로젝트 WBS 관리 캘린더 웹 애플리케이션.

## 프로젝트 현황 문서

- **아티팩트**: https://claude.ai/code/artifact/b6970244-3608-4f74-8a39-3ad6bd67900a
- 구현 진행률, Task 현황, 프로젝트 구조, 데이터 모델, 남은 작업 정리

## 관련 문서

- 설계 문서: `docs/superpowers/specs/2026-09-05-wbs-calendar-design.md`
- 구현 계획: `docs/superpowers/plans/2026-09-05-wbs-calendar.md`

## 디자인시스템

`DESIGN.md` (Cal.com 기반) — UI 작업 시 반드시 참조. Inter 폰트, #111111 primary, 8px rounded 버튼, 12px rounded 카드.

## 기술 스택

Next.js 14 (App Router) + Supabase + Toast UI Calendar + TypeScript + Tailwind CSS

## 개발 서버

```bash
npm run dev  # localhost:3100
```

## 환경변수

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
