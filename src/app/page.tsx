'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { hashPin } from '@/lib/auth';
import { inputCls, primaryBtn, secondaryBtn, modalOverlay, modalCard } from '@/lib/styles';
import type { Project } from '@/types';

// ponytail: module-level cache survives client-side navigation; stale list shows instantly, then revalidates on mount
let cachedProjects: Project[] | null = null;

export default function ProjectListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(cachedProjects ?? []);
  const [loaded, setLoaded] = useState(cachedProjects !== null);
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
    if (data) {
      cachedProjects = data;
      setProjects(data);
    }
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
      console.error(pErr);
      setSetupError('프로젝트를 만들지 못했습니다. 다시 시도해 주세요');
      setSetupLoading(false);
      return;
    }

    const { data: user, error: uErr } = await supabase
      .from('users')
      .insert({ name: setupName.trim(), pin_hash: null, role: 'pm', project_id: project.id })
      .select()
      .single();

    if (uErr || !user) {
      console.error(uErr);
      setSetupError('관리자 정보를 저장하지 못했습니다. 다시 시도해 주세요');
      setSetupLoading(false);
      return;
    }

    await supabase.from('projects').update({ owner_id: user.id }).eq('id', project.id);
    router.push(`/${encodeURIComponent(project.name)}`);
  }

  if (!loaded) return null;

  const setupForm = (
    <form className="flex flex-col gap-sm w-full max-w-[320px]" onSubmit={handleSetup}>
      <h2 className="text-title-sm text-ink text-center mb-xxs">새 프로젝트 만들기</h2>
      <input className={inputCls} placeholder="프로젝트 이름" value={setupProject} onChange={(e) => setSetupProject(e.target.value)} autoFocus />
      <input className={inputCls} placeholder="관리자 이름" value={setupName} onChange={(e) => setSetupName(e.target.value)} />
      <input className={inputCls} placeholder="관리자 비밀번호 (설정 접근용)" type="password" value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} />
      {setupError && <p className="text-error text-caption text-center">{setupError}</p>}
      <button className={`${primaryBtn} mt-xxs`} type="submit" disabled={setupLoading}>
        {setupLoading ? '생성 중…' : '만들기'}
      </button>
      {projects.length > 0 && (
        <button type="button" className={secondaryBtn} onClick={() => setShowForm(false)}>
          취소
        </button>
      )}
    </form>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-lg">
      <h1 className="font-display text-display-sm text-ink mb-xs">WBS 캘린더</h1>
      <p className="text-muted text-body-sm mb-xl">프로젝트를 선택하세요</p>

      {projects.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-md max-w-[500px] w-full">
          {projects.map((p) => (
            <button
              key={p.id}
              className="flex flex-col items-center gap-xs py-lg px-md bg-canvas border-2 border-hairline rounded-lg cursor-pointer transition-colors hover:border-primary"
              onClick={() => router.push(`/${encodeURIComponent(p.name)}`)}
            >
              <div className="w-12 h-12 rounded-full bg-surface-soft text-primary flex items-center justify-center text-title-md">
                {p.name.charAt(0)}
              </div>
              <span className="text-body-sm font-medium">{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {projects.length === 0 && setupForm}

      {projects.length > 0 && (
        <button className="mt-lg py-2.5 px-lg border-2 border-dashed border-hairline rounded-lg bg-transparent text-muted text-body-sm cursor-pointer transition-colors hover:border-primary hover:text-primary" onClick={() => setShowForm(true)}>
          + 새 프로젝트
        </button>
      )}

      {showForm && projects.length > 0 && (
        <div className={modalOverlay} onClick={() => setShowForm(false)}>
          <div role="dialog" aria-modal="true" className={modalCard} onClick={(e) => e.stopPropagation()}>
            {setupForm}
          </div>
        </div>
      )}
    </div>
  );
}
