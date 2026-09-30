'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { verifyPin } from '@/lib/auth';
import type { User, Project } from '@/types';

const inputCls = 'py-2 px-2.5 border border-hairline rounded-sm text-[13px] font-sans outline-none w-full flex-1 focus:border-primary';

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

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !newUserName.trim()) return;
    await supabase.from('users').insert({
      name: newUserName.trim(),
      pin_hash: null,
      role: 'member',
      project_id: project.id,
    });
    setNewUserName('');
    await loadData(project.id);
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

  if (!verified) {
    const backPath = `/${encodeURIComponent(project.name)}`;
    return (
      <div className="max-w-[600px] mx-auto py-10 px-lg">
        <div className="flex items-center justify-between mb-xl">
          <h1 className="text-title-lg">설정</h1>
          <button className="py-1.5 px-3.5 rounded-sm border border-hairline bg-canvas text-caption cursor-pointer" onClick={() => router.push(backPath)}>← 캘린더로</button>
        </div>
        <form className="bg-canvas border border-hairline rounded-lg p-5 flex flex-col gap-sm" onSubmit={handleAuth}>
          <p className="text-body-sm font-medium text-muted">관리자 비밀번호를 입력하세요</p>
          <input className={inputCls} type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          {authError && <p className="text-xs text-error">{authError}</p>}
          <button className="py-2.5 border-none rounded-sm bg-primary text-on-primary text-body-sm font-medium cursor-pointer" type="submit">확인</button>
        </form>
      </div>
    );
  }

  const isDirty = projectName.trim() !== initialName.current
    || users.map((u) => u.id).sort().join() !== initialUserIds.current.join();

  const backPath = `/${encodeURIComponent(project.name)}`;

  return (
    <div className="max-w-[600px] mx-auto py-10 px-lg">
      <div className="flex items-center justify-between mb-xl">
        <h1 className="text-title-lg">설정</h1>
        <button className="py-1.5 px-3.5 rounded-sm border border-hairline bg-canvas text-caption cursor-pointer" onClick={() => router.push(backPath)}>← 캘린더로</button>
      </div>

      <section className="bg-canvas border border-hairline rounded-lg p-5 mb-5">
        <h2 className="text-body-sm font-semibold mb-3.5">프로젝트</h2>
        <input className={inputCls} value={projectName} onChange={(e) => setProjectName(e.target.value)} />
      </section>

      <section className="bg-canvas border border-hairline rounded-lg p-5 mb-5">
        <h2 className="text-body-sm font-semibold mb-3.5">팀원 관리</h2>
        <div className="flex flex-col gap-xs mb-3.5">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-xs py-xs px-sm bg-surface-soft rounded-sm">
              <span className="flex-1 text-[13px]">{u.name}</span>
              <span className="text-[11px] py-0.5 px-xs rounded-pill bg-surface-card text-accent">{u.role === 'pm' ? 'PM' : '팀원'}</span>
              {u.role !== 'pm' && (
                <button className="py-xxs px-2.5 border border-error rounded-xs bg-transparent text-error text-[11px] cursor-pointer" onClick={() => handleDeleteUser(u.id)}>삭제</button>
              )}
            </div>
          ))}
        </div>
        <form className="flex gap-xs" onSubmit={handleAddUser}>
          <input className={inputCls} placeholder="이름" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} required />
          <button className="py-xs px-4.5 border-none rounded-sm bg-primary text-on-primary text-[13px] font-medium cursor-pointer whitespace-nowrap" type="submit">추가</button>
        </form>
      </section>

      <button
        className={`block w-full py-3 border-none rounded-md bg-primary text-on-primary text-body-sm font-semibold cursor-pointer mt-xs ${!isDirty ? 'bg-primary-disabled text-muted cursor-not-allowed' : ''}`}
        onClick={handleSave}
        disabled={!isDirty}
      >
        저장
      </button>

      <button className="block w-full py-3 border border-error rounded-md bg-transparent text-error text-body-sm font-medium cursor-pointer mt-sm hover:bg-red-50" onClick={handleDeleteProject}>
        프로젝트 삭제
      </button>
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
