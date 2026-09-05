# WBS Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사내 팀 전용 WBS 관리 캘린더 웹앱을 구축한다. 프로젝트별 WBS 계층 구조를 사이드바 트리로 관리하고, Toast UI Calendar로 월간/주간 일정을 시각화하며, PNG/Excel로 Export한다.

**Architecture:** Next.js 14 App Router 프론트엔드 + Supabase(PostgreSQL) 백엔드. 캘린더는 @toast-ui/react-calendar, 사이드바 WBS 트리는 직접 구현. 인증은 프로필 선택 + 4자리 PIN (사내 전용이므로 localStorage 세션).

**Tech Stack:** Next.js 14, TypeScript, Supabase, @toast-ui/react-calendar, html2canvas, SheetJS(xlsx), CSS Modules

**Spec:** `docs/superpowers/specs/2026-09-05-wbs-calendar-design.md`

## Global Constraints

- Node.js 18+, Next.js 14 (App Router)
- 의존성 5개만: `next`, `@supabase/supabase-js`, `@toast-ui/react-calendar`, `html2canvas`, `xlsx`
- 테스트: vitest (단위 테스트)
- 스타일: CSS Modules (별도 CSS 라이브러리 없음)
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## File Structure

```
src/
  app/
    layout.tsx                ← 루트 레이아웃 (글로벌 스타일, 폰트)
    page.tsx                  ← 로그인 페이지
    page.module.css
    calendar/
      page.tsx                ← 메인 캘린더 페이지 (레이아웃 조합)
      page.module.css
    settings/
      page.tsx                ← PM 전용 설정 페이지
      page.module.css
  components/
    PinModal.tsx              ← PIN 입력 모달
    PinModal.module.css
    WbsTree.tsx               ← WBS 계층 트리 사이드바
    WbsTree.module.css
    CalendarView.tsx           ← Toast UI Calendar 래퍼
    CalendarView.module.css
    TaskModal.tsx              ← 작업 추가/수정 모달
    TaskModal.module.css
    TaskPeekPanel.tsx          ← 작업 상세 사이드 패널
    TaskPeekPanel.module.css
    ExportButtons.tsx          ← Export 드롭다운 (PNG/XLSX)
    ExportButtons.module.css
  lib/
    supabase.ts               ← Supabase 클라이언트 싱글턴
    auth.ts                   ← PIN 해싱, 검증, 세션 관리
    wbs.ts                    ← WBS 트리 유틸 (flat→tree 변환)
    export.ts                 ← Export 유틸 (PNG 캡처, XLSX 생성)
  types/
    index.ts                  ← 공통 TypeScript 타입
supabase/
  schema.sql                  ← DB 스키마 (테이블 + RLS)
  seed.sql                    ← 개발용 시드 데이터
vitest.config.ts
```

---

### Task 1: 프로젝트 셋업 + 타입 정의 + Supabase 연결

**Files:**
- Create: `src/types/index.ts`
- Create: `src/lib/supabase.ts`
- Create: `supabase/schema.sql`
- Create: `supabase/seed.sql`
- Create: `vitest.config.ts`
- Modify: `package.json` (dependencies)

**Interfaces:**
- Produces: `Project`, `User`, `WbsNode`, `Task`, `UserRole`, `TaskStatus` 타입 — 모든 후속 Task에서 import
- Produces: `supabase` 클라이언트 인스턴스 — 모든 DB 접근에 사용

- [ ] **Step 1: Next.js 프로젝트 생성**

```bash
npx create-next-app@14 . --typescript --app --src-dir --no-tailwind --no-eslint --import-alias "@/*"
```

이미 git repo이므로 `.git`은 유지됨. `--no-tailwind` — CSS Modules 사용.

- [ ] **Step 2: 의존성 설치**

```bash
npm install @supabase/supabase-js @toast-ui/react-calendar html2canvas xlsx
npm install -D vitest @vitejs/plugin-react jsdom
```

- [ ] **Step 3: vitest 설정**

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

`package.json`에 스크립트 추가:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: TypeScript 타입 정의**

`src/types/index.ts`:
```typescript
export type UserRole = 'pm' | 'member';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Project {
  id: string;
  name: string;
  created_at: string;
  owner_id: string | null;
}

export interface User {
  id: string;
  name: string;
  pin_hash: string;
  role: UserRole;
  project_id: string;
}

export interface WbsNode {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  color: string;
  depth: number;
}

export interface Task {
  id: string;
  wbs_node_id: string;
  name: string;
  start_date: string;
  end_date: string;
  assignee_id: string | null;
  status: TaskStatus;
}

export interface WbsTreeNode extends WbsNode {
  children: WbsTreeNode[];
  task_count: number;
}

export interface SessionData {
  user_id: string;
  project_id: string;
  role: UserRole;
}
```

- [ ] **Step 5: Supabase 클라이언트**

`src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

`.env.local` 생성 (gitignore됨):
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 6: DB 스키마**

`supabase/schema.sql`:
```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  owner_id uuid
);

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
  role text not null check (role in ('pm', 'member')),
  project_id uuid not null references projects(id) on delete cascade
);

alter table projects
  add constraint projects_owner_id_fkey
  foreign key (owner_id) references users(id) on delete set null;

