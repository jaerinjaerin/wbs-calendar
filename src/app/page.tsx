'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { primaryBtn, secondaryBtn, modalOverlay } from '@/lib/styles';
import { groupCls, rowCls, labelCls, fieldCls } from '@/components/TaskPeekPanel';
import { listProjects, createProject } from './actions';
import { errorMessage } from '@/lib/actionResult';
import type { ProjectSummary } from '@/types';

// ponytail: module-level cache survives client-side navigation; stale list shows instantly, then revalidates on mount
let cachedProjects: ProjectSummary[] | null = null;

const rowInputCls = `${fieldCls} flex-1 min-w-0 text-body-xs text-ink py-xxs px-xxs placeholder:text-muted-soft`;

export default function ProjectListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>(cachedProjects ?? []);
  const [loaded, setLoaded] = useState(cachedProjects !== null);
  // without this, a failed load would look like "no projects yet" and show the setup form
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [setupProject, setSetupProject] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!showForm) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showForm]);

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

  if (!loaded) return null;

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen p-lg">
        <p className="text-body-sm text-muted text-center">{loadError}</p>
      </div>
    );
  }

  const setupForm = (
    <form
      className="w-[calc(100%-32px)] max-w-[460px] bg-canvas rounded-lg shadow-card p-md flex flex-col gap-sm"
      onClick={(e) => e.stopPropagation()}
      onSubmit={handleSetup}
    >
      <div className={`${groupCls} pb-xxs`}>
        <input
          className={`${fieldCls} text-body-md font-semibold text-ink py-xs w-full placeholder:text-muted-soft`}
          placeholder="새 프로젝트"
          value={setupProject}
          onChange={(e) => setSetupProject(e.target.value)}
          autoFocus
        />
        <div className={rowCls}>
          <span className={labelCls}>관리자</span>
          <input className={rowInputCls} placeholder="이름" value={setupName} onChange={(e) => setSetupName(e.target.value)} />
        </div>
        <div className={rowCls}>
          <span className={labelCls}>비밀번호</span>
          <input className={rowInputCls} placeholder="설정 접근용" type="password" value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} />
        </div>
      </div>
      {setupError && <p className="text-error text-caption">{setupError}</p>}
      <div className="flex justify-end gap-xs">
        {projects.length > 0 && (
          <button type="button" className={secondaryBtn} onClick={() => setShowForm(false)}>
            취소
          </button>
        )}
        <button className={primaryBtn} type="submit" disabled={setupLoading}>
          {setupLoading ? '생성 중…' : '만들기'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-lg">
      <h1 className="flex items-center gap-sm font-display text-display-sm text-ink mb-xs">
        <img src="/icon.svg" alt="" className="w-xl h-xl" />
        WBS 캘린더
      </h1>
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
        <div role="dialog" aria-modal="true" className={modalOverlay} onClick={() => setShowForm(false)}>
          {setupForm}
        </div>
      )}
    </div>
  );
}
