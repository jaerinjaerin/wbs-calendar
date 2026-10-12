# DB 남용 방지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저의 Supabase 직접 접근을 닫고 모든 DB 요청을 Next.js 서버 액션으로 옮겨, 서버에서 IP·작업 종류별 요청 제한과 입력 검증, 관리자 비밀번호 검증을 한다.

**Architecture:** `src/app/actions.ts`(`'use server'`)가 유일한 DB 입구가 된다. 각 액션은 ① `rate_limits` 테이블 기반 고정 구간 카운터로 IP별 한도 확인 → ② 입력 검증 → ③ secret key 클라이언트로 DB 작업 순서로 동작하고, Supabase와 같은 `{ data, error }` 모양을 돌려준다. 마지막에 네 테이블에 RLS를 켜고 익명 권한을 회수해 직접 경로를 닫는다.

**Tech Stack:** Next.js 14.2 App Router (서버 액션), `@supabase/supabase-js` 2.x, Postgres (Supabase), Vitest 5, TypeScript

**Spec:** `docs/superpowers/specs/2026-10-12-db-abuse-protection-design.md`

## Global Constraints

- 한도: `project_create` 3600초/5, `create` 60초/60, `read` 60초/900, `write` 60초/300, `auth` 60초/10. 숫자는 `src/lib/server/rateLimit.ts`의 `LIMITS` 한 곳에만 둔다.
- 레이트 리밋 키: `${kind}:${ip}`, IP는 `x-forwarded-for` 첫 값(공백 제거), 없으면 `'unknown'`.
- 제한 확인 자체가 실패하면 통과시키고 `console.error`만 남긴다.
- 액션 오류 코드: `rate_limited`, `invalid_input`, `unauthorized`, 그 외 Postgres 코드 그대로(`23505` 포함).
- 한도 초과 문구: `요청이 너무 많아요. 잠시 후 다시 시도해 주세요`
- `projects.admin_password_hash`는 어떤 액션도 반환하지 않는다. 조회는 열을 명시한다.
- 검증: 이름 trim 후 1~100자, 비밀번호 1~100자(trim 안 함), id는 UUID, 날짜 `YYYY-MM-DD` 실재 날짜 + `start_date <= end_date`, `status` ∈ `todo|in_progress|done`, `priority` ∈ `high|medium|low|null`, `memo`/`url` ≤ 2000자 또는 `null`, `color` `#RRGGBB`, `depth` 0 이상 정수.
- 관리자 액션은 매번 비밀번호를 서버에서 재검증한다(`crypto.timingSafeEqual`). 재검증은 해당 액션 한도만 쓰고 `auth` 한도는 쓰지 않는다.
- 서버 전용 코드는 `import 'server-only'`로 브라우저 번들 유입을 막는다.
- 운영 사이트가 직접 DB를 쓰고 있으므로, 잠금(마이그레이션 ②)은 새 코드가 운영에 배포되고 확인된 뒤에만 적용한다.
- 코드 스타일: 기존 파일처럼 주석은 짧게, 의도적 단순화는 `ponytail:` 주석.

## Review Focus

- 존재하지 않는 날짜(`2026-02-30`)나 시작일 > 종료일 입력은 거절되고, 같은 날 시작·종료는 허용되어야 한다 → Task 2 테스트
- 캘린더 드래그·리사이즈는 `end_date` 하나만 보내는 부분 수정이다. 한쪽 날짜만 있는 변경도 통과해야 한다 → Task 2 테스트
- 비밀번호 앞뒤 공백은 잘라내지 않아야 기존 해시와 계속 일치한다 → Task 2 테스트
- `x-forwarded-for`에 여러 IP·공백이 있거나 헤더가 없을 때 키가 안정적이어야 한다 → Task 3 테스트
- 레이트 리밋 RPC가 오류를 내면 정상 사용자를 막지 않고 통과시켜야 한다 → Task 3 테스트

---

## File Structure

| 파일 | 상태 | 책임 |
|---|---|---|
| `supabase/migrations/20261012000001_rate_limits.sql` | 생성 | `rate_limits` 테이블, `hit_rate_limit` 함수 |
| `supabase/migrations/20261012000002_lockdown.sql` | 생성 | 네 테이블 RLS 켜기, 익명 권한 회수 |
| `supabase/schema.sql` | 수정 | 두 마이그레이션 내용 반영 |
| `src/lib/validate.ts` | 생성 | 입력 검증 순수 함수 |
| `src/lib/actionResult.ts` | 생성 | 액션 결과 타입, `ok`/`fail`/`fromDb`, `errorMessage` (클라이언트·서버 공용) |
| `src/lib/server/rateLimit.ts` | 생성 | `LIMITS`, `clientIp`, `isAllowed` (순수, DB 미의존) |
| `src/lib/server/password.ts` | 생성 | `passwordMatches` (Node `crypto`) |
| `src/lib/server/db.ts` | 생성 | secret key Supabase 클라이언트, `server-only` |
| `src/app/actions.ts` | 생성 | 서버 액션 17개 |
| `src/types/index.ts` | 수정 | `ProjectSummary` 추가 |
| `src/app/page.tsx` | 수정 | 첫 화면 → 액션 |
| `src/app/[projectName]/page.tsx` | 수정 | 캘린더 → 액션 |
| `src/components/WbsTree.tsx` | 수정 | 분류 트리 → 액션 |
| `src/app/settings/page.tsx` | 수정 | 설정 → 액션, 서버 인증 |
| `src/lib/auth.ts` | 수정 | `verifyPin` 제거 (`hashPin`만 남김) |
| `src/lib/supabase.ts`, `src/utils/supabase/*` | 삭제 | 브라우저 직접 접근 제거 |
| `src/lib/__tests__/validate.test.ts`, `rateLimit.test.ts`, `actionResult.test.ts`, `password.test.ts` | 생성 | Vitest |

---

### Task 1: 요청 제한 DB 객체 (마이그레이션 ①)

기존 운영 코드에 영향이 없는 변경이라 바로 적용한다.

**Files:**
- Create: `supabase/migrations/20261012000001_rate_limits.sql`
- Modify: `supabase/schema.sql` (파일 끝에 추가)

**Interfaces:**
- Produces: Postgres 함수 `public.hit_rate_limit(p_key text, p_window_seconds int, p_max int) returns boolean` — service_role만 실행 가능. Task 4의 `db.rpc('hit_rate_limit', { p_key, p_window_seconds, p_max })`가 호출한다.

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/20261012000001_rate_limits.sql`:

```sql
-- Per-IP request counters for server actions (fixed window).
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

- [ ] **Step 2: 적용**

Supabase MCP `apply_migration`으로 적용한다. `name`: `rate_limits`, `query`: 위 파일 내용 그대로.

Expected: 성공 응답.

- [ ] **Step 3: 함수 동작 확인 (한도 2, 3회 호출)**

Supabase MCP `execute_sql`:

```sql
select hit_rate_limit('plan-test', 60, 2) as a,
       hit_rate_limit('plan-test', 60, 2) as b,
       hit_rate_limit('plan-test', 60, 2) as c;
```

Expected: `a = true, b = true, c = false`. (같은 문장 안의 세 호출이 같은 구간에 들어간다. 드물게 분 경계에 걸리면 `true, true, true`가 나올 수 있으니 그 경우 한 번 더 실행.)

정리:

```sql
delete from rate_limits where key = 'plan-test';
```

- [ ] **Step 4: 익명 실행이 막혔는지 확인**