create table wbs_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  parent_id uuid references wbs_nodes(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  color text not null default '#3563e9',
  depth int not null default 0
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  wbs_node_id uuid not null references wbs_nodes(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  assignee_id uuid references users(id) on delete set null,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done'))
);

create index idx_wbs_nodes_project on wbs_nodes(project_id);
create index idx_wbs_nodes_parent on wbs_nodes(parent_id);
create index idx_tasks_wbs_node on tasks(wbs_node_id);
create index idx_tasks_dates on tasks(start_date, end_date);
create index idx_users_project on users(project_id);
```

- [ ] **Step 7: 시드 데이터**

`supabase/seed.sql`:
```sql
-- 프로젝트
insert into projects (id, name) values
  ('11111111-1111-1111-1111-111111111111', '차세대 ERP 구축');

-- 사용자 (PIN: 1234 → SHA-256 해시)
-- 실제 해시는 앱에서 생성. 시드용으로 평문 해시 사용.
insert into users (id, name, pin_hash, role, project_id) values
  ('aaaa0000-0000-0000-0000-000000000001', '박지민', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 'pm', '11111111-1111-1111-1111-111111111111'),
  ('aaaa0000-0000-0000-0000-000000000002', '김서연', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 'member', '11111111-1111-1111-1111-111111111111'),
  ('aaaa0000-0000-0000-0000-000000000003', '이준호', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 'member', '11111111-1111-1111-1111-111111111111');

-- 프로젝트 owner 업데이트
update projects set owner_id = 'aaaa0000-0000-0000-0000-000000000001'
  where id = '11111111-1111-1111-1111-111111111111';

-- WBS 노드
insert into wbs_nodes (id, project_id, parent_id, name, sort_order, color, depth) values
  ('bb000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', null, '1. 분석 단계', 1, '#3563e9', 0),
  ('bb000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', null, '2. 설계 단계', 2, '#1a9e8f', 0),
  ('bb000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', null, '3. 개발 단계', 3, '#7c5cbf', 0),
  ('bb000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'bb000000-0000-0000-0000-000000000001', '1.1 요구사항 수집', 1, '#3563e9', 1),
  ('bb000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'bb000000-0000-0000-0000-000000000001', '1.2 현행 시스템 분석', 2, '#3563e9', 1),
  ('bb000000-0000-0000-0000-000000000020', '11111111-1111-1111-1111-111111111111', 'bb000000-0000-0000-0000-000000000002', '2.1 DB 설계', 1, '#1a9e8f', 1),
  ('bb000000-0000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111', 'bb000000-0000-0000-0000-000000000002', '2.2 화면 설계', 2, '#1a9e8f', 1);

-- 작업
insert into tasks (wbs_node_id, name, start_date, end_date, assignee_id, status) values
  ('bb000000-0000-0000-0000-000000000010', '요구사항 수집', '2026-09-01', '2026-09-05', 'aaaa0000-0000-0000-0000-000000000002', 'done'),
  ('bb000000-0000-0000-0000-000000000011', '현행 시스템 분석', '2026-09-07', '2026-09-11', 'aaaa0000-0000-0000-0000-000000000003', 'in_progress'),
  ('bb000000-0000-0000-0000-000000000020', 'DB 설계', '2026-09-08', '2026-09-12', 'aaaa0000-0000-0000-0000-000000000002', 'todo'),
  ('bb000000-0000-0000-0000-000000000021', '화면 설계', '2026-09-14', '2026-09-18', 'aaaa0000-0000-0000-0000-000000000003', 'todo');
```

- [ ] **Step 8: 빌드 확인 + 커밋**

```bash
npm run build
git add -A
git commit -m "feat: project setup with types, supabase client, and db schema"
```

---

### Task 2: PIN 인증 + 세션 관리

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: `User`, `SessionData` from `@/types`
- Produces: `hashPin(pin: string): Promise<string>`, `verifyPin(pin: string, hash: string): Promise<boolean>`, `saveSession(data: SessionData): void`, `getSession(): SessionData | null`, `clearSession(): void`

- [ ] **Step 1: 인증 테스트 작성**

`src/lib/__tests__/auth.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hashPin, verifyPin, saveSession, getSession, clearSession } from '../auth';
import type { SessionData } from '@/types';

describe('hashPin', () => {
  it('returns consistent hash for same input', async () => {
    const h1 = await hashPin('1234');
    const h2 = await hashPin('1234');
    expect(h1).toBe(h2);
  });

  it('returns different hash for different input', async () => {
    const h1 = await hashPin('1234');
    const h2 = await hashPin('5678');
    expect(h1).not.toBe(h2);
  });
});

describe('verifyPin', () => {
  it('returns true for matching pin', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('1234', hash)).toBe(true);
  });

  it('returns false for wrong pin', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('0000', hash)).toBe(false);
  });
});

