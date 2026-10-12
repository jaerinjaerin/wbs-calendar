# DB 남용 방지 설계

- 작성일: 2026-10-12
- 결정 기록: https://claude.ai/artifact/HXkXt7jE6NbGEKEQ8GZV36 (옵션과 선택 이유 전체)

## 1. 목표

누구나 쓸 수 있는 공개 앱은 그대로 두고, 비정상적으로 반복되는 요청을 IP 단위로 막는다.

지금은 브라우저가 publishable key로 Supabase Data API에 직접 요청하고, 네 테이블 모두 RLS가 꺼져 있다. 앱이 Vercel에 배포되어 있어 누구나 key를 복사해 앱을 거치지 않고 DB를 읽고 쓸 수 있다. 그래서 앱 쪽에 제한을 넣어도 직접 요청은 막을 수 없다. 이 설계는 직접 경로를 닫고, 모든 DB 요청이 Next.js 서버 액션을 거치게 한 뒤 그 자리에서 제한한다.

**우선순위**: ① 생성 폭탄 > ② 과도한 조회 > ③ 대량 삭제·수정

**성공 기준**
- publishable key로 Supabase REST API에 직접 요청하면 거절된다.
- Supabase 보안 점검의 `rls_disabled_in_public` ERROR 4건이 사라진다.
- 한도를 넘은 IP의 요청은 DB 작업 없이 `rate_limited`로 거절되고, 화면에는 기존 실패 토스트가 "요청이 너무 많아요. 잠시 후 다시 시도해 주세요"로 뜬다.
- 정상 사용(같은 IP로 5~20명 동시 사용)에서는 한도에 닿지 않는다.
- 관리자 비밀번호 해시가 브라우저로 나가지 않고, 관리자 작업은 서버에서 비밀번호를 검증한다.

**범위 밖**
- 로그인, 프로젝트별 접근 권한 (공개 앱 유지)
- 비밀번호 해시 방식 변경 (SHA-256 유지, 3.3 참고)
- 남은 시간 표시, 차단 배너 같은 새 UI

## 2. 확정된 결정

| 항목 | 결정 |
|---|---|
| 막는 위치 | 모든 DB 요청을 Next.js 서버 액션으로 이동, 브라우저 직접 접근은 RLS로 차단 |
| 카운터 저장소 | Supabase DB `rate_limits` 테이블 + `hit_rate_limit` 함수 (새 서비스 없음) |
| 제한 단위 | IP (`x-forwarded-for` 첫 값) × 작업 종류 |
| 제한 방식 | 고정 구간 카운터 |
| 한도 초과 안내 | 기존 실패 토스트 재사용, 문구만 변경 |
| 제한 확인 실패 시 | 통과시키고 서버 로그만 남김 |
| 배포 | Vercel (기존). 환경변수 `SUPABASE_SECRET_KEY` 추가 |

### 한도

| 종류 | 구간 | 최대 | 쓰는 액션 |
|---|---|---|---|
| `project_create` | 3600초 | 5 | `createProject` |
| `create` | 60초 | 60 | `createTask`, `createWbsNode`, `addMember` |
| `read` | 60초 | 900 | 조회 액션 전부 |
| `write` | 60초 | 300 | 수정·삭제 액션 전부 |
| `auth` | 60초 | 10 | `verifyAdmin` |

숫자는 `src/lib/server/rateLimit.ts`의 상수 한 곳에 모은다.

## 3. 구조

| 파일 | 역할 |
|---|---|
| `src/lib/server/db.ts` | 서버 전용 Supabase 클라이언트. `import 'server-only'`, 기존 `NEXT_PUBLIC_SUPABASE_URL`(공개돼도 되는 값) + 새 `SUPABASE_SECRET_KEY` |
| `src/lib/server/rateLimit.ts` | 한도 상수, `clientIp(headers)`, `limit(kind)` |
| `src/lib/validate.ts` | 입력 검증 순수 함수 (서버·테스트 공용) |
| `src/app/actions.ts` | `'use server'` 서버 액션 전부 |
| `supabase/migrations/20261012000001_rate_limits.sql` | 마이그레이션 ①: 요청 제한 테이블·함수 |
| `supabase/migrations/20261012000002_lockdown.sql` | 마이그레이션 ②: RLS 켜기, 익명 권한 회수 |
| `src/lib/__tests__/rateLimit.test.ts`, `validate.test.ts` | Vitest |