```sql
select has_function_privilege('anon', 'hit_rate_limit(text, int, int)', 'execute') as anon_exec,
       has_table_privilege('anon', 'rate_limits', 'select') as anon_select;
```

Expected: `anon_exec = false, anon_select = false`.

- [ ] **Step 5: `supabase/schema.sql`에 반영**

파일 끝에 Step 1의 SQL 전체(주석 포함)를 빈 줄 하나 띄우고 그대로 붙인다.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261012000001_rate_limits.sql supabase/schema.sql
git commit -m "feat: add rate_limits table and hit_rate_limit function"
```

---

### Task 2: 입력 검증 (`validate.ts`)

**Files:**
- Create: `src/lib/validate.ts`
- Test: `src/lib/__tests__/validate.test.ts`

**Interfaces:**
- Consumes: `Task`, `WbsNode`, `TaskStatus`, `TaskPriority` from `@/types`
- Produces:
  - `isUuid(v: unknown): v is string`
  - `cleanName(v: unknown): string | null`
  - `cleanPassword(v: unknown): string | null`
  - `isDate(v: unknown): v is string`
  - `cleanTaskChanges(v: unknown): Partial<Task> | null`
  - `cleanNewTask(v: unknown): Task | null`
  - `cleanNewWbsNode(v: unknown): Omit<WbsNode, 'id'> | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isUuid, cleanName, cleanPassword, isDate, cleanTaskChanges, cleanNewTask, cleanNewWbsNode } from '../validate';

const ID = '3f2b8c1e-9a4d-4e2f-8b7a-1c2d3e4f5a6b';
const ID2 = '7a1b2c3d-4e5f-4a6b-9c8d-0e1f2a3b4c5d';