describe('session', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const session: SessionData = {
    user_id: 'u1',
    project_id: 'p1',
    role: 'pm',
  };

  it('saves and retrieves session', () => {
    saveSession(session);
    expect(getSession()).toEqual(session);
  });

  it('returns null when no session', () => {
    expect(getSession()).toBeNull();
  });

  it('clears session', () => {
    saveSession(session);
    clearSession();
    expect(getSession()).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/lib/__tests__/auth.test.ts
```

Expected: FAIL — `../auth` 모듈 없음

- [ ] **Step 3: 인증 모듈 구현**

`src/lib/auth.ts`:
```typescript
import type { SessionData } from '@/types';

const SESSION_KEY = 'wbs-cal-session';

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const pinHash = await hashPin(pin);
  return pinHash === hash;
}

export function saveSession(data: SessionData): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function getSession(): SessionData | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx vitest run src/lib/__tests__/auth.test.ts
```

Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts
git commit -m "feat: PIN auth with hash, verify, and session management"
```

---

### Task 3: 로그인 페이지

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/page.module.css`
- Create: `src/components/PinModal.tsx`
- Create: `src/components/PinModal.module.css`

**Interfaces:**
- Consumes: `User`, `SessionData` from `@/types`; `supabase` from `@/lib/supabase`; `hashPin`, `verifyPin`, `saveSession` from `@/lib/auth`
- Produces: 로그인 완료 시 `SessionData`가 localStorage에 저장되고 `/calendar`로 라우팅

- [ ] **Step 1: 루트 레이아웃 설정**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WBS Calendar',
  description: '프로젝트 WBS 관리 캘린더',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/globals.css` — 기본 리셋만:
```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, 'Segoe UI', sans-serif;
  background: #f6f7f9;
  color: #1a1d26;
}
```

- [ ] **Step 2: PinModal 컴포넌트**

`src/components/PinModal.tsx`:
```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './PinModal.module.css';

interface PinModalProps {
  userName: string;
  onSubmit: (pin: string) => void;
  onClose: () => void;
  error: string | null;
}

export default function PinModal({ userName, onSubmit, onClose, error }: PinModalProps) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
    if (value && index === 3) {
      onSubmit(next.join(''));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{userName}</h2>
        <p className={styles.subtitle}>PIN 4자리를 입력하세요</p>
        <div className={styles.pinRow}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              className={styles.pinInput}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
          ))}
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
```

`src/components/PinModal.module.css`:
```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: #fff;
  border-radius: 12px;
  padding: 32px;
  text-align: center;
  min-width: 300px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}
.title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}
.subtitle {
  font-size: 13px;
  color: #5c6270;
  margin-bottom: 24px;
}
.pinRow {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 16px;
}
.pinInput {
  width: 48px;
  height: 56px;
  border: 2px solid #d8dce6;
  border-radius: 8px;
  text-align: center;
  font-size: 24px;
  outline: none;
}
.pinInput:focus {
  border-color: #3563e9;
}
.error {
  color: #c74060;
  font-size: 13px;
}
```

- [ ] **Step 3: 로그인 페이지**

`src/app/page.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { verifyPin, saveSession, getSession } from '@/lib/auth';
import PinModal from '@/components/PinModal';
import type { User } from '@/types';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (session) {
      router.replace('/calendar');
      return;
    }
    loadUsers();
  }, [router]);

  async function loadUsers() {
    const { data } = await supabase.from('users').select('*');
    if (data) setUsers(data);
  }

  async function handlePinSubmit(pin: string) {
    if (!selectedUser) return;
    const valid = await verifyPin(pin, selectedUser.pin_hash);
    if (valid) {
      saveSession({
        user_id: selectedUser.id,
        project_id: selectedUser.project_id,
        role: selectedUser.role,
      });
      router.push('/calendar');
    } else {
      setPinError('PIN이 올바르지 않습니다');
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.logo}>WBS·Cal</h1>
      <p className={styles.subtitle}>프로필을 선택하세요</p>
      <div className={styles.grid}>
        {users.map((user) => (
          <button
            key={user.id}
            className={styles.card}
            onClick={() => { setSelectedUser(user); setPinError(null); }}
          >
            <div className={styles.avatar}>
              {user.name.charAt(0)}
            </div>
            <span className={styles.name}>{user.name}</span>
            {user.role === 'pm' && <span className={styles.badge}>PM</span>}
          </button>
        ))}
      </div>

      {selectedUser && (
        <PinModal
          userName={selectedUser.name}
          onSubmit={handlePinSubmit}
          onClose={() => setSelectedUser(null)}
          error={pinError}
        />
      )}
    </div>
  );
}
```

`src/app/page.module.css`:
```css
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}
.logo {
  font-family: monospace;
  font-size: 28px;
  color: #3563e9;
  margin-bottom: 8px;
}
.subtitle {
  color: #5c6270;
  font-size: 14px;
  margin-bottom: 32px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
  max-width: 500px;
  width: 100%;
}
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 16px;
  background: #fff;
  border: 2px solid #e8ecf2;
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.card:hover {
  border-color: #3563e9;
}
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #e8edfb;
  color: #3563e9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
}
.name {
  font-size: 14px;
  font-weight: 500;
}
.badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #3563e9;
  color: #fff;
  font-weight: 600;
}
```

- [ ] **Step 4: 개발 서버에서 로그인 흐름 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 열어 확인:
1. 유저 카드 목록이 표시되는지
2. 카드 클릭 → PIN 모달이 열리는지
3. 올바른 PIN(1234) 입력 → `/calendar`로 이동하는지
4. 잘못된 PIN → 에러 메시지 표시되는지

- [ ] **Step 5: 커밋**

```bash
git add src/app src/components/PinModal.tsx src/components/PinModal.module.css
git commit -m "feat: login page with profile selection and PIN modal"
```

---

### Task 4: WBS 트리 유틸 + 사이드바 컴포넌트

**Files:**
- Create: `src/lib/wbs.ts`
- Create: `src/lib/__tests__/wbs.test.ts`
- Create: `src/components/WbsTree.tsx`
- Create: `src/components/WbsTree.module.css`

**Interfaces:**
- Consumes: `WbsNode`, `WbsTreeNode` from `@/types`; `supabase` from `@/lib/supabase`
- Produces: `buildTree(nodes: WbsNode[], taskCounts: Record<string, number>): WbsTreeNode[]` — flat 배열을 계층 트리로 변환
- Produces: `<WbsTree>` 컴포넌트 — props: `projectId: string`, `selectedNodeId: string | null`, `onSelectNode: (id: string | null) => void`

- [ ] **Step 1: WBS 트리 변환 테스트 작성**

`src/lib/__tests__/wbs.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildTree } from '../wbs';
import type { WbsNode } from '@/types';

const nodes: WbsNode[] = [
  { id: 'a', project_id: 'p1', parent_id: null, name: '1. 분석', sort_order: 1, color: '#3563e9', depth: 0 },
  { id: 'b', project_id: 'p1', parent_id: null, name: '2. 설계', sort_order: 2, color: '#1a9e8f', depth: 0 },
  { id: 'c', project_id: 'p1', parent_id: 'a', name: '1.1 요구사항', sort_order: 1, color: '#3563e9', depth: 1 },
  { id: 'd', project_id: 'p1', parent_id: 'a', name: '1.2 현행분석', sort_order: 2, color: '#3563e9', depth: 1 },
  { id: 'e', project_id: 'p1', parent_id: 'c', name: '1.1.1 인터뷰', sort_order: 1, color: '#3563e9', depth: 2 },
];

const taskCounts: Record<string, number> = { c: 2, d: 1, e: 1 };

describe('buildTree', () => {
  it('builds correct hierarchy', () => {
    const tree = buildTree(nodes, taskCounts);
    expect(tree).toHaveLength(2);
    expect(tree[0].name).toBe('1. 분석');
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].name).toBe('1.1 요구사항');
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].name).toBe('1.1.1 인터뷰');
  });

  it('sorts by sort_order', () => {
    const tree = buildTree(nodes, taskCounts);
    expect(tree[0].name).toBe('1. 분석');
    expect(tree[1].name).toBe('2. 설계');
  });

  it('aggregates task counts up the tree', () => {
    const tree = buildTree(nodes, taskCounts);
    expect(tree[0].task_count).toBe(4);
    expect(tree[0].children[0].task_count).toBe(3);
    expect(tree[0].children[0].children[0].task_count).toBe(1);
    expect(tree[0].children[1].task_count).toBe(1);
    expect(tree[1].task_count).toBe(0);
  });

  it('returns empty array for empty input', () => {
    expect(buildTree([], {})).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/lib/__tests__/wbs.test.ts
```

Expected: FAIL

- [ ] **Step 3: WBS 트리 유틸 구현**

`src/lib/wbs.ts`:
```typescript
import type { WbsNode, WbsTreeNode } from '@/types';

export function buildTree(
  nodes: WbsNode[],
  taskCounts: Record<string, number>
): WbsTreeNode[] {
  const map = new Map<string, WbsTreeNode>();

  for (const node of nodes) {
    map.set(node.id, { ...node, children: [], task_count: taskCounts[node.id] ?? 0 });
  }

  const roots: WbsTreeNode[] = [];

  const sorted = [...map.values()].sort((a, b) => a.sort_order - b.sort_order);

  for (const node of sorted) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sumCounts(node: WbsTreeNode): number {
    let total = node.task_count;
    for (const child of node.children) {
      total += sumCounts(child);
    }
    node.task_count = total;
    return total;
  }

  for (const root of roots) {
    sumCounts(root);
  }

  return roots;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx vitest run src/lib/__tests__/wbs.test.ts
```

Expected: 모든 테스트 PASS

- [ ] **Step 5: WbsTree 컴포넌트**

`src/components/WbsTree.tsx`:
```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { buildTree } from '@/lib/wbs';
import type { WbsNode, WbsTreeNode } from '@/types';
import styles from './WbsTree.module.css';

interface WbsTreeProps {
  projectId: string;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}

export default function WbsTree({ projectId, selectedNodeId, onSelectNode }: WbsTreeProps) {
  const [tree, setTree] = useState<WbsTreeNode[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const loadTree = useCallback(async () => {
    const [{ data: nodes }, { data: counts }] = await Promise.all([
      supabase.from('wbs_nodes').select('*').eq('project_id', projectId).order('sort_order'),
      supabase.from('tasks').select('wbs_node_id').then(({ data }) => {
        const map: Record<string, number> = {};
        data?.forEach((t) => { map[t.wbs_node_id] = (map[t.wbs_node_id] ?? 0) + 1; });
        return { data: map };
      }),
    ]);
    if (nodes) setTree(buildTree(nodes, counts ?? {}));
  }, [projectId]);

  useEffect(() => { loadTree(); }, [loadTree]);

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleAddNode(parentId: string | null, depth: number) {
    const siblings = parentId
      ? tree.flatMap(function findChildren(n): WbsTreeNode[] {
          if (n.id === parentId) return n.children;
          return n.children.flatMap(findChildren);
        })
      : tree;
    const sortOrder = siblings.length + 1;

    await supabase.from('wbs_nodes').insert({
      project_id: projectId,
      parent_id: parentId,
      name: '새 항목',
      sort_order: sortOrder,
      color: parentId ? '#3563e9' : ['#3563e9', '#1a9e8f', '#7c5cbf', '#d97520', '#c74060'][tree.length % 5],
      depth,
    });
    await loadTree();
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    await supabase.from('wbs_nodes').update({ name: editName }).eq('id', id);
    setEditingId(null);
    await loadTree();
  }

  async function handleDelete(id: string) {
    await supabase.from('wbs_nodes').delete().eq('id', id);
    if (selectedNodeId === id) onSelectNode(null);
    await loadTree();
  }

  function renderNode(node: WbsTreeNode) {
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedNodeId === node.id;
    const indent = node.depth * 20;

    return (
      <div key={node.id}>
        <div
          className={`${styles.item} ${isSelected ? styles.active : ''}`}
          style={{ paddingLeft: 16 + indent }}
          onClick={() => onSelectNode(isSelected ? null : node.id)}
        >
          <span
            className={`${styles.toggle} ${!hasChildren ? styles.empty : ''} ${isCollapsed ? styles.collapsed : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id); }}
          >
            ▾
          </span>
          <span className={styles.dot} style={{ background: node.color }} />
          {editingId === node.id ? (
            <input
              className={styles.editInput}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleRename(node.id)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename(node.id)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span
              className={styles.label}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingId(node.id); setEditName(node.name); }}
            >
              {node.name}
            </span>
          )}
          <span className={styles.count}>{node.task_count}</span>
          <button
            className={styles.addBtn}
            title="하위 항목 추가"
            onClick={(e) => { e.stopPropagation(); handleAddNode(node.id, node.depth + 1); }}
          >
            +
          </button>
          <button
            className={styles.delBtn}
            title="삭제"
            onClick={(e) => { e.stopPropagation(); handleDelete(node.id); }}
          >
            ×
          </button>
        </div>
        {hasChildren && !isCollapsed && node.children.map(renderNode)}
      </div>
    );
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.title}>WBS 구조</span>
        <button className={styles.headerAdd} onClick={() => handleAddNode(null, 0)}>+</button>
      </div>
      <div className={styles.tree}>
        {tree.map(renderNode)}
      </div>
    </aside>
  );
}
```

`src/components/WbsTree.module.css`:
```css
.sidebar {
  width: 280px;
  background: #fff;
  border-right: 1px solid #d8dce6;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}
.header {
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e8ecf2;
}
.title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #8b91a0;
}
.headerAdd {
  width: 22px; height: 22px;
  border-radius: 4px;
  border: 1px solid #d8dce6;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
  position: relative;
}
.item:hover { background: #eef0f4; }
.item.active { background: #e8edfb; color: #3563e9; }
.toggle {
  width: 16px; height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #8b91a0;
  flex-shrink: 0;
  transition: transform 0.15s;
}
.toggle.collapsed { transform: rotate(-90deg); }
.toggle.empty { visibility: hidden; }
.dot {
  width: 8px; height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}
.label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.editInput {
  flex: 1;
  font-size: 13px;
  border: 1px solid #3563e9;
  border-radius: 3px;
  padding: 1px 4px;
  outline: none;
}
.count {
  font-family: monospace;
  font-size: 11px;
  color: #8b91a0;
  background: #eef0f4;
  padding: 0 6px;
  border-radius: 10px;
}
.addBtn, .delBtn {
  opacity: 0;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: #8b91a0;
  padding: 0 2px;
}
.item:hover .addBtn, .item:hover .delBtn { opacity: 1; }
.delBtn { color: #c74060; }
```

- [ ] **Step 6: 개발 서버에서 WBS 트리 확인**

캘린더 페이지에 임시로 WbsTree를 렌더링하여 확인:
1. 시드 데이터의 WBS 노드가 트리로 표시되는지
2. 접기/펼치기 동작하는지
3. 더블클릭으로 이름 수정 가능한지
4. +/× 버튼으로 추가/삭제 가능한지

- [ ] **Step 7: 커밋**

```bash
git add src/lib/wbs.ts src/lib/__tests__/wbs.test.ts src/components/WbsTree.tsx src/components/WbsTree.module.css
git commit -m "feat: WBS tree utility and sidebar component with CRUD"
```

---

### Task 5: 캘린더 페이지 레이아웃 + Toast UI Calendar 연동

**Files:**
- Create: `src/components/CalendarView.tsx`
- Create: `src/components/CalendarView.module.css`
- Create: `src/app/calendar/page.tsx`
- Create: `src/app/calendar/page.module.css`

**Interfaces:**
- Consumes: `Task`, `WbsNode`, `User`, `SessionData` from `@/types`; `supabase` from `@/lib/supabase`; `getSession` from `@/lib/auth`; `<WbsTree>` from Task 4
- Produces: `<CalendarView>` 컴포넌트 — props: `tasks: Task[]`, `wbsNodes: WbsNode[]`, `users: User[]`, `onClickEvent: (taskId: string) => void`, `onUpdateTask: (taskId: string, changes: Partial<Task>) => void`, `calendarRef: RefObject`

- [ ] **Step 1: CalendarView 컴포넌트 (Toast UI Calendar 래퍼)**

`src/components/CalendarView.tsx`:
```tsx
'use client';

import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import Calendar from '@toast-ui/react-calendar';
import '@toast-ui/calendar/dist/toastui-calendar.min.css';
import type { Task, WbsNode, User } from '@/types';
import styles from './CalendarView.module.css';

interface CalendarViewProps {
  tasks: Task[];
  wbsNodes: WbsNode[];
  users: User[];
  onClickEvent: (taskId: string) => void;
  onUpdateTask: (taskId: string, changes: Partial<Task>) => void;
  onClickDate: (date: string) => void;
}

export interface CalendarViewHandle {
  getContainerEl: () => HTMLElement | null;
  getInstance: () => any;
}

function toCalendarEvents(tasks: Task[], wbsNodes: WbsNode[], users: User[]) {
  const nodeMap = new Map(wbsNodes.map((n) => [n.id, n]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  return tasks.map((task) => {
    const node = nodeMap.get(task.wbs_node_id);
    const assignee = task.assignee_id ? userMap.get(task.assignee_id) : null;
    return {
      id: task.id,
      calendarId: task.wbs_node_id,
      title: task.name,
      start: task.start_date,
      end: task.end_date,
      category: 'allday' as const,
      backgroundColor: node?.color ?? '#3563e9',
      borderColor: node?.color ?? '#3563e9',
      body: assignee?.name ?? '',
    };
  });
}

const CalendarView = forwardRef<CalendarViewHandle, CalendarViewProps>(
  function CalendarView({ tasks, wbsNodes, users, onClickEvent, onUpdateTask, onClickDate }, ref) {
    const calRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [view, setView] = useState<'month' | 'week'>('month');
    const [dateLabel, setDateLabel] = useState('');

    useImperativeHandle(ref, () => ({
      getContainerEl: () => containerRef.current,
      getInstance: () => calRef.current?.getInstance?.(),
    }));

    function updateDateLabel() {
      const inst = calRef.current?.getInstance?.();
      if (!inst) return;
      const date = inst.getDate();
      const d = date.toDate ? date.toDate() : new Date(date);
      setDateLabel(`${d.getFullYear()}년 ${d.getMonth() + 1}월`);
    }

    useEffect(() => {
      updateDateLabel();
    }, [view]);

    function navigate(direction: 'prev' | 'next' | 'today') {
      const inst = calRef.current?.getInstance?.();
      if (!inst) return;
      if (direction === 'today') inst.today();
      else if (direction === 'prev') inst.prev();
      else inst.next();
      updateDateLabel();
    }

    const events = toCalendarEvents(tasks, wbsNodes, users);

    return (
      <div className={styles.wrapper}>
        <div className={styles.toolbar}>
          <div className={styles.nav}>
            <button className={styles.navBtn} onClick={() => navigate('prev')}>‹</button>
            <span className={styles.month}>{dateLabel}</span>
            <button className={styles.navBtn} onClick={() => navigate('next')}>›</button>
            <button className={styles.todayBtn} onClick={() => navigate('today')}>오늘</button>
          </div>
          <div className={styles.views}>
            <button
              className={`${styles.viewBtn} ${view === 'month' ? styles.active : ''}`}
              onClick={() => setView('month')}
            >
              월간
            </button>
            <button
              className={`${styles.viewBtn} ${view === 'week' ? styles.active : ''}`}
              onClick={() => setView('week')}
            >
              주간
            </button>
          </div>
        </div>
        <div ref={containerRef} className={styles.calendarContainer}>
          <Calendar
            ref={calRef}
            view={view}
            events={events}
            month={{ startDayOfWeek: 1, isAlways6Weeks: false }}
            week={{ startDayOfWeek: 1 }}
            usageStatistics={false}
            gridSelection={true}
            onClickEvent={(e: any) => onClickEvent(e.event.id)}
            onSelectDateTime={(e: any) => {
              const d = e.start;
              const date = d.toDate ? d.toDate() : new Date(d);
              onClickDate(date.toISOString().split('T')[0]);
            }}
            onBeforeUpdateEvent={(e: any) => {
              const { event, changes } = e;
              const updates: Partial<Task> = {};
              if (changes.start) {
                const s = changes.start.toDate ? changes.start.toDate() : new Date(changes.start);
                updates.start_date = s.toISOString().split('T')[0];
              }
              if (changes.end) {
                const ed = changes.end.toDate ? changes.end.toDate() : new Date(changes.end);
                updates.end_date = ed.toISOString().split('T')[0];
              }
              if (Object.keys(updates).length > 0) {
                onUpdateTask(event.id, updates);
              }
            }}
          />
        </div>
      </div>
    );
  }
);

export default CalendarView;
```

`src/components/CalendarView.module.css`:
```css
.wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #d8dce6;
}
.nav {
  display: flex;
  align-items: center;
  gap: 8px;
}
.navBtn {
  width: 30px; height: 30px;
  border-radius: 6px;
  border: 1px solid #d8dce6;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.navBtn:hover { background: #eef0f4; }
.month {
  font-size: 18px;
  font-weight: 600;
  min-width: 140px;
}
.todayBtn {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid #d8dce6;
  background: #fff;
  cursor: pointer;
  font-weight: 500;
}
.views {
  display: flex;
  border: 1px solid #d8dce6;
  border-radius: 6px;
  overflow: hidden;
}
.viewBtn {
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  background: #fff;
  cursor: pointer;
}
.viewBtn:not(:last-child) { border-right: 1px solid #d8dce6; }
.viewBtn.active { background: #3563e9; color: #fff; }
.calendarContainer {
  flex: 1;
  overflow: auto;
  padding: 16px 20px;
}
```

- [ ] **Step 2: 캘린더 페이지 레이아웃**

`src/app/calendar/page.tsx`:
```tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getSession, clearSession } from '@/lib/auth';
import WbsTree from '@/components/WbsTree';
import CalendarView from '@/components/CalendarView';
import type { CalendarViewHandle } from '@/components/CalendarView';
import ExportButtons from '@/components/ExportButtons';
import TaskModal from '@/components/TaskModal';
import TaskPeekPanel from '@/components/TaskPeekPanel';
import type { Task, WbsNode, User, SessionData } from '@/types';
import styles from './page.module.css';

export default function CalendarPage() {
  const router = useRouter();
  const calendarRef = useRef<CalendarViewHandle>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [wbsNodes, setWbsNodes] = useState<WbsNode[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    const s = getSession();
    if (!s) { router.replace('/'); return; }
    setSession(s);
    loadData(s.project_id);
  }, [router]);

  const loadData = useCallback(async (projectId: string) => {
    const [{ data: t }, { data: n }, { data: u }, { data: p }] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('wbs_nodes').select('*').eq('project_id', projectId),
      supabase.from('users').select('*').eq('project_id', projectId),
      supabase.from('projects').select('name').eq('id', projectId).single(),
    ]);
    if (t) setTasks(t);
    if (n) setWbsNodes(n);
    if (u) setUsers(u);
    if (p) setProjectName(p.name);
  }, []);

  function filteredTasks(): Task[] {
    if (!selectedNodeId) return tasks;
    const nodeIds = new Set<string>();
    function collectIds(id: string) {
      nodeIds.add(id);
      wbsNodes.filter((n) => n.parent_id === id).forEach((n) => collectIds(n.id));
    }
    collectIds(selectedNodeId);
    return tasks.filter((t) => nodeIds.has(t.wbs_node_id));
  }

  async function handleUpdateTask(taskId: string, changes: Partial<Task>) {
    await supabase.from('tasks').update(changes).eq('id', taskId);
    if (session) await loadData(session.project_id);
  }

  async function handleSaveTask(task: Omit<Task, 'id'> & { id?: string }) {
    if (task.id) {
      const { id, ...rest } = task;
      await supabase.from('tasks').update(rest).eq('id', id);
    } else {
      await supabase.from('tasks').insert(task);
    }
    setModalOpen(false);
    if (session) await loadData(session.project_id);
  }

  async function handleDeleteTask(taskId: string) {
    await supabase.from('tasks').delete().eq('id', taskId);
    setSelectedTaskId(null);
    if (session) await loadData(session.project_id);
  }

  function handleLogout() {
    clearSession();
    router.replace('/');
  }

  if (!session) return null;

  const currentUser = users.find((u) => u.id === session.user_id);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>WBS·Cal</span>
          <span className={styles.projectName}>{projectName}</span>
        </div>
        <div className={styles.headerRight}>
          <ExportButtons
            tasks={filteredTasks()}
            wbsNodes={wbsNodes}
            users={users}
            calendarRef={calendarRef}
          />
          <button className={styles.addBtn} onClick={() => { setModalDefaultDate(null); setModalOpen(true); }}>
            + 작업 추가
          </button>
          {session.role === 'pm' && (
            <button className={styles.settingsBtn} onClick={() => router.push('/settings')}>
              설정
            </button>
          )}
          <button className={styles.avatar} onClick={handleLogout} title="로그아웃">
            {currentUser?.name.charAt(0) ?? '?'}
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <WbsTree
          projectId={session.project_id}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
        <CalendarView
          ref={calendarRef}
          tasks={filteredTasks()}
          wbsNodes={wbsNodes}
          users={users}
          onClickEvent={(id) => setSelectedTaskId(id)}
          onUpdateTask={handleUpdateTask}
          onClickDate={(date) => { setModalDefaultDate(date); setModalOpen(true); }}
        />
      </div>

      {modalOpen && (
        <TaskModal
          wbsNodes={wbsNodes}
          users={users}
          defaultDate={modalDefaultDate}
          onSave={handleSaveTask}
          onClose={() => setModalOpen(false)}
        />
      )}

      {selectedTask && (
        <TaskPeekPanel
          task={selectedTask}
          wbsNodes={wbsNodes}
          users={users}
          onUpdate={(changes) => handleUpdateTask(selectedTask.id, changes)}
          onDelete={() => handleDeleteTask(selectedTask.id)}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
```

`src/app/calendar/page.module.css`:
```css
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 56px;
  background: #1e2233;
  flex-shrink: 0;
}
.headerLeft {
  display: flex;
  align-items: center;
  gap: 16px;
}
.logo {
  font-family: monospace;
  font-weight: 500;
  font-size: 15px;
  color: #6b8aff;
}
.projectName {
  color: #f0f1f5;
  font-size: 13px;
  font-weight: 500;
}
.headerRight {
  display: flex;
  align-items: center;
  gap: 8px;
}
.addBtn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  background: #3563e9;
  color: #fff;
  cursor: pointer;
}
.settingsBtn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.08);
  color: #f0f1f5;
  cursor: pointer;
}
.avatar {
  width: 30px; height: 30px;
  border-radius: 50%;
  background: #2e3450;
  color: #6b8aff;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.body {
  display: flex;
  flex: 1;
  overflow: hidden;
}
```

- [ ] **Step 3: 개발 서버에서 캘린더 페이지 확인**

```bash
npm run dev
```

로그인 후 `/calendar`에서 확인:
1. WBS 사이드바 + 캘린더가 나란히 렌더링되는지
2. 시드 데이터의 작업이 캘린더에 바로 표시되는지
3. 월간/주간 뷰 전환이 동작하는지
4. 이전/다음/오늘 네비게이션이 동작하는지
5. 캘린더 바 드래그 앤 드롭이 동작하는지

- [ ] **Step 4: 커밋**

```bash
git add src/components/CalendarView.tsx src/components/CalendarView.module.css src/app/calendar
git commit -m "feat: calendar page with Toast UI Calendar and WBS tree sidebar"
```

---

### Task 6: 작업 추가/수정 모달 + 상세 패널

**Files:**
- Create: `src/components/TaskModal.tsx`
- Create: `src/components/TaskModal.module.css`
- Create: `src/components/TaskPeekPanel.tsx`
- Create: `src/components/TaskPeekPanel.module.css`

**Interfaces:**
- Consumes: `Task`, `WbsNode`, `User` from `@/types`
- Produces: `<TaskModal>` — props: `wbsNodes: WbsNode[]`, `users: User[]`, `defaultDate: string | null`, `task?: Task` (수정 시), `onSave: (task) => void`, `onClose: () => void`
- Produces: `<TaskPeekPanel>` — props: `task: Task`, `wbsNodes: WbsNode[]`, `users: User[]`, `onUpdate: (changes) => void`, `onDelete: () => void`, `onClose: () => void`

- [ ] **Step 1: TaskModal 컴포넌트**

`src/components/TaskModal.tsx`:
```tsx
'use client';

import { useState } from 'react';
import type { Task, WbsNode, User, TaskStatus } from '@/types';
import styles from './TaskModal.module.css';

interface TaskModalProps {
  wbsNodes: WbsNode[];
  users: User[];
  defaultDate: string | null;
  task?: Task;
  onSave: (task: Omit<Task, 'id'> & { id?: string }) => void;
  onClose: () => void;
}

export default function TaskModal({ wbsNodes, users, defaultDate, task, onSave, onClose }: TaskModalProps) {
  const [name, setName] = useState(task?.name ?? '');
  const [startDate, setStartDate] = useState(task?.start_date ?? defaultDate ?? '');
  const [endDate, setEndDate] = useState(task?.end_date ?? defaultDate ?? '');
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo');
  const [wbsNodeId, setWbsNodeId] = useState(task?.wbs_node_id ?? wbsNodes[0]?.id ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate || !wbsNodeId) return;
    onSave({
      ...(task?.id ? { id: task.id } : {}),
      name: name.trim(),
      start_date: startDate,
      end_date: endDate,
      assignee_id: assigneeId || null,
      status,
      wbs_node_id: wbsNodeId,
    });
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.title}>{task ? '작업 수정' : '작업 추가'}</h2>

        <label className={styles.field}>
          <span className={styles.label}>작업명</span>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>WBS 노드</span>
          <select className={styles.input} value={wbsNodeId} onChange={(e) => setWbsNodeId(e.target.value)} required>
            {wbsNodes.map((n) => (
              <option key={n.id} value={n.id}>{'—'.repeat(n.depth)} {n.name}</option>
            ))}
          </select>
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>시작일</span>
            <input className={styles.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>종료일</span>
            <input className={styles.input} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>담당자</span>
            <select className={styles.input} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">미지정</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>상태</span>
            <select className={styles.input} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              <option value="todo">예정</option>
              <option value="in_progress">진행중</option>
              <option value="done">완료</option>
            </select>
          </label>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>취소</button>
          <button type="submit" className={styles.saveBtn}>저장</button>
        </div>
      </form>
    </div>
  );
}
```

`src/components/TaskModal.module.css`:
```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: #fff;
  border-radius: 12px;
  padding: 28px;
  min-width: 420px;
  max-width: 500px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}
