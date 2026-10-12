'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getProject, verifyAdmin, addMember, deleteMember, renameProject, deleteProject } from '@/app/actions';
import { errorMessage } from '@/lib/actionResult';
import { useToast } from '@/components/Toast';
import { inputCls, primaryBtn, secondaryBtn, dangerBtn, modalOverlay, modalCard } from '@/lib/styles';
import type { User, ProjectSummary } from '@/types';

const cardCls = 'bg-canvas border border-hairline rounded-lg p-lg mb-md';

function SettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get('project');

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [projectName, setProjectName] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const { showToast, hideToast, toastNode } = useToast();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const composing = useRef(false);
  const submitAfterCompose = useRef(false);

  const initialName = useRef('');

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

  // optimistic like insertTask on the calendar page: client-side id makes retries idempotent (PK conflict)
  async function insertUser(user: User) {
    setUsers((prev) => [...prev, user]);
    const { error } = await addMember(user.project_id, password, { id: user.id, name: user.name });
    // 23505 = unique violation: an earlier attempt already landed, so treat as success
    if (error && error.code !== '23505') {
      console.error(error);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      showToast({ message: errorMessage(error, '팀원 추가에 실패했습니다'), onRetry: () => { hideToast(); insertUser(user); } });
    }
  }

  function handleAddUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // read the DOM value: when submitted from compositionend, state may lag the committed text
    const name = e.currentTarget.querySelector('input')!.value.trim();
    if (!project || !name) return;
    setNewUserName('');
    insertUser({ id: crypto.randomUUID(), name, pin_hash: null, role: 'member', project_id: project.id });
  }

  // optimistic; delete by id is idempotent so retry is safe
  async function handleDeleteUser(user: User) {
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    const { error } = await deleteMember(user.project_id, password, user.id);
    if (error) {
      console.error(error);
      setUsers((prev) => [...prev, user]);
      showToast({ message: errorMessage(error, '팀원 삭제에 실패했습니다'), onRetry: () => { hideToast(); handleDeleteUser(user); } });
    }
  }

  async function handleSave() {
    const name = projectName.trim();
    if (!project || !name || name === initialName.current) return;
    const { error } = await renameProject(project.id, password, name);
    if (error) {
      console.error(error);
      showToast({ message: errorMessage(error, '프로젝트 이름 저장에 실패했습니다') });
      return;
    }
    // no refetch: reloading users here would wipe in-flight optimistic member changes
    setProject({ ...project, name });
    setProjectName(name);
    initialName.current = name;
  }

  async function handleDeleteProject() {
    if (!project) return;
    const { error } = await deleteProject(project.id, password);
    if (error) {
      console.error(error);
      setConfirmingDelete(false);
      showToast({ message: errorMessage(error, '프로젝트 삭제에 실패했습니다') });
      return;
    }
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

  // members save instantly, so only the name needs the save button
  const isDirty = projectName.trim() !== initialName.current;

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
              <span className={`text-caption py-0.5 px-xs rounded-pill ${u.role === 'pm' ? 'bg-primary text-on-primary' : 'bg-surface-card text-muted'}`}>{u.role === 'pm' ? '관리자' : '팀원'}</span>
              {u.role !== 'pm' && (
                // ponytail: always visible on touch screens, hover-reveal from md up
                <button className="text-caption text-muted hover:text-error bg-transparent border-none cursor-pointer md:opacity-0 md:group-hover:opacity-100 focus:opacity-100" onClick={() => handleDeleteUser(u)}>삭제</button>
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
          <button className={`${primaryBtn} shrink-0`} type="submit" onMouseDown={() => { if (composing.current) submitAfterCompose.current = true; }}>추가</button>
        </form>
      </section>

      <div className="flex justify-end mb-xl">
        <button className={primaryBtn} onClick={handleSave} disabled={!isDirty}>저장</button>
      </div>

      <section className={`${cardCls} flex flex-col sm:flex-row sm:items-center justify-between gap-md`}>
        <div>
          <h2 className="text-title-sm text-ink">프로젝트 삭제</h2>
          <p className="text-body-sm text-muted mt-xxs">모든 분류·작업·팀원 데이터가 함께 삭제되며 되돌릴 수 없습니다</p>
        </div>
        <button className="h-10 px-4 rounded-md border border-error/40 bg-canvas text-error text-body-sm font-semibold cursor-pointer whitespace-nowrap hover:bg-error/5" onClick={() => setConfirmingDelete(true)}>
          프로젝트 삭제
        </button>
      </section>
      {confirmingDelete && (
        <div className={modalOverlay} onClick={() => setConfirmingDelete(false)}>
          <div role="alertdialog" aria-modal="true" className={`${modalCard} flex flex-col gap-sm`} onClick={(e) => e.stopPropagation()}>
            <span className="text-title-sm text-ink">&quot;{project.name}&quot; 삭제</span>
            <p className="text-body-sm text-muted m-0">모든 분류·작업·팀원 데이터가 함께 삭제되며 되돌릴 수 없습니다.</p>
            <div className="flex gap-xs justify-end mt-xs">
              <button className={secondaryBtn} onClick={() => setConfirmingDelete(false)} autoFocus>취소</button>
              <button className={dangerBtn} onClick={handleDeleteProject}>삭제</button>
            </div>
          </div>
        </div>
      )}
      {toastNode}
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