describe('isUuid', () => {
  it('accepts a v4 uuid', () => expect(isUuid(ID)).toBe(true));
  it('rejects other strings and non-strings', () => {
    expect(isUuid('abc')).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe('cleanName', () => {
  it('trims', () => expect(cleanName('  분류 A  ')).toBe('분류 A'));
  it('rejects blank, too long, non-string', () => {
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('a'.repeat(101))).toBeNull();
    expect(cleanName(5)).toBeNull();
  });
  it('accepts exactly 100 chars', () => expect(cleanName('a'.repeat(100))).toBe('a'.repeat(100)));
});

describe('cleanPassword', () => {
  it('keeps surrounding spaces so existing hashes still match', () => {
    expect(cleanPassword(' pw ')).toBe(' pw ');
  });
  it('rejects empty and too long', () => {
    expect(cleanPassword('')).toBeNull();
    expect(cleanPassword('a'.repeat(101))).toBeNull();
  });
});

describe('isDate', () => {
  it('accepts real dates', () => {
    expect(isDate('2026-10-12')).toBe(true);
    expect(isDate('2028-02-29')).toBe(true);
  });
  it('rejects impossible or malformed dates', () => {
    expect(isDate('2026-02-30')).toBe(false);
    expect(isDate('2026-13-01')).toBe(false);
    expect(isDate('2026-1-5')).toBe(false);
    expect(isDate('2026-10-12T00:00')).toBe(false);
  });
});

describe('cleanTaskChanges', () => {
  it('accepts a single end_date (calendar resize)', () => {
    expect(cleanTaskChanges({ end_date: '2026-10-20' })).toEqual({ end_date: '2026-10-20' });
  });
  it('accepts same-day start and end', () => {
    expect(cleanTaskChanges({ start_date: '2026-10-12', end_date: '2026-10-12' })).not.toBeNull();
  });
  it('rejects start after end', () => {
    expect(cleanTaskChanges({ start_date: '2026-10-13', end_date: '2026-10-12' })).toBeNull();
  });
  it('drops unknown fields and rejects when nothing editable remains', () => {
    expect(cleanTaskChanges({ name: '작업', id: ID, evil: 1 })).toEqual({ name: '작업' });
    expect(cleanTaskChanges({ evil: 1 })).toBeNull();
  });
  it('allows clearing nullable fields', () => {
    expect(cleanTaskChanges({ assignee_id: null, priority: null, memo: null, url: null }))
      .toEqual({ assignee_id: null, priority: null, memo: null, url: null });
  });
  it('rejects bad enums, ids and oversized text', () => {
    expect(cleanTaskChanges({ status: 'archived' })).toBeNull();
    expect(cleanTaskChanges({ priority: 'urgent' })).toBeNull();
    expect(cleanTaskChanges({ wbs_node_id: 'x' })).toBeNull();
    expect(cleanTaskChanges({ memo: 'a'.repeat(2001) })).toBeNull();
    expect(cleanTaskChanges({ name: '  ' })).toBeNull();
  });
});

describe('cleanNewTask', () => {
  const base = { id: ID, name: ' 새 작업 ', start_date: '2026-10-12', end_date: '2026-10-14', wbs_node_id: ID2, status: 'todo' };
  it('fills optional fields with defaults', () => {
    expect(cleanNewTask(base)).toEqual({
      id: ID, name: '새 작업', start_date: '2026-10-12', end_date: '2026-10-14', wbs_node_id: ID2,
      status: 'todo', assignee_id: null, priority: null, memo: null, url: null,
    });
  });
  it('requires id, name, dates and category', () => {
    expect(cleanNewTask({ ...base, id: 'x' })).toBeNull();
    expect(cleanNewTask({ ...base, name: undefined })).toBeNull();
    expect(cleanNewTask({ ...base, end_date: undefined })).toBeNull();
    expect(cleanNewTask({ ...base, wbs_node_id: undefined })).toBeNull();
  });
});

describe('cleanNewWbsNode', () => {
  const base = { project_id: ID, parent_id: null, name: ' 기획 ', sort_order: 1, color: '#4472C4', depth: 0 };
  it('accepts a root node and trims the name', () => {
    expect(cleanNewWbsNode(base)).toEqual({ ...base, name: '기획' });
  });
  it('accepts a child node', () => {
    expect(cleanNewWbsNode({ ...base, parent_id: ID2, depth: 1 })).not.toBeNull();
  });
  it('rejects bad color, depth, parent and project', () => {
    expect(cleanNewWbsNode({ ...base, color: 'red' })).toBeNull();
    expect(cleanNewWbsNode({ ...base, depth: -1 })).toBeNull();
    expect(cleanNewWbsNode({ ...base, depth: 1.5 })).toBeNull();
    expect(cleanNewWbsNode({ ...base, parent_id: 'x' })).toBeNull();
    expect(cleanNewWbsNode({ ...base, project_id: undefined })).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/validate.test.ts`
Expected: FAIL — `Failed to resolve import "../validate"`

- [ ] **Step 3: 구현**

`src/lib/validate.ts`:

```ts
import type { Task, WbsNode, TaskStatus, TaskPriority } from '@/types';

// Server-side input checks for server actions. Each returns the cleaned value or null.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLOR = /^#[0-9a-f]{6}$/i;
const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done'];
const PRIORITIES: TaskPriority[] = ['high', 'medium', 'low'];
const NAME_MAX = 100;
const TEXT_MAX = 2000;
const TASK_FIELDS = ['name', 'start_date', 'end_date', 'assignee_id', 'status', 'priority', 'memo', 'url', 'wbs_node_id'] as const;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v);
}

export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length >= 1 && s.length <= NAME_MAX ? s : null;
}

// no trim: passwords were hashed exactly as typed, so trimming would break existing logins
export function cleanPassword(v: unknown): string | null {
  return typeof v === 'string' && v.length >= 1 && v.length <= NAME_MAX ? v : null;
}

export function isDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function isOptionalText(v: unknown): v is string | null {
  return v === null || (typeof v === 'string' && v.length <= TEXT_MAX);
}

// Checks only the editable fields present; unknown fields are dropped.
// Start/end order is checked when both are given (a calendar resize sends end_date alone).
export function cleanTaskChanges(v: unknown): Partial<Task> | null {
  if (!v || typeof v !== 'object') return null;
  const src = v as Record<string, unknown>;
  const out: Partial<Task> = {};
  for (const key of TASK_FIELDS) {
    if (!(key in src) || src[key] === undefined) continue;
    const val = src[key];
    switch (key) {
      case 'name': {
        const name = cleanName(val);
        if (!name) return null;
        out.name = name;
        break;
      }
      case 'start_date':
      case 'end_date':
        if (!isDate(val)) return null;
        out[key] = val;
        break;
      case 'wbs_node_id':
        if (!isUuid(val)) return null;
        out.wbs_node_id = val;
        break;
      case 'assignee_id':
        if (val !== null && !isUuid(val)) return null;
        out.assignee_id = val;
        break;
      case 'status':
        if (!STATUSES.includes(val as TaskStatus)) return null;
        out.status = val as TaskStatus;
        break;
      case 'priority':
        if (val !== null && !PRIORITIES.includes(val as TaskPriority)) return null;
        out.priority = val as TaskPriority | null;
        break;
      case 'memo':
      case 'url':
        if (!isOptionalText(val)) return null;
        out[key] = val;
        break;
    }
  }
  if (Object.keys(out).length === 0) return null;
  if (out.start_date && out.end_date && out.start_date > out.end_date) return null;
  return out;
}

export function cleanNewTask(v: unknown): Task | null {
  if (!v || typeof v !== 'object') return null;
  const src = v as Record<string, unknown>;
  if (!isUuid(src.id)) return null;
  const fields = cleanTaskChanges(src);
  if (!fields?.name || !fields.start_date || !fields.end_date || !fields.wbs_node_id) return null;
  return {
    assignee_id: null, status: 'todo', priority: null, memo: null, url: null,
    ...fields,
    id: src.id,
  } as Task;
}

export function cleanNewWbsNode(v: unknown): Omit<WbsNode, 'id'> | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  const name = cleanName(s.name);
  if (!name || !isUuid(s.project_id)) return null;
  if (s.parent_id !== null && !isUuid(s.parent_id)) return null;
  if (typeof s.color !== 'string' || !COLOR.test(s.color)) return null;
  if (typeof s.depth !== 'number' || !Number.isInteger(s.depth) || s.depth < 0) return null;
  if (typeof s.sort_order !== 'number' || !Number.isInteger(s.sort_order)) return null;
  return { project_id: s.project_id, parent_id: s.parent_id, name, color: s.color, depth: s.depth, sort_order: s.sort_order };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/__tests__/validate.test.ts`
Expected: PASS (all)

Run: `npx tsc --noEmit`
Expected: 출력 없음

- [ ] **Step 5: Commit**

```bash
git add src/lib/validate.ts src/lib/__tests__/validate.test.ts
git commit -m "feat: add server-side input validation helpers"
```

---

### Task 3: 레이트 리밋 로직, 액션 결과 타입, 비밀번호 비교

DB나 Next.js에 의존하지 않는 순수 부분만 모은다. 테스트할 수 있게 `server-only`는 여기서 import하지 않는다.

**Files:**
- Create: `src/lib/server/rateLimit.ts`, `src/lib/actionResult.ts`, `src/lib/server/password.ts`
- Test: `src/lib/__tests__/rateLimit.test.ts`, `src/lib/__tests__/actionResult.test.ts`, `src/lib/__tests__/password.test.ts`

**Interfaces:**
- Consumes: `hashPin(pin: string): Promise<string>` from `@/lib/auth`
- Produces:
  - `type LimitKind = 'project_create' | 'create' | 'read' | 'write' | 'auth'`
  - `LIMITS: Record<LimitKind, { windowSeconds: number; max: number }>`
  - `clientIp(forwardedFor: string | null): string`
  - `type HitRpc = (args: { p_key: string; p_window_seconds: number; p_max: number }) => PromiseLike<{ data: unknown; error: unknown }>`
  - `isAllowed(hit: HitRpc, kind: LimitKind, ip: string): Promise<boolean>`
  - `type ActionError = { code: string; message: string }`
  - `type ActionResult<T> = { data: T | null; error: ActionError | null }`
  - `RATE_LIMITED_MESSAGE: string`
  - `ok<T>(data: T): ActionResult<T>`
  - `fail(code: string, message?: string): ActionResult<never>`
  - `fromDb<T>(res: { data: T | null; error: { code: string; message: string } | null }): ActionResult<T>`
  - `errorMessage(error: ActionError | null, fallback: string): string`
  - `passwordMatches(password: string, hash: string): Promise<boolean>`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/rateLimit.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { clientIp, isAllowed, LIMITS } from '../server/rateLimit';

describe('clientIp', () => {
  it('takes the first forwarded address, trimmed', () => {
    expect(clientIp(' 203.0.113.7 , 10.0.0.1')).toBe('203.0.113.7');
  });
  it('handles a single address', () => expect(clientIp('198.51.100.2')).toBe('198.51.100.2'));
  it('falls back to "unknown" when missing or empty', () => {
    expect(clientIp(null)).toBe('unknown');
    expect(clientIp('')).toBe('unknown');
    expect(clientIp(' , 10.0.0.1')).toBe('unknown');
  });
});

describe('isAllowed', () => {
  it('passes kind-scoped key and the configured limit to the rpc', async () => {
    const hit = vi.fn().mockResolvedValue({ data: true, error: null });
    await isAllowed(hit, 'create', '203.0.113.7');
    expect(hit).toHaveBeenCalledWith({
      p_key: 'create:203.0.113.7',
      p_window_seconds: LIMITS.create.windowSeconds,
      p_max: LIMITS.create.max,
    });
  });
  it('allows when the rpc returns true', async () => {
    expect(await isAllowed(async () => ({ data: true, error: null }), 'read', 'x')).toBe(true);
  });
  it('blocks when the rpc returns false', async () => {
    expect(await isAllowed(async () => ({ data: false, error: null }), 'read', 'x')).toBe(false);
  });
  it('fails open when the rpc reports an error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await isAllowed(async () => ({ data: null, error: { message: 'down' } }), 'read', 'x')).toBe(true);
    spy.mockRestore();
  });
  it('fails open when the rpc throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await isAllowed(async () => { throw new Error('network'); }, 'read', 'x')).toBe(true);
    spy.mockRestore();
  });
});

describe('LIMITS', () => {
  it('matches the spec', () => {
    expect(LIMITS).toEqual({
      project_create: { windowSeconds: 3600, max: 5 },
      create: { windowSeconds: 60, max: 60 },
      read: { windowSeconds: 60, max: 900 },
      write: { windowSeconds: 60, max: 300 },
      auth: { windowSeconds: 60, max: 10 },
    });
  });
});
```

`src/lib/__tests__/actionResult.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ok, fail, fromDb, errorMessage, RATE_LIMITED_MESSAGE } from '../actionResult';

describe('fromDb', () => {
  it('keeps data on success', () => {
    expect(fromDb({ data: [1], error: null })).toEqual({ data: [1], error: null });
  });
  it('keeps the postgres code so callers can treat 23505 as already-saved', () => {
    expect(fromDb({ data: null, error: { code: '23505', message: 'duplicate key' } }))
      .toEqual({ data: null, error: { code: '23505', message: 'duplicate key' } });
  });
});

describe('ok / fail', () => {
  it('builds plain results', () => {
    expect(ok('x')).toEqual({ data: 'x', error: null });
    expect(fail('rate_limited')).toEqual({ data: null, error: { code: 'rate_limited', message: 'rate_limited' } });
  });
});

describe('errorMessage', () => {
  it('uses the rate limit copy for rate_limited', () => {
    expect(errorMessage({ code: 'rate_limited', message: '' }, '작업 추가에 실패했습니다')).toBe(RATE_LIMITED_MESSAGE);
    expect(RATE_LIMITED_MESSAGE).toBe('요청이 너무 많아요. 잠시 후 다시 시도해 주세요');
  });
  it('uses the fallback otherwise, including null', () => {
    expect(errorMessage({ code: '42501', message: '' }, '작업 추가에 실패했습니다')).toBe('작업 추가에 실패했습니다');
    expect(errorMessage(null, '작업 추가에 실패했습니다')).toBe('작업 추가에 실패했습니다');
  });
});
```

`src/lib/__tests__/password.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hashPin } from '../auth';
import { passwordMatches } from '../server/password';

describe('passwordMatches', () => {
  it('matches the hash of the same password', async () => {
    expect(await passwordMatches('secret', await hashPin('secret'))).toBe(true);
  });
  it('rejects a different password', async () => {
    expect(await passwordMatches('wrong', await hashPin('secret'))).toBe(false);
  });
  it('rejects a malformed stored hash without throwing', async () => {
    expect(await passwordMatches('secret', 'not-hex')).toBe(false);
    expect(await passwordMatches('secret', '')).toBe(false);
  });
  it('is whitespace-sensitive', async () => {
    expect(await passwordMatches(' secret', await hashPin('secret'))).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/rateLimit.test.ts src/lib/__tests__/actionResult.test.ts src/lib/__tests__/password.test.ts`
Expected: FAIL — 세 모듈 모두 resolve 실패

- [ ] **Step 3: 구현**

`src/lib/server/rateLimit.ts`:

```ts
// Pure rate limit logic; the DB call is injected so this stays testable.

export type LimitKind = 'project_create' | 'create' | 'read' | 'write' | 'auth';

export const LIMITS: Record<LimitKind, { windowSeconds: number; max: number }> = {
  project_create: { windowSeconds: 3600, max: 5 },
  create: { windowSeconds: 60, max: 60 },
  read: { windowSeconds: 60, max: 900 },
  write: { windowSeconds: 60, max: 300 },
  auth: { windowSeconds: 60, max: 10 },
};

export type HitRpc = (args: { p_key: string; p_window_seconds: number; p_max: number }) => PromiseLike<{ data: unknown; error: unknown }>;

// Vercel overwrites x-forwarded-for, so the first entry is the real client
export function clientIp(forwardedFor: string | null): string {
  return forwardedFor?.split(',')[0]?.trim() || 'unknown';
}

// ponytail: fixed window, so up to 2x max can pass across a window boundary; use a sliding window if that ever matters
export async function isAllowed(hit: HitRpc, kind: LimitKind, ip: string): Promise<boolean> {
  const { windowSeconds, max } = LIMITS[kind];
  try {
    const { data, error } = await hit({ p_key: `${kind}:${ip}`, p_window_seconds: windowSeconds, p_max: max });
    if (error) throw error;
    return data !== false;
  } catch (e) {
    // fail open: a broken limiter must not lock out real users
    console.error('rate limit check failed', e);
    return true;
  }
}
```

`src/lib/actionResult.ts`:

```ts
// Result shape shared by server actions and their callers; mirrors supabase-js so call sites barely change.

export type ActionError = { code: string; message: string };
export type ActionResult<T> = { data: T | null; error: ActionError | null };

export const RATE_LIMITED_MESSAGE = '요청이 너무 많아요. 잠시 후 다시 시도해 주세요';

export function ok<T>(data: T): ActionResult<T> {
  return { data, error: null };
}

export function fail(code: string, message = code): ActionResult<never> {
  return { data: null, error: { code, message } };
}

// copies only plain fields: server actions can't return PostgrestError instances
export function fromDb<T>(res: { data: T | null; error: { code: string; message: string } | null }): ActionResult<T> {
  return res.error ? fail(res.error.code, res.error.message) : ok(res.data as T);
}

export function errorMessage(error: ActionError | null, fallback: string): string {
  return error?.code === 'rate_limited' ? RATE_LIMITED_MESSAGE : fallback;
}
```

`src/lib/server/password.ts`:

```ts
import { timingSafeEqual } from 'crypto';
import { hashPin } from '@/lib/auth';

// constant-time compare so response timing can't leak how much of the hash matched
export async function passwordMatches(password: string, hash: string): Promise<boolean> {
  const a = Buffer.from(await hashPin(password), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/__tests__/rateLimit.test.ts src/lib/__tests__/actionResult.test.ts src/lib/__tests__/password.test.ts`
Expected: PASS (all)

Run: `npx tsc --noEmit`
Expected: 출력 없음

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/rateLimit.ts src/lib/actionResult.ts src/lib/server/password.ts src/lib/__tests__/rateLimit.test.ts src/lib/__tests__/actionResult.test.ts src/lib/__tests__/password.test.ts
git commit -m "feat: add rate limit, action result and password compare helpers"
```

---

### Task 4: 서버 DB 클라이언트와 서버 액션

**Files:**
- Create: `src/lib/server/db.ts`, `src/app/actions.ts`
- Modify: `src/types/index.ts` (타입 추가), `package.json` (`server-only` 추가)

**Interfaces:**
- Consumes: Task 2 (`validate.ts` 전부), Task 3 (`LIMITS`/`clientIp`/`isAllowed`/`LimitKind`, `ok`/`fail`/`fromDb`/`ActionResult`, `passwordMatches`), `hashPin`, Task 1의 `hit_rate_limit`
- Produces (모두 `src/app/actions.ts`에서 export, 반환은 `Promise<ActionResult<…>>`):
  - `listProjects(): ActionResult<ProjectSummary[]>`
  - `createProject(name: string, adminName: string, password: string): ActionResult<ProjectSummary>`
  - `getProjectByName(name: string): ActionResult<ProjectSummary>` — 없으면 `data: null, error: null`
  - `getProject(id: string): ActionResult<ProjectSummary>` — 없으면 `data: null, error: null`
  - `loadProjectData(projectId: string): ActionResult<{ tasks: Task[]; wbsNodes: WbsNode[]; users: User[] }>`
  - `createTask(task: Task): ActionResult<null>`
  - `updateTask(id: string, changes: Partial<Task>): ActionResult<null>`
  - `deleteTask(id: string): ActionResult<null>`
  - `loadWbsTree(projectId: string): ActionResult<{ nodes: WbsNode[]; counts: Record<string, number> }>`
  - `createWbsNode(node: Omit<WbsNode, 'id'>): ActionResult<null>`
  - `renameWbsNode(id: string, name: string): ActionResult<null>`
  - `deleteWbsNode(id: string): ActionResult<null>`
  - `verifyAdmin(projectId: string, password: string): ActionResult<{ project: ProjectSummary; users: User[] }>`
  - `addMember(projectId: string, password: string, member: { id: string; name: string }): ActionResult<null>`
  - `deleteMember(projectId: string, password: string, userId: string): ActionResult<null>`
  - `renameProject(projectId: string, password: string, name: string): ActionResult<null>`
  - `deleteProject(projectId: string, password: string): ActionResult<null>`
  - `ProjectSummary` type in `@/types`: `Pick<Project, 'id' | 'name'>`

- [ ] **Step 1: `server-only` 설치, 환경변수 확인**

```bash
npm install server-only
grep -c '^SUPABASE_SECRET_KEY=' .env.local
```

Expected: 설치 성공, `1` 출력 (이미 `.env.local`에 있음. 없으면 사용자에게 Supabase 대시보드 → Settings → API Keys의 secret key를 넣어 달라고 요청하고 멈춘다).

- [ ] **Step 2: 타입 추가**

`src/types/index.ts`의 `Project` 인터페이스 바로 아래에 추가:

```ts
// what actions return for a project: never includes admin_password_hash
export type ProjectSummary = Pick<Project, 'id' | 'name'>;
```

- [ ] **Step 3: 서버 DB 클라이언트**

`src/lib/server/db.ts`:

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';

// secret key bypasses RLS: server actions are the only way into the database
export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

- [ ] **Step 4: 서버 액션**

`src/app/actions.ts`:

```ts
'use server';

import { headers } from 'next/headers';
import { db } from '@/lib/server/db';
import { clientIp, isAllowed, type LimitKind } from '@/lib/server/rateLimit';
import { passwordMatches } from '@/lib/server/password';
import { hashPin } from '@/lib/auth';
import { ok, fail, fromDb, type ActionResult } from '@/lib/actionResult';
import { isUuid, cleanName, cleanPassword, cleanNewTask, cleanTaskChanges, cleanNewWbsNode } from '@/lib/validate';
import type { Task, WbsNode, User, ProjectSummary } from '@/types';

// Every action: rate limit → validate → query. Results mirror supabase-js ({ data, error }).

async function limited(kind: LimitKind): Promise<boolean> {
  const ip = clientIp(headers().get('x-forwarded-for'));
  return !(await isAllowed((args) => db.rpc('hit_rate_limit', args), kind, ip));
}

const rateLimited = () => fail('rate_limited', 'Too many requests');
const invalid = () => fail('invalid_input', 'Invalid input');
const unauthorized = () => fail('unauthorized', 'Wrong admin password');

async function adminOk(projectId: unknown, password: unknown): Promise<boolean> {
  const pw = cleanPassword(password);
  if (!isUuid(projectId) || !pw) return false;
  const { data } = await db.from('projects').select('admin_password_hash').eq('id', projectId).maybeSingle();
  return !!data?.admin_password_hash && (await passwordMatches(pw, data.admin_password_hash));
}

// ponytail: in.(...) puts every category id in the URL; switch to an inner-join filter if a project ever has hundreds of categories
async function tasksOf(nodeIds: string[], columns = '*') {
  if (nodeIds.length === 0) return { data: [], error: null };
  return db.from('tasks').select(columns).in('wbs_node_id', nodeIds);
}

// ---- projects ----

export async function listProjects(): Promise<ActionResult<ProjectSummary[]>> {
  if (await limited('read')) return rateLimited();
  return fromDb(await db.from('projects').select('id, name').order('created_at', { ascending: false }));
}

export async function createProject(name: string, adminName: string, password: string): Promise<ActionResult<ProjectSummary>> {
  if (await limited('project_create')) return rateLimited();
  const projectName = cleanName(name);
  const admin = cleanName(adminName);
  const pw = cleanPassword(password);
  if (!projectName || !admin || !pw) return invalid();

  const p = await db.from('projects').insert({ name: projectName, admin_password_hash: await hashPin(pw) }).select('id, name').single();
  if (p.error) return fromDb(p);
  const u = await db.from('users').insert({ name: admin, pin_hash: null, role: 'pm', project_id: p.data.id }).select('id').single();
  if (u.error) {
    await db.from('projects').delete().eq('id', p.data.id); // don't leave a project nobody administers
    return fromDb(u);
  }
  await db.from('projects').update({ owner_id: u.data.id }).eq('id', p.data.id);
  return ok(p.data);
}

export async function getProjectByName(name: string): Promise<ActionResult<ProjectSummary>> {
  if (await limited('read')) return rateLimited();
  if (typeof name !== 'string') return invalid();
  return fromDb(await db.from('projects').select('id, name').eq('name', name).maybeSingle());
}

export async function getProject(id: string): Promise<ActionResult<ProjectSummary>> {
  if (await limited('read')) return rateLimited();
  if (!isUuid(id)) return invalid();
  return fromDb(await db.from('projects').select('id, name').eq('id', id).maybeSingle());
}

export async function loadProjectData(projectId: string): Promise<ActionResult<{ tasks: Task[]; wbsNodes: WbsNode[]; users: User[] }>> {
  if (await limited('read')) return rateLimited();
  if (!isUuid(projectId)) return invalid();
  const [n, u] = await Promise.all([
    db.from('wbs_nodes').select('*').eq('project_id', projectId),
    db.from('users').select('*').eq('project_id', projectId),
  ]);
  if (n.error) return fromDb(n);
  if (u.error) return fromDb(u);
  const t = await tasksOf(n.data.map((node) => node.id));
  if (t.error) return fromDb(t);
  return ok({ tasks: t.data as Task[], wbsNodes: n.data, users: u.data });
}

// ---- tasks ----

export async function createTask(task: Task): Promise<ActionResult<null>> {
  if (await limited('create')) return rateLimited();
  const clean = cleanNewTask(task);
  if (!clean) return invalid();
  return fromDb(await db.from('tasks').insert(clean));
}

export async function updateTask(id: string, changes: Partial<Task>): Promise<ActionResult<null>> {
  if (await limited('write')) return rateLimited();
  const clean = cleanTaskChanges(changes);
  if (!isUuid(id) || !clean) return invalid();
  return fromDb(await db.from('tasks').update(clean).eq('id', id));
}

export async function deleteTask(id: string): Promise<ActionResult<null>> {
  if (await limited('write')) return rateLimited();
  if (!isUuid(id)) return invalid();
  return fromDb(await db.from('tasks').delete().eq('id', id));
}

// ---- categories ----

export async function loadWbsTree(projectId: string): Promise<ActionResult<{ nodes: WbsNode[]; counts: Record<string, number> }>> {
  if (await limited('read')) return rateLimited();
  if (!isUuid(projectId)) return invalid();
  const n = await db.from('wbs_nodes').select('*').eq('project_id', projectId).order('sort_order');
  if (n.error) return fromDb(n);
  const t = await tasksOf(n.data.map((node) => node.id), 'wbs_node_id');
  if (t.error) return fromDb(t);
  const counts: Record<string, number> = {};
  (t.data as { wbs_node_id: string }[]).forEach(({ wbs_node_id }) => { counts[wbs_node_id] = (counts[wbs_node_id] ?? 0) + 1; });
  return ok({ nodes: n.data, counts });
}

export async function createWbsNode(node: Omit<WbsNode, 'id'>): Promise<ActionResult<null>> {
  if (await limited('create')) return rateLimited();
  const clean = cleanNewWbsNode(node);
  if (!clean) return invalid();
  return fromDb(await db.from('wbs_nodes').insert(clean));
}

export async function renameWbsNode(id: string, name: string): Promise<ActionResult<null>> {
  if (await limited('write')) return rateLimited();
  const clean = cleanName(name);
  if (!isUuid(id) || !clean) return invalid();
  return fromDb(await db.from('wbs_nodes').update({ name: clean }).eq('id', id));
}

export async function deleteWbsNode(id: string): Promise<ActionResult<null>> {
  if (await limited('write')) return rateLimited();
  if (!isUuid(id)) return invalid();
  return fromDb(await db.from('wbs_nodes').delete().eq('id', id));
}

// ---- admin (password re-checked on every call) ----

export async function verifyAdmin(projectId: string, password: string): Promise<ActionResult<{ project: ProjectSummary; users: User[] }>> {
  if (await limited('auth')) return rateLimited();
  if (!(await adminOk(projectId, password))) return unauthorized();
  const [p, u] = await Promise.all([
    db.from('projects').select('id, name').eq('id', projectId).single(),
    db.from('users').select('*').eq('project_id', projectId),
  ]);
  if (p.error) return fromDb(p);
  if (u.error) return fromDb(u);
  return ok({ project: p.data, users: u.data });
}

export async function addMember(projectId: string, password: string, member: { id: string; name: string }): Promise<ActionResult<null>> {
  if (await limited('create')) return rateLimited();
  if (!(await adminOk(projectId, password))) return unauthorized();
  const name = cleanName(member?.name);
  if (!isUuid(member?.id) || !name) return invalid();
  return fromDb(await db.from('users').insert({ id: member.id, name, pin_hash: null, role: 'member', project_id: projectId }));
}

export async function deleteMember(projectId: string, password: string, userId: string): Promise<ActionResult<null>> {
  if (await limited('write')) return rateLimited();
  if (!(await adminOk(projectId, password))) return unauthorized();
  if (!isUuid(userId)) return invalid();
  // scoped to this project's members: the admin (pm) row can't be removed here
  return fromDb(await db.from('users').delete().eq('id', userId).eq('project_id', projectId).eq('role', 'member'));
}

export async function renameProject(projectId: string, password: string, name: string): Promise<ActionResult<null>> {
  if (await limited('write')) return rateLimited();
  if (!(await adminOk(projectId, password))) return unauthorized();
  const clean = cleanName(name);
  if (!clean) return invalid();
  return fromDb(await db.from('projects').update({ name: clean }).eq('id', projectId));
}

export async function deleteProject(projectId: string, password: string): Promise<ActionResult<null>> {
  if (await limited('write')) return rateLimited();
  if (!(await adminOk(projectId, password))) return unauthorized();
  return fromDb(await db.from('projects').delete().eq('id', projectId));
}
```

- [ ] **Step 5: 타입 체크와 기존 테스트**

Run: `npx tsc --noEmit`
Expected: 출력 없음. (Supabase 클라이언트에 DB 타입 제네릭이 없어 `data`는 `any`로 추론된다. `tasksOf`의 두 반환 분기 타입이 달라 오류가 나면 `tasksOf`의 반환 타입을 `Promise<{ data: any[] | null; error: { code: string; message: string } | null }>`로 명시한다.)

Run: `npx vitest run`
Expected: PASS (all)

- [ ] **Step 6: 빌드 확인**

아직 액션을 부르는 페이지가 없으므로, 실제 DB 호출은 Task 5~7의 화면 확인에서 검증한다. 여기서는 서버 액션 번들이 만들어지는지만 본다.

Run: `npm run build`
Expected: 빌드 성공. `server-only` 관련 오류가 없어야 한다 (오류가 나면 클라이언트 컴포넌트가 `@/lib/server/db`를 직접 import한 것).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/types/index.ts src/lib/server/db.ts src/app/actions.ts
git commit -m "feat: add server actions with per-IP rate limits and validation"
```

---

### Task 5: 첫 화면을 액션으로 전환

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `listProjects`, `createProject` from `./actions`; `errorMessage` from `@/lib/actionResult`; `ProjectSummary` from `@/types`

- [ ] **Step 1: import와 캐시 타입 변경**

`src/app/page.tsx` 상단 import에서 다음 두 줄을 지운다:

```ts
import { supabase } from '@/lib/supabase';
import { hashPin } from '@/lib/auth';
```

그리고 `import type { Project } from '@/types';`를 아래로 바꾼다:

```ts
import { listProjects, createProject } from './actions';
import { errorMessage } from '@/lib/actionResult';
import type { ProjectSummary } from '@/types';
```

`let cachedProjects: Project[] | null = null;` → `let cachedProjects: ProjectSummary[] | null = null;`
`useState<Project[]>(cachedProjects ?? [])` → `useState<ProjectSummary[]>(cachedProjects ?? [])`

- [ ] **Step 2: 목록 로드 실패 상태 추가**

`const [loaded, setLoaded] = useState(cachedProjects !== null);` 아래에 추가:

```ts
  // without this, a failed load would look like "no projects yet" and show the setup form
  const [loadError, setLoadError] = useState<string | null>(null);
```

`loadProjects` 함수를 통째로 교체:

```ts
  async function loadProjects() {
    const { data, error } = await listProjects();
    if (data) {
      cachedProjects = data;
      setProjects(data);
      setLoadError(null);
    } else {
      console.error(error);
      setLoadError(errorMessage(error, '프로젝트 목록을 불러오지 못했습니다. 새로고침해 주세요'));
    }
    setLoaded(true);
  }
```

- [ ] **Step 3: 프로젝트 생성 교체**

`handleSetup` 함수를 통째로 교체:

```ts
  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!setupProject.trim() || !setupName.trim() || !setupPassword.trim()) {
      setSetupError('모든 필드를 입력하세요');
      return;
    }
    setSetupLoading(true);
    setSetupError(null);

    const { data, error } = await createProject(setupProject, setupName, setupPassword);
    if (!data) {
      console.error(error);
      setSetupError(errorMessage(error, '프로젝트를 만들지 못했습니다. 다시 시도해 주세요'));
      setSetupLoading(false);
      return;
    }
    router.push(`/${encodeURIComponent(data.name)}`);
  }
```

- [ ] **Step 4: 로드 실패 시 안내 렌더링**

`if (!loaded) return null;` 바로 아래에 추가:

```tsx
  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen p-lg">
        <p className="text-body-sm text-muted text-center">{loadError}</p>
      </div>
    );
  }
```

- [ ] **Step 5: 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 출력 없음, PASS

Run: `npm run dev` 후 http://localhost:3100 접속
Expected:
- 프로젝트 목록이 보인다.
- `+ 새 프로젝트`로 `테스트-삭제예정` 프로젝트(관리자 `테스터`, 비밀번호 `test1234`)를 만들면 `/테스트-삭제예정`로 이동한다.
- DevTools Network 탭에서 `supabase.co`로 가는 요청이 첫 화면에서는 없다.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: load and create projects through server actions"
```

---

### Task 6: 캘린더와 분류 트리를 액션으로 전환

**Files:**
- Modify: `src/app/[projectName]/page.tsx`
- Modify: `src/components/WbsTree.tsx`

**Interfaces:**
- Consumes: `getProjectByName`, `loadProjectData`, `createTask`, `updateTask`, `deleteTask`, `loadWbsTree`, `createWbsNode`, `renameWbsNode`, `deleteWbsNode` from `@/app/actions`; `errorMessage` from `@/lib/actionResult`

- [ ] **Step 1: 캘린더 페이지 import**

`src/app/[projectName]/page.tsx`에서 `import { supabase } from '@/lib/supabase';`를 지우고 아래로 바꾼다:

```ts
import { getProjectByName, loadProjectData, createTask, updateTask, deleteTask } from '@/app/actions';
import { errorMessage } from '@/lib/actionResult';
```

- [ ] **Step 2: 데이터 로드 교체**

`loadData`와 그 아래 `useEffect`를 통째로 교체:

```ts
  const loadData = useCallback(async (pid: string) => {
    const { data, error } = await loadProjectData(pid);
    if (!data) {
      console.error(error);
      showToast({ message: errorMessage(error, '데이터를 불러오지 못했습니다') });
      return;
    }
    setTasks(data.tasks);
    setWbsNodes(data.wbsNodes);
    setUsers(data.users);
    // showToast only touches state setters and a ref, so it's safe to leave out of deps
  }, []);

  useEffect(() => {
    getProjectByName(decodeURIComponent(params.projectName)).then(({ data, error }) => {
      if (error) {
        console.error(error);
        showToast({ message: errorMessage(error, '프로젝트를 불러오지 못했습니다') });
        return;
      }
      if (!data) { setNotFound(true); return; }
      setProjectId(data.id);
      setProjectName(data.name);
      loadData(data.id);
    });
  }, [params.projectName, loadData]);
```

- [ ] **Step 3: 작업 수정·추가·삭제 교체**

`handleUpdateTask`를 교체:

```ts
  async function handleUpdateTask(taskId: string, changes: Partial<Task>) {
    const { error } = await updateTask(taskId, changes);
    if (error) {
      console.error(error);
      showToast({ message: errorMessage(error, '작업 수정에 실패했습니다') });
    }
    // reload either way: on failure this snaps a dragged bar back to its saved dates
    if (projectId) await loadData(projectId);
  }
```

`insertTask` 안의

```ts
    const { error } = await supabase.from('tasks').insert(task);
```

를

```ts
    const { error } = await createTask(task);
```

로, 같은 함수의 토스트 문구 `'작업 추가에 실패했습니다'`를 `errorMessage(error, '작업 추가에 실패했습니다')`로 바꾼다.

`handleDeleteTask` 안의

```ts
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
```

를

```ts
    const { error } = await deleteTask(task.id);
```

로, 토스트 문구 `'작업 삭제에 실패했습니다'`를 `errorMessage(error, '작업 삭제에 실패했습니다')`로 바꾼다.

- [ ] **Step 4: 분류 트리 import**

`src/components/WbsTree.tsx`에서 `import { supabase } from '@/lib/supabase';`를 지우고 아래로 바꾼다:

```ts
import { loadWbsTree, createWbsNode, renameWbsNode, deleteWbsNode } from '@/app/actions';
import { errorMessage } from '@/lib/actionResult';
```

- [ ] **Step 5: 분류 트리 로드 교체**

`loadTree`를 교체:

```ts
  const loadTree = useCallback(async () => {
    const { data, error } = await loadWbsTree(projectId);
    if (!data) {
      console.error(error);
      showToast({ message: errorMessage(error, '분류를 불러오지 못했습니다') });
      return;
    }
    setTree(buildTree(data.nodes, data.counts));
  }, [projectId]);
```

- [ ] **Step 6: 분류 추가·이름 변경·삭제 교체**

`confirmAdd` 안의 `supabase.from('wbs_nodes').insert({...})` 호출을 아래로 교체 (객체 내용은 그대로):

```ts
    const { error } = await createWbsNode({
      project_id: projectId,
      parent_id: parentId,
      name: newName.trim(),
      sort_order: sortOrder,
      color,
      depth,
    });
    if (error) {
      console.error(error);
      showToast({ message: errorMessage(error, '분류 추가에 실패했습니다') });
    }
```

`handleRename`을 교체:

```ts
  async function handleRename(id: string) {
    if (!editName.trim()) return;
    const { error } = await renameWbsNode(id, editName);
    if (error) {
      console.error(error);
      showToast({ message: errorMessage(error, '분류 이름 변경에 실패했습니다') });
    }
    setEditingId(null);
    await loadTree();
    onDataChange?.();
  }
```

`confirmDelete`를 교체:

```ts
  async function confirmDelete() {
    if (!deletingId) return;
    const { error } = await deleteWbsNode(deletingId);
    if (error) {
      console.error(error);
      showToast({ message: errorMessage(error, '분류 삭제에 실패했습니다') });
    }
    setDeletingId(null);
    await loadTree();
    onDataChange?.();
  }
```

- [ ] **Step 7: 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 출력 없음, PASS

`npm run dev` 상태에서 Task 5에서 만든 `/테스트-삭제예정` 접속:
- 분류 `기획` 추가 → 하위 분류 `조사` 추가 → `조사`를 `리서치`로 이름 변경
- 캘린더에서 드래그로 작업 `테스트 작업` 추가 → 막대를 다른 날로 드래그 → 팝오버에서 메모 입력 → 작업 삭제
- 다른 프로젝트의 작업이 이 프로젝트 화면이나 분류별 작업 수에 섞이지 않는다
- DevTools Network 탭에 `supabase.co` 요청이 없다

- [ ] **Step 8: Commit**

```bash
git add "src/app/[projectName]/page.tsx" src/components/WbsTree.tsx
git commit -m "feat: route calendar and category tree through server actions"
```

---

### Task 7: 설정 페이지를 액션과 서버 인증으로 전환

**Files:**
- Modify: `src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `getProject`, `verifyAdmin`, `addMember`, `deleteMember`, `renameProject`, `deleteProject` from `@/app/actions`; `errorMessage` from `@/lib/actionResult`; `ProjectSummary` from `@/types`

- [ ] **Step 1: import와 상태 타입**

다음 두 줄을 지운다:

```ts
import { supabase } from '@/lib/supabase';
import { verifyPin } from '@/lib/auth';
```

아래를 추가하고, `import type { User, Project } from '@/types';`를 `import type { User, ProjectSummary } from '@/types';`로 바꾼다:

```ts
import { getProject, verifyAdmin, addMember, deleteMember, renameProject, deleteProject } from '@/app/actions';
import { errorMessage } from '@/lib/actionResult';
```

`useState<Project | null>(null)` → `useState<ProjectSummary | null>(null)`

- [ ] **Step 2: 첫 로드 교체**

`projectIdParam`을 쓰는 `useEffect`를 교체:

```ts
  useEffect(() => {
    if (!projectIdParam) { router.replace('/'); return; }
    getProject(projectIdParam).then(({ data, error }) => {
      if (error) {
        console.error(error);
        showToast({ message: errorMessage(error, '프로젝트를 불러오지 못했습니다') });
        return;
      }
      if (!data) { router.replace('/'); return; }
      setProject(data);
    });
  }, [projectIdParam, router]);
```

- [ ] **Step 3: 인증 교체, `loadData` 제거**

`handleAuth`와 `loadData` 두 함수를 통째로 아래 하나로 교체:

```ts
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    const { data, error } = await verifyAdmin(project.id, password);
    if (!data) {
      setAuthError(error?.code === 'unauthorized'
        ? '비밀번호가 올바르지 않습니다'
        : errorMessage(error, '인증하지 못했습니다. 다시 시도해 주세요'));
      return;
    }
    // password stays in memory only: admin actions send it so the server can re-check
    setUsers(data.users);
    setProject(data.project);
    setProjectName(data.project.name);
    initialName.current = data.project.name;
    setVerified(true);
    setAuthError(null);
  }
```

- [ ] **Step 4: 관리자 작업 교체**

`insertUser` 안의 `const { error } = await supabase.from('users').insert(user);`를:

```ts
    const { error } = await addMember(user.project_id, password, { id: user.id, name: user.name });
```

같은 함수 토스트 문구 `'팀원 추가에 실패했습니다'` → `errorMessage(error, '팀원 추가에 실패했습니다')`.

`handleDeleteUser` 안의 `const { error } = await supabase.from('users').delete().eq('id', user.id);`를:

```ts
    const { error } = await deleteMember(user.project_id, password, user.id);
```

토스트 문구 `'팀원 삭제에 실패했습니다'` → `errorMessage(error, '팀원 삭제에 실패했습니다')`.

`handleSave` 안의 `const { error } = await supabase.from('projects').update({ name }).eq('id', project.id);`를:

```ts
    const { error } = await renameProject(project.id, password, name);
```

토스트 문구 `'프로젝트 이름 저장에 실패했습니다'` → `errorMessage(error, '프로젝트 이름 저장에 실패했습니다')`.

`handleDeleteProject` 안의 `const { error } = await supabase.from('projects').delete().eq('id', project.id);`를:

```ts
    const { error } = await deleteProject(project.id, password);
```

토스트 문구 `'프로젝트 삭제에 실패했습니다'` → `errorMessage(error, '프로젝트 삭제에 실패했습니다')`.

- [ ] **Step 5: 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 출력 없음, PASS

`npm run dev` 상태에서 `/테스트-삭제예정` → `설정`:
- 틀린 비밀번호 `nope` → "비밀번호가 올바르지 않습니다"
- `test1234` → 설정 화면, 팀원 목록에 `테스터(관리자)`
- 팀원 `홍길동` 추가 → 삭제
- 이름을 `테스트-삭제예정2`로 저장 → 캘린더로 이동 시 새 이름
- 프로젝트 삭제 → 첫 화면으로 이동, 목록에서 사라짐
- DevTools Network 응답 어디에도 `admin_password_hash`가 없다

- [ ] **Step 6: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: verify admin password on the server for settings actions"
```

---

### Task 8: 브라우저 직접 접근 코드 제거

**Files:**
- Delete: `src/lib/supabase.ts`, `src/utils/supabase/client.ts`, `src/utils/supabase/server.ts`, `src/utils/supabase/middleware.ts`
- Modify: `src/lib/auth.ts` (`verifyPin` 제거), `src/lib/__tests__/auth.test.ts` (`verifyPin` 테스트 제거), `package.json` (`@supabase/ssr` 제거), `CLAUDE.md` (환경변수)

- [ ] **Step 1: 남은 사용처가 없는지 확인**

Run: `grep -rn "@/lib/supabase\|utils/supabase\|verifyPin\|PUBLISHABLE_KEY" src`
Expected: `src/lib/supabase.ts`(PUBLISHABLE_KEY), `src/lib/auth.ts`(verifyPin 정의), `src/lib/__tests__/auth.test.ts`, `src/utils/supabase/*`만 나온다. 페이지·컴포넌트가 나오면 Task 5~7로 돌아간다.

- [ ] **Step 2: 삭제와 정리**

```bash
git rm src/lib/supabase.ts src/utils/supabase/client.ts src/utils/supabase/server.ts src/utils/supabase/middleware.ts
npm uninstall @supabase/ssr
```

`src/lib/auth.ts`에서 `verifyPin` 함수 전체를 지운다 (`hashPin`만 남는다).

`src/lib/__tests__/auth.test.ts`에서 import를 `import { hashPin } from '../auth';`로 바꾸고 `describe('verifyPin', …)` 블록 전체를 지운다.

`CLAUDE.md`의 `## 환경변수` 섹션 본문을 아래로 교체:

```markdown
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` (서버 전용, 서버 액션만 DB에 접근)
```

- [ ] **Step 3: 확인**

Run: `grep -rn "supabase.from\|@/lib/supabase\|PUBLISHABLE_KEY" src`
Expected: 결과 없음 (`src/lib/server/db.ts`와 `src/app/actions.ts`의 `db.from`은 `supabase.from` 패턴에 걸리지 않는다)

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: 모두 성공

- [ ] **Step 4: Commit**

```bash
git add -A src/lib src/utils package.json package-lock.json CLAUDE.md
git commit -m "chore: remove browser Supabase client and unused SSR helpers"
```

---

### Task 9: 배포, 잠금, 최종 확인

사용자 확인이 필요한 단계가 있다. 표시된 곳에서 멈추고 사용자에게 요청한다.

**Files:**
- Create: `supabase/migrations/20261012000002_lockdown.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: (사용자) Vercel 환경변수 등록 확인**

사용자에게 요청하고 답을 기다린다: "Vercel 프로젝트 → Settings → Environment Variables에 `SUPABASE_SECRET_KEY`(Production, Preview)를 `.env.local`과 같은 값으로 등록해 주세요. 등록하지 않고 배포하면 운영 사이트의 모든 데이터 요청이 실패합니다."

- [ ] **Step 2: (사용자 승인 후) main에 머지하고 푸시 → Vercel 배포**

```bash
git switch main
git merge --ff-only feat/db-abuse-protection
git push origin main
```

Vercel이 `main` 푸시로 자동 배포되는지 먼저 사용자에게 확인한다. 자동 배포가 아니면 사용자에게 배포를 요청한다. 배포가 끝나면 운영 사이트에서 Task 5~7의 확인 항목(프로젝트 생성, 작업·분류 편집, 설정 인증과 팀원 관리, 테스트 프로젝트 삭제)을 다시 한 번 한다. 하나라도 실패하면 잠금으로 넘어가지 않는다.

- [ ] **Step 3: 잠금 마이그레이션 작성**

`supabase/migrations/20261012000002_lockdown.sql`:

```sql
-- Close the browser's direct path: only the server (service_role bypasses RLS) can reach these tables.
alter table projects  enable row level security;
alter table users     enable row level security;
alter table wbs_nodes enable row level security;
alter table tasks     enable row level security;

revoke all on projects, users, wbs_nodes, tasks from anon, authenticated;
```

- [ ] **Step 4: 적용**

Supabase MCP `apply_migration`, `name`: `lockdown`, `query`: 위 파일 내용.

Expected: 성공 응답

- [ ] **Step 5: 직접 접근이 막혔는지 확인**

publishable key는 Supabase MCP `get_publishable_keys`로, URL은 `get_project_url`로 얻는다.

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$URL/rest/v1/projects?select=id" -H "apikey: $PUBLISHABLE_KEY"
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "$URL/rest/v1/tasks?id=eq.00000000-0000-0000-0000-000000000000" -H "apikey: $PUBLISHABLE_KEY"
```

Expected: 두 요청 모두 `401` (권한 없음, `42501`)

Supabase MCP `get_advisors` (`type: security`)
Expected: `rls_disabled_in_public` 항목 없음. (`rls_enabled_no_policy` INFO는 의도된 상태라 무시한다.)

- [ ] **Step 6: 운영 사이트 재확인**

운영 사이트를 새로고침하고 프로젝트 목록 표시, 작업 하나 추가 후 삭제를 해 본다.
Expected: 정상 동작

문제가 있으면 즉시 되돌린다:

```sql
alter table projects disable row level security;
alter table users disable row level security;
alter table wbs_nodes disable row level security;
alter table tasks disable row level security;
grant select, insert, update, delete on projects, users, wbs_nodes, tasks to anon, authenticated;
```

- [ ] **Step 7: `supabase/schema.sql`에 반영하고 커밋**

`supabase/schema.sql` 끝에 Step 3의 SQL을 그대로 붙인다.

```bash
git add supabase/migrations/20261012000002_lockdown.sql supabase/schema.sql
git commit -m "feat: enable RLS and revoke anon access on app tables"
git push origin main
```

- [ ] **Step 8: (사용자) 공개 key 환경변수 제거**

사용자에게 요청: "Vercel 환경변수에서 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 지워 주세요. 코드에서는 더 이상 쓰지 않습니다."
