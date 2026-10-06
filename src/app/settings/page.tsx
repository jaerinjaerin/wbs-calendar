'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { verifyPin } from '@/lib/auth';
import type { User, Project } from '@/types';

const inputCls = 'h-10 px-3.5 w-full border border-hairline rounded-md bg-canvas text-body-md text-ink font-sans outline-none placeholder:text-muted-soft focus:border-ink';
const primaryBtn = 'h-10 px-5 rounded-md border-none bg-primary text-on-primary text-body-sm font-semibold cursor-pointer whitespace-nowrap hover:bg-primary-active disabled:bg-primary-disabled disabled:text-muted disabled:cursor-not-allowed';
const secondaryBtn = 'h-10 px-4 inline-flex items-center gap-1.5 rounded-md border border-hairline bg-canvas text-ink text-body-sm font-semibold cursor-pointer whitespace-nowrap hover:bg-surface-card';
const cardCls = 'bg-canvas border border-hairline rounded-lg p-lg mb-md';

function SettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get('project');

  const [project, setProject] = useState<Project | null>(null);
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [projectName, setProjectName] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const composing = useRef(false);
  const submitAfterCompose = useRef(false);

  const initialName = useRef('');
  const initialUserIds = useRef<string[]>([]);

  useEffect(() => {
    if (!projectIdParam) { router.replace('/'); return; }
    supabase
      .from('projects')
      .select('*')
      .eq('id', projectIdParam)
      .single()
      .then(({ data }) => {
        if (!data) { router.replace('/'); return; }
        setProject(data);
      });
  }, [projectIdParam, router]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!project?.admin_password_hash) return;
    const valid = await verifyPin(password, project.admin_password_hash);
    if (valid) {
      setVerified(true);
      setAuthError(null);
      loadData(project.id);
    } else {
      setAuthError('비밀번호가 올바르지 않습니다');
    }
  }

  async function loadData(projectId: string) {
    const [{ data: u }, { data: p }] = await Promise.all([
      supabase.from('users').select('*').eq('project_id', projectId),
      supabase.from('projects').select('*').eq('id', projectId).single(),
    ]);
    if (u) {
      setUsers(u);
      initialUserIds.current = u.map((x) => x.id).sort();
    }
    if (p) {
      setProject(p);
      setProjectName(p.name);
      initialName.current = p.name;
    }
  }

  async function handleAddUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // read the DOM value: when submitted from compositionend, state may lag the committed text
    const name = e.currentTarget.querySelector('input')!.value.trim();
    if (!project || !name || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const { error } = await supabase.from('users').insert({
        name,
        pin_hash: null,
        role: 'member',
        project_id: project.id,
      });
      if (error) {
        setAddError('팀원을 추가하지 못했습니다. 네트워크 상태를 확인하고 다시 시도하세요.');
        return;
      }
      setNewUserName('');
      await loadData(project.id);
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!project) return;
    await supabase.from('users').delete().eq('id', userId);
    await loadData(project.id);
  }

  async function handleSave() {
    if (!project || !projectName.trim()) return;
    if (projectName.trim() !== initialName.current) {
      await supabase.from('projects').update({ name: projectName.trim() }).eq('id', project.id);
    }
    await loadData(project.id);
  }

  async function handleDeleteProject() {
    if (!project) return;
    if (!confirm(`"${project.name}" 프로젝트를 삭제하시겠습니까?\n모든 데이터가 삭제됩니다.`)) return;
    await supabase.from('projects').delete().eq('id', project.id);
    router.replace('/');
  }

  if (!project) return null;

  const backPath = `/${encodeURIComponent(project.name)}`;

  const header = (
    <div className="flex items-start justify-between gap-md mb-xl">
      <div>
        <h1 className="font-display text-display-sm text-ink">설정</h1>
        <p className="text-body-sm text-muted mt-xxs">{project.name}</p>
      </div>
      <button className={secondaryBtn} onClick={() => router.push(backPath)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        캘린더로
      </button>
    </div>
  );

  if (!verified) {
    return (
      <div className="max-w-[640px] mx-auto py-xxl px-lg">
        {header}
        <form className={cardCls} onSubmit={handleAuth}>
          <h2 className="text-title-sm text-ink">관리자 인증</h2>
          <p className="text-body-sm text-muted mt-xxs mb-md">프로젝트를 만들 때 정한 관리자 비밀번호를 입력하세요</p>
          <input className={inputCls} type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          {authError && <p className="text-caption text-error mt-xs">{authError}</p>}
          <button className={`${primaryBtn} w-full mt-md`} type="submit">확인</button>
        </form>
      </div>
    );
  }

  const isDirty = projectName.trim() !== initialName.current
    || users.map((u) => u.id).sort().join() !== initialUserIds.current.join();

  return (
    <div className="max-w-[640px] mx-auto py-xxl px-lg">
      {header}

      <section className={cardCls}>
        <h2 className="text-title-sm text-ink">프로젝트</h2>
        <p className="text-body-sm text-muted mt-xxs mb-md">캘린더 상단에 표시되는 이름</p>
        <input className={inputCls} value={projectName} onChange={(e) => setProjectName(e.target.value)} />
      </section>

      <section className={cardCls}>
        <h2 className="text-title-sm text-ink">팀원</h2>
        <p className="text-body-sm text-muted mt-xxs mb-md">작업 담당자로 지정할 수 있는 사람</p>
        <ul className="divide-y divide-hairline-soft border-y border-hairline-soft mb-md">
          {users.map((u) => (
            <li key={u.id} className="group flex items-center gap-sm py-sm">
              <span className="w-7 h-7 rounded-full bg-surface-card text-ink text-caption flex items-center justify-center shrink-0">{u.name.charAt(0)}</span>
              <span className="flex-1 text-body-sm text-ink truncate">{u.name}</span>
              <span className={`text-xs font-medium py-0.5 px-2 rounded-pill ${u.role === 'pm' ? 'bg-primary text-on-primary' : 'bg-surface-card text-muted'}`}>{u.role === 'pm' ? 'PM' : '팀원'}</span>
              {u.role !== 'pm' && (
                // ponytail: always visible on touch screens, hover-reveal from md up
                <button className="text-caption text-muted hover:text-error bg-transparent border-none cursor-pointer md:opacity-0 md:group-hover:opacity-100 focus:opacity-100" onClick={() => handleDeleteUser(u.id)}>삭제</button>
              )}
            </li>
          ))}
        </ul>
        <form className="flex gap-xs" onSubmit={handleAddUser}>
          <input
            className={`${inputCls} flex-1 min-w-0`}
            placeholder="이름"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={(e) => {
              composing.current = false;
              if (submitAfterCompose.current) {
                submitAfterCompose.current = false;
                e.currentTarget.form?.requestSubmit();
              }
            }}
            required
          />
          {/* Safari drops the click that ends a Korean IME composition, so submit on compositionend instead */}
          <button className={`${primaryBtn} shrink-0`} type="submit" disabled={adding} onMouseDown={() => { if (composing.current) submitAfterCompose.current = true; }}>{adding ? '추가 중…' : '추가'}</button>
        </form>
        {addError && <p className="text-caption text-error mt-xs" role="alert">{addError}</p>}
      </section>

      <div className="flex justify-end mb-xl">
        <button className={primaryBtn} onClick={handleSave} disabled={!isDirty}>저장</button>
      </div>

      <section className={`${cardCls} flex flex-col sm:flex-row sm:items-center justify-between gap-md`}>
        <div>
          <h2 className="text-title-sm text-ink">프로젝트 삭제</h2>
          <p className="text-body-sm text-muted mt-xxs">모든 WBS·작업·팀원 데이터가 함께 삭제되며 되돌릴 수 없습니다</p>
        </div>
        <button className="h-10 px-4 rounded-md border border-error/40 bg-canvas text-error text-body-sm font-semibold cursor-pointer whitespace-nowrap hover:bg-error/5" onClick={handleDeleteProject}>
          프로젝트 삭제
        </button>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  );
}
