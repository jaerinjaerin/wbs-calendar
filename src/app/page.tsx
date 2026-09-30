'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { hashPin } from '@/lib/auth';
import type { Project } from '@/types';

export default function ProjectListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [setupProject, setSetupProject] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (data) setProjects(data);
    setLoaded(true);
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!setupProject.trim() || !setupName.trim() || !setupPassword.trim()) {
      setSetupError('모든 필드를 입력하세요');
      return;
    }
    setSetupLoading(true);
    setSetupError(null);

    const adminHash = await hashPin(setupPassword);
    const { data: project, error: pErr } = await supabase
      .from('projects')
      .insert({ name: setupProject.trim(), admin_password_hash: adminHash })
      .select()
      .single();

    if (pErr || !project) {
      setSetupError('프로젝트 생성 실패');
      setSetupLoading(false);
      return;
    }

    const { data: user, error: uErr } = await supabase
      .from('users')
      .insert({ name: setupName.trim(), pin_hash: null, role: 'pm', project_id: project.id })
      .select()
      .single();

    if (uErr || !user) {
      setSetupError('사용자 생성 실패');
      setSetupLoading(false);
      return;
    }

    await supabase.from('projects').update({ owner_id: user.id }).eq('id', project.id);
    router.push(`/${encodeURIComponent(project.name)}`);
  }

  if (!loaded) return null;

  const inputCls = 'py-2.5 px-3 border-2 border-hairline rounded-md text-body-sm font-sans outline-none focus:border-primary';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-lg">
      <h1 className="font-display text-display-sm text-ink mb-xs">WBS·Cal</h1>
      <p className="text-muted text-body-sm mb-xl">프로젝트를 선택하세요</p>

      {projects.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-md max-w-[500px] w-full">
          {projects.map((p) => (
            <button
              key={p.id}
              className="flex flex-col items-center gap-xs py-lg px-md bg-canvas border-2 border-hairline rounded-lg cursor-pointer transition-colors hover:border-primary"
              onClick={() => router.push(`/${encodeURIComponent(p.name)}`)}
            >
              <div className="w-12 h-12 rounded-full bg-surface-soft text-primary flex items-center justify-center text-lg font-semibold">
                {p.name.charAt(0)}
              </div>
              <span className="text-body-sm font-medium">{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {(showForm || projects.length === 0) && (
        <form className="flex flex-col gap-sm w-full max-w-[320px]" onSubmit={handleSetup}>
          <p className="text-body-sm font-semibold text-ink text-center mb-xxs">새 프로젝트 만들기</p>
          <input className={inputCls} placeholder="프로젝트명" value={setupProject} onChange={(e) => setSetupProject(e.target.value)} autoFocus />
          <input className={inputCls} placeholder="PM 이름" value={setupName} onChange={(e) => setSetupName(e.target.value)} />
          <input className={inputCls} placeholder="관리자 비밀번호 (설정 접근용)" type="password" value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} />
          {setupError && <p className="text-error text-caption text-center">{setupError}</p>}
          <button className="py-2.5 border-none rounded-md bg-primary text-on-primary text-body-sm font-medium cursor-pointer mt-xxs disabled:opacity-60 disabled:cursor-not-allowed" type="submit" disabled={setupLoading}>
            {setupLoading ? '생성 중...' : '만들기'}
          </button>
          {projects.length > 0 && (
            <button type="button" className="py-2.5 border border-hairline rounded-md bg-canvas text-body-sm cursor-pointer text-muted" onClick={() => setShowForm(false)}>
              취소
            </button>
          )}
        </form>
      )}

      {!showForm && projects.length > 0 && (
        <button className="mt-lg py-2.5 px-lg border-2 border-dashed border-hairline rounded-lg bg-transparent text-muted text-body-sm cursor-pointer transition-colors hover:border-primary hover:text-primary" onClick={() => setShowForm(true)}>
          + 새 프로젝트
        </button>
      )}
    </div>
  );
}