.title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
  flex: 1;
}
.label {
  font-size: 12px;
  font-weight: 500;
  color: #5c6270;
}
.input {
  padding: 8px 10px;
  border: 1px solid #d8dce6;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
}
.input:focus { border-color: #3563e9; }
.row {
  display: flex;
  gap: 12px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
.cancelBtn {
  padding: 8px 18px;
  border: 1px solid #d8dce6;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}
.saveBtn {
  padding: 8px 18px;
  border: none;
  border-radius: 6px;
  background: #3563e9;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
```

- [ ] **Step 2: TaskPeekPanel 컴포넌트**

`src/components/TaskPeekPanel.tsx`:
```tsx
'use client';

import type { Task, WbsNode, User, TaskStatus } from '@/types';
import styles from './TaskPeekPanel.module.css';

interface TaskPeekPanelProps {
  task: Task;
  wbsNodes: WbsNode[];
  users: User[];
  onUpdate: (changes: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '예정',
  in_progress: '진행중',
  done: '완료',
};

export default function TaskPeekPanel({ task, wbsNodes, users, onUpdate, onDelete, onClose }: TaskPeekPanelProps) {
  const node = wbsNodes.find((n) => n.id === task.wbs_node_id);
  const assignee = task.assignee_id ? users.find((u) => u.id === task.assignee_id) : null;

  function getBreadcrumb(): string {
    const parts: string[] = [];
    let current = node;
    while (current) {
      parts.unshift(current.name);
      current = current.parent_id ? wbsNodes.find((n) => n.id === current!.parent_id) : undefined;
    }
    return parts.join(' › ');
  }

  return (
    <div className={styles.panel}>
      <button className={styles.close} onClick={onClose}>✕</button>
      <div className={styles.breadcrumb}>{getBreadcrumb()}</div>
      <h2 className={styles.title}>{task.name}</h2>
      <div className={styles.meta}>
        <div className={styles.row}>
          <span className={styles.label}>상태</span>
          <select
            className={`${styles.status} ${styles[task.status]}`}
            value={task.status}
            onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })}
          >
            <option value="todo">예정</option>
            <option value="in_progress">진행중</option>
            <option value="done">완료</option>
          </select>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>기간</span>
          <span className={styles.value}>{task.start_date} → {task.end_date}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>담당자</span>
          <span className={styles.value}>{assignee?.name ?? '미지정'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Phase</span>
          <span className={styles.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: node?.color ?? '#ccc' }} />
            {node?.name ?? ''}
          </span>
        </div>
      </div>
      <button className={styles.deleteBtn} onClick={onDelete}>작업 삭제</button>
    </div>
  );
}
```

`src/components/TaskPeekPanel.module.css`:
```css
.panel {
  position: fixed;
  right: 0;
  top: 56px;
  bottom: 0;
  width: 340px;
  background: #fff;
  border-left: 1px solid #d8dce6;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.06);
  padding: 24px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.close {
  position: absolute;
  top: 16px; right: 16px;
  width: 24px; height: 24px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: #8b91a0;
  cursor: pointer;
  font-size: 16px;
}
.breadcrumb {
  font-size: 11px;
  color: #8b91a0;
}
.title {
  font-size: 16px;
  font-weight: 600;
  padding-right: 24px;
}
.meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.label {
  width: 60px;
  color: #8b91a0;
  font-size: 12px;
  flex-shrink: 0;
}
.value { color: #1a1d26; }
.status {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  cursor: pointer;
}
.todo { background: #f0f1f4; color: #8b91a0; }
.in_progress { background: #fef3e6; color: #e98b35; }
.done { background: #e6f5ee; color: #2ba572; }
.deleteBtn {
  margin-top: auto;
  padding: 8px;
  border: 1px solid #c74060;
  border-radius: 6px;
  background: transparent;
  color: #c74060;
  font-size: 12px;
  cursor: pointer;
}
.deleteBtn:hover { background: #fef0f3; }
```

- [ ] **Step 3: 개발 서버에서 작업 CRUD 확인**

1. "+ 작업 추가" 클릭 → 모달 열림, 필드 입력 후 저장 → 캘린더에 반영
2. 캘린더 빈 날짜 클릭 → 모달 열림, 해당 날짜가 기본값으로 채워짐
3. 캘린더 바 클릭 → 상세 패널 슬라이드, WBS 경로·상태·담당자 표시
4. 상세 패널에서 상태 변경 → DB 업데이트
5. 작업 삭제 → 캘린더에서 제거

- [ ] **Step 4: 커밋**

```bash
git add src/components/TaskModal.tsx src/components/TaskModal.module.css src/components/TaskPeekPanel.tsx src/components/TaskPeekPanel.module.css
git commit -m "feat: task modal and peek panel for CRUD operations"
```

---

### Task 7: Export 기능 (PNG + XLSX)

**Files:**
- Create: `src/lib/export.ts`
- Create: `src/lib/__tests__/export.test.ts`
- Create: `src/components/ExportButtons.tsx`
- Create: `src/components/ExportButtons.module.css`

**Interfaces:**
- Consumes: `Task`, `WbsNode`, `User` from `@/types`; `CalendarViewHandle` from `@/components/CalendarView`
- Produces: `exportPng(element: HTMLElement, filename: string): Promise<void>`
- Produces: `buildExcelData(tasks: Task[], wbsNodes: WbsNode[], users: User[]): Record<string, string>[]` — XLSX 행 데이터 생성
- Produces: `exportXlsx(data: Record<string, string>[], filename: string): void`

- [ ] **Step 1: Export 데이터 변환 테스트 작성**

`src/lib/__tests__/export.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildExcelData } from '../export';
import type { Task, WbsNode, User } from '@/types';

const nodes: WbsNode[] = [
  { id: 'n1', project_id: 'p1', parent_id: null, name: '1. 분석', sort_order: 1, color: '#3563e9', depth: 0 },
  { id: 'n2', project_id: 'p1', parent_id: 'n1', name: '1.1 요구사항', sort_order: 1, color: '#3563e9', depth: 1 },
];

const users: User[] = [
  { id: 'u1', name: '김서연', pin_hash: '', role: 'member', project_id: 'p1' },
];

const tasks: Task[] = [
  { id: 't1', wbs_node_id: 'n2', name: '요구사항 수집', start_date: '2026-09-01', end_date: '2026-09-05', assignee_id: 'u1', status: 'done' },
  { id: 't2', wbs_node_id: 'n2', name: 'AS-IS 분석', start_date: '2026-09-07', end_date: '2026-09-10', assignee_id: null, status: 'todo' },
];

describe('buildExcelData', () => {
  it('converts tasks to row objects with Korean headers', () => {
    const rows = buildExcelData(tasks, nodes, users);
    expect(rows).toHaveLength(2);
    expect(rows[0]['작업명']).toBe('요구사항 수집');
    expect(rows[0]['WBS']).toBe('1. 분석 > 1.1 요구사항');
    expect(rows[0]['담당자']).toBe('김서연');
    expect(rows[0]['상태']).toBe('완료');
    expect(rows[0]['시작일']).toBe('2026-09-01');
    expect(rows[0]['종료일']).toBe('2026-09-05');
  });

  it('handles unassigned tasks', () => {
    const rows = buildExcelData(tasks, nodes, users);
    expect(rows[1]['담당자']).toBe('');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx vitest run src/lib/__tests__/export.test.ts
```

Expected: FAIL

- [ ] **Step 3: Export 유틸 구현**

`src/lib/export.ts`:
```typescript
import type { Task, WbsNode, User, TaskStatus } from '@/types';

const STATUS_KO: Record<TaskStatus, string> = {
  todo: '예정',
  in_progress: '진행중',
  done: '완료',
};

function getWbsPath(nodeId: string, nodes: WbsNode[]): string {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const parts: string[] = [];
  let current = nodeMap.get(nodeId);
  while (current) {
    parts.unshift(current.name);
    current = current.parent_id ? nodeMap.get(current.parent_id) : undefined;
  }
  return parts.join(' > ');
}

export function buildExcelData(
  tasks: Task[],
  wbsNodes: WbsNode[],
  users: User[]
): Record<string, string>[] {
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  return tasks.map((t) => ({
    '작업명': t.name,
    'WBS': getWbsPath(t.wbs_node_id, wbsNodes),
    '시작일': t.start_date,
    '종료일': t.end_date,
    '담당자': t.assignee_id ? (userMap.get(t.assignee_id) ?? '') : '',
    '상태': STATUS_KO[t.status],
  }));
}

export async function exportPng(element: HTMLElement, filename: string): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(element, { useCORS: true, scale: 2 });
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function exportXlsx(data: Record<string, string>[], filename: string): void {
  import('xlsx').then((XLSX) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WBS');
    XLSX.writeFile(wb, filename);
  });
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx vitest run src/lib/__tests__/export.test.ts
```

Expected: 모든 테스트 PASS

- [ ] **Step 5: ExportButtons 컴포넌트**

`src/components/ExportButtons.tsx`:
```tsx
'use client';

import { useState, type RefObject } from 'react';
import { exportPng, exportXlsx, buildExcelData } from '@/lib/export';
import type { CalendarViewHandle } from './CalendarView';
import type { Task, WbsNode, User } from '@/types';
import styles from './ExportButtons.module.css';

interface ExportButtonsProps {
  tasks: Task[];
  wbsNodes: WbsNode[];
  users: User[];
  calendarRef: RefObject<CalendarViewHandle | null>;
}

export default function ExportButtons({ tasks, wbsNodes, users, calendarRef }: ExportButtonsProps) {
  const [open, setOpen] = useState(false);

  async function handlePng() {
    const el = calendarRef.current?.getContainerEl();
    if (el) await exportPng(el, 'wbs-calendar.png');
    setOpen(false);
  }

  function handleXlsx() {
    const data = buildExcelData(tasks, wbsNodes, users);
    exportXlsx(data, 'wbs-tasks.xlsx');
    setOpen(false);
  }

  return (
    <div className={styles.wrap}>
      <button className={styles.btn} onClick={() => setOpen(!open)}>Export</button>
      {open && (
        <div className={styles.dropdown}>
          <button className={styles.option} onClick={handlePng}>
            캘린더 이미지 저장 <span className={styles.ext}>.PNG</span>
          </button>
          <button className={styles.option} onClick={handleXlsx}>
            작업 목록 내보내기 <span className={styles.ext}>.XLSX</span>
          </button>
        </div>
      )}
    </div>
  );
}
```

`src/components/ExportButtons.module.css`:
```css
.wrap { position: relative; }
.btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.08);
  color: #f0f1f5;
  cursor: pointer;
}
.dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #fff;
  border: 1px solid #d8dce6;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  padding: 4px;
  min-width: 200px;
  z-index: 100;
}
.option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #1a1d26;
  cursor: pointer;
  text-align: left;
}
.option:hover { background: #eef0f4; }
.ext {
  font-family: monospace;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  background: #eef0f4;
  color: #8b91a0;
}
```

- [ ] **Step 6: 개발 서버에서 Export 확인**

1. Export → PNG: 캘린더 이미지가 다운로드되는지
2. Export → XLSX: 엑셀 파일이 다운로드되고 작업 목록이 올바르게 포함되어 있는지
3. WBS 필터링 적용 상태에서 Export → 필터된 데이터만 포함되는지

- [ ] **Step 7: 커밋**

```bash
git add src/lib/export.ts src/lib/__tests__/export.test.ts src/components/ExportButtons.tsx src/components/ExportButtons.module.css
git commit -m "feat: export calendar as PNG and task list as XLSX"
```

---

### Task 8: PM 설정 페이지

**Files:**
- Create: `src/app/settings/page.tsx`
- Create: `src/app/settings/page.module.css`

**Interfaces:**
- Consumes: `User`, `Project`, `SessionData` from `@/types`; `supabase` from `@/lib/supabase`; `getSession`, `hashPin` from `@/lib/auth`

- [ ] **Step 1: 설정 페이지 구현**

`src/app/settings/page.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getSession, hashPin } from '@/lib/auth';
import type { User, Project, SessionData } from '@/types';
import styles from './page.module.css';

export default function SettingsPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== 'pm') { router.replace('/'); return; }
    setSession(s);
    loadData(s.project_id);
  }, [router]);

  async function loadData(projectId: string) {
    const [{ data: u }, { data: p }] = await Promise.all([
      supabase.from('users').select('*').eq('project_id', projectId),
      supabase.from('projects').select('*').eq('id', projectId).single(),
    ]);
    if (u) setUsers(u);
    if (p) { setProject(p); setProjectName(p.name); }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !newUserName.trim() || newUserPin.length !== 4) return;
    const pinHash = await hashPin(newUserPin);
    await supabase.from('users').insert({
      name: newUserName.trim(),
      pin_hash: pinHash,
      role: 'member',
      project_id: session.project_id,
    });
    setNewUserName('');
    setNewUserPin('');
    await loadData(session.project_id);
  }

  async function handleDeleteUser(userId: string) {
    if (userId === session?.user_id) return;
    await supabase.from('users').delete().eq('id', userId);
    if (session) await loadData(session.project_id);
  }

  async function handleUpdateProjectName() {
    if (!project || !projectName.trim()) return;
    await supabase.from('projects').update({ name: projectName.trim() }).eq('id', project.id);
    if (session) await loadData(session.project_id);
  }

  if (!session) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>설정</h1>
        <button className={styles.backBtn} onClick={() => router.push('/calendar')}>← 캘린더로</button>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>프로젝트</h2>
        <div className={styles.row}>
          <input
            className={styles.input}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <button className={styles.saveBtn} onClick={handleUpdateProjectName}>저장</button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>팀원 관리</h2>
        <div className={styles.userList}>
          {users.map((u) => (
            <div key={u.id} className={styles.userRow}>
              <span className={styles.userName}>{u.name}</span>
              <span className={styles.userRole}>{u.role === 'pm' ? 'PM' : '팀원'}</span>
              {u.id !== session.user_id && (
                <button className={styles.deleteBtn} onClick={() => handleDeleteUser(u.id)}>삭제</button>
              )}
            </div>
          ))}
        </div>
        <form className={styles.addForm} onSubmit={handleAddUser}>
          <input
            className={styles.input}
            placeholder="이름"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            required
          />
          <input
            className={styles.input}
            placeholder="PIN (4자리)"
            value={newUserPin}
            onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            maxLength={4}
            inputMode="numeric"
            required
          />
          <button className={styles.addBtn} type="submit">추가</button>
        </form>
      </section>
    </div>
  );
}
```

`src/app/settings/page.module.css`:
```css
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 24px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
}
.title {
  font-size: 22px;
  font-weight: 600;
}
.backBtn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid #d8dce6;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}
.section {
  background: #fff;
  border: 1px solid #e8ecf2;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
}
.sectionTitle {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 14px;
}
.row {
  display: flex;
  gap: 8px;
}
.input {
  padding: 8px 10px;
  border: 1px solid #d8dce6;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  flex: 1;
}
.input:focus { border-color: #3563e9; }
.saveBtn, .addBtn {
  padding: 8px 18px;
  border: none;
  border-radius: 6px;
  background: #3563e9;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}
.userList {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}
.userRow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f6f7f9;
  border-radius: 6px;
}
.userName { flex: 1; font-size: 13px; }
.userRole {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #e8edfb;
  color: #3563e9;
}
.deleteBtn {
  padding: 4px 10px;
  border: 1px solid #c74060;
  border-radius: 4px;
  background: transparent;
  color: #c74060;
  font-size: 11px;
  cursor: pointer;
}
.addForm {
  display: flex;
  gap: 8px;
}
```

- [ ] **Step 2: 개발 서버에서 설정 페이지 확인**

PM으로 로그인 후 `/settings`:
1. 프로젝트 이름 수정 + 저장 → 반영되는지
2. 팀원 추가 (이름 + PIN 입력) → 로그인 페이지에 새 유저 표시
3. 팀원 삭제 → 목록에서 제거
4. 팀원 계정으로 로그인 시 설정 버튼이 안 보이는지
5. 팀원이 `/settings` 직접 접근 시 `/`로 리다이렉트되는지

- [ ] **Step 3: 커밋**

```bash
git add src/app/settings
git commit -m "feat: PM settings page for user and project management"
```

---

## Post-Implementation Checklist

- [ ] Supabase에 `schema.sql` 실행하여 테이블 생성
- [ ] `seed.sql` 실행하여 테스트 데이터 삽입
- [ ] `.env.local`에 Supabase URL/키 설정
- [ ] `npm run test` — 모든 단위 테스트 통과
- [ ] `npm run build` — 빌드 에러 없음
- [ ] 전체 흐름 수동 테스트: 로그인 → WBS 관리 → 작업 CRUD → 드래그 앤 드롭 → Export → 설정