**삭제**: `src/lib/supabase.ts`(브라우저 클라이언트), `src/utils/supabase/`(사용처 없음). 클라이언트 코드의 `hashPin`/`verifyPin` 사용도 사라진다(`src/lib/auth.ts`는 서버에서 계속 사용).

### 3.1 서버 액션

모든 액션은 Supabase와 같은 모양 `{ data, error }`를 돌려준다. `error`는 `{ code: string; message: string } | null`이고, `code`는 다음 중 하나다.

- `'rate_limited'`: 한도 초과
- `'invalid_input'`: 입력 검증 실패
- `'unauthorized'`: 관리자 비밀번호 불일치
- `'23505'`: 이미 저장됨 (기존 재시도 로직이 성공으로 처리)
- 그 밖의 Postgres 오류 코드 그대로

모든 액션은 첫 줄에서 `limit(kind)`를 호출하고, 다음으로 입력을 검증한 뒤 DB 작업을 한다.

| 화면 | 액션 | 종류 | 비고 |
|---|---|---|---|
| 첫 화면 | `listProjects()` | read | `id, name, created_at`만 반환 |
| | `createProject(name, adminName, password)` | project_create | 프로젝트 → 관리자(pm) → `owner_id` 연결을 서버에서 순서대로. 해싱도 서버. 반환: 프로젝트 `name` |
| 캘린더 | `getProjectByName(name)` | read | `id, name` |
| | `loadProjectData(projectId)` | read | 해당 프로젝트의 분류, 팀원, **그 분류에 속한 작업만** |
| | `createTask(task)` | create | 클라이언트가 만든 `id`(UUID) 유지 → 재시도 시 `23505` |
| | `updateTask(id, changes)` | write | 허용 필드만 반영: `name, start_date, end_date, assignee_id, status, priority, memo, url, wbs_node_id` |
| | `deleteTask(id)` | write | |
| 분류 트리 | `loadWbsTree(projectId)` | read | 분류 목록(`sort_order` 순) + 분류별 작업 수 (해당 프로젝트 작업만) |
| | `createWbsNode(node)` | create | |
| | `renameWbsNode(id, name)` | write | |
| | `deleteWbsNode(id)` | write | |
| 설정 | `getProject(id)` | read | `id, name`. 해시 제외 |
| | `verifyAdmin(projectId, password)` | auth | 성공 시 `{ project, users }` 반환 |
| | `addMember(projectId, password, user)` | create | 비밀번호 재검증 |
| | `deleteMember(projectId, password, userId)` | write | 비밀번호 재검증, 해당 프로젝트 팀원인지 확인 |
| | `renameProject(projectId, password, name)` | write | 비밀번호 재검증 |
| | `deleteProject(projectId, password)` | write | 비밀번호 재검증 |

`projects.admin_password_hash`는 어떤 액션도 반환하지 않는다. 조회는 항상 열을 명시한다.

### 3.2 입력 검증 (`src/lib/validate.ts`)

- 이름(프로젝트·관리자·팀원·분류·작업): 앞뒤 공백 제거 후 1~100자
- 비밀번호: 1~100자
- `id`류: UUID 형식
- 날짜: `YYYY-MM-DD`로 실제 존재하는 날짜, `start_date <= end_date`
- `status`: `todo | in_progress | done`, `priority`: `high | medium | low | null`
- `memo`, `url`: 최대 2000자 또는 `null`
- 분류 `color`: `#RRGGBB`, `depth`: 0 이상 정수, `parent_id`: UUID 또는 `null`

실패하면 DB 작업 없이 `invalid_input`.

### 3.3 관리자 인증

- `verifyAdmin`은 서버에서 `hashPin(password)`와 저장된 해시를 `crypto.timingSafeEqual`로 비교한다.
- 관리자 액션은 매번 비밀번호를 받아 같은 방식으로 다시 검증한다. 재검증은 해당 액션의 한도(`create`/`write`)만 따르고 `auth` 한도는 쓰지 않는다.
- 설정 페이지는 인증 성공 후 비밀번호를 React state(메모리)에만 둔다. 새로고침하면 다시 입력한다(지금과 같음).
- SHA-256(솔트 없음)은 유지한다. 해시가 서버 밖으로 나가지 않고 시도가 IP당 분당 10회로 묶이므로, 기존 해시 이전 작업을 감수할 이유가 약하다.

