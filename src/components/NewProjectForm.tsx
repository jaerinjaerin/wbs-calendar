'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { primaryBtn, secondaryBtn, modalOverlay } from '@/lib/styles';
import { groupCls, rowCls, labelCls, fieldCls } from '@/components/TaskPeekPanel';
import { createProject } from '@/app/actions';
import { errorMessage } from '@/lib/actionResult';

const rowInputCls = `${fieldCls} flex-1 min-w-0 text-body-xs text-ink py-xxs px-xxs placeholder:text-muted-soft`;

// With no projects yet the form shows inline; otherwise behind a "+ 새 프로젝트" button as a modal.
export default function NewProjectForm({ hasProjects }: { hasProjects: boolean }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const [setupProject, setSetupProject] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    if (!showForm) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showForm]);

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
        {hasProjects && (
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

  if (!hasProjects) return setupForm;

  return (
    <>
      <button className="mt-lg py-2.5 px-lg border-2 border-dashed border-hairline rounded-lg bg-transparent text-muted text-body-sm cursor-pointer transition-colors hover:border-primary hover:text-primary" onClick={() => setShowForm(true)}>
        + 새 프로젝트
      </button>
      {showForm && (
        <div role="dialog" aria-modal="true" className={modalOverlay} onClick={() => setShowForm(false)}>
          {setupForm}
        </div>
      )}
    </>
  );
}