### 3.4 클라이언트 변경

- `supabase.from(...)` 호출을 같은 결과 모양의 액션 호출로 바꾼다. 낙관적 업데이트와 롤백, 재시도 토스트 흐름은 그대로 둔다.
- 실패 토스트 문구는 공용 헬퍼로 고른다: `error.code === 'rate_limited'`이면 "요청이 너무 많아요. 잠시 후 다시 시도해 주세요", 아니면 기존 문구.
- 지금 오류를 무시하는 곳(`handleUpdateTask`, `handleRename`, `confirmDelete`)도 실패하면 토스트를 띄운다. 한도에 걸렸을 때 아무 반응 없이 끝나지 않게 하기 위해서다.
- 설정 페이지: 인증 전 `getProject`, 인증은 `verifyAdmin`, 이후 관리자 액션에 비밀번호를 함께 넘긴다.

## 4. 요청 제한 (마이그레이션 ①)

```sql
create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;

create function hit_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c int;
begin
  insert into rate_limits (key, window_start) values (p_key, w)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into c;
  -- ponytail: 1% of calls sweep day-old rows; switch to pg_cron if the table still grows
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;
  return c <= p_max;
end;
$$;

revoke all on function hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function hit_rate_limit(text, int, int) to service_role;
```

- 키는 `${kind}:${ip}`. 예: `create:203.0.113.7`.
- `clientIp`는 `x-forwarded-for`의 첫 값을 앞뒤 공백을 제거해 쓴다. 헤더가 없으면 `'unknown'`. Vercel은 이 헤더를 덮어쓰므로 사용자가 조작할 수 없다.
- `limit(kind)`는 RPC가 `false`를 돌려주면 `rate_limited` 오류를 반환한다. RPC 자체가 실패하면 `console.error`만 남기고 통과시킨다.
- 고정 구간이라 구간 경계에서 최대 2배까지 통과할 수 있다. 남용 방지 목적에는 충분하다고 보고, `rateLimit.ts`에 `ponytail:` 주석으로 남긴다.

## 5. 잠금 (마이그레이션 ②)

```sql
alter table projects  enable row level security;
alter table users     enable row level security;
alter table wbs_nodes enable row level security;
alter table tasks     enable row level security;

revoke all on projects, users, wbs_nodes, tasks from anon, authenticated;
```

정책은 만들지 않는다. secret key(service_role)는 RLS를 우회하므로 서버 액션은 계속 동작한다. 되돌릴 때는 `disable row level security`와 권한 재부여로 복구한다.

`supabase/schema.sql`에도 두 마이그레이션 내용을 반영한다.

## 6. 배포 순서

운영 사이트가 지금 브라우저에서 직접 DB를 쓰고 있으므로 순서를 지킨다.

1. 마이그레이션 ① 적용 (기존 코드에 영향 없음)
2. 사용자가 Supabase 대시보드 → Settings → API Keys에서 secret key를 만들고, Vercel 환경변수와 `.env.local`에 `SUPABASE_SECRET_KEY`로 등록
3. 새 코드 배포 → 운영 사이트에서 주요 흐름 확인
4. 마이그레이션 ② 적용 (잠금). 이전에 열어 둔 탭은 새로고침해야 동작
5. Vercel에서 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 제거

## 7. 테스트

- **Vitest**
  - `clientIp`: 여러 값이 들어 있는 헤더, 공백, 헤더 없음
  - `limit`: RPC가 `true`/`false`/오류를 돌려줄 때 각각 통과 / `rate_limited` / 통과
  - `validate`: 이름 길이, 날짜 형식과 순서, enum, UUID, 색상
- **DB 함수**: 같은 키로 `hit_rate_limit(key, 60, 2)`를 3번 호출해 `true, true, false` 확인 후 테스트 행 삭제
- **잠금 확인**: publishable key로 `curl .../rest/v1/projects` → 거절. Supabase 보안 점검 재실행 → `rls_disabled_in_public` 없음
- **앱 동작** (로컬, 운영): 프로젝트 생성, 작업 추가·수정·삭제, 분류 추가·이름 변경·삭제, 설정에서 인증·팀원 추가·삭제·이름 변경·프로젝트 삭제
