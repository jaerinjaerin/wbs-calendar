'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { verifyPin } from '@/lib/auth';
import type { User, Project } from '@/types';
import styles from './page.module.css';

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
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>설정</h1>
          <button className={styles.backBtn} onClick={() => router.push(backPath)}>← 캘린더로</button>
        </div>
        <form className={styles.authForm} onSubmit={handleAuth}>
          <p className={styles.authLabel}>관리자 비밀번호를 입력하세요</p>
          <input
            className={styles.input}
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {authError && <p className={styles.authError}>{authError}</p>}
          <button className={styles.authBtn} type="submit">확인</button>
        </form>
      </div>
    );
  }

  const isDirty = projectName.trim() !== initialName.current
    || users.map((u) => u.id).sort().join() !== initialUserIds.current.join();

  const backPath = `/${encodeURIComponent(project.name)}`;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>설정</h1>
        <button className={styles.backBtn} onClick={() => router.push(backPath)}>← 캘린더로</button>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>프로젝트</h2>
        <input
          className={styles.input}
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>팀원 관리</h2>
        <div className={styles.userList}>
          {users.map((u) => (
            <div key={u.id} className={styles.userRow}>
              <span className={styles.userName}>{u.name}</span>
              <span className={styles.userRole}>{u.role === 'pm' ? 'PM' : '팀원'}</span>
              {u.role !== 'pm' && (
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
          <button className={styles.addBtn} type="submit">추가</button>
        </form>
      </section>

      <button
        className={`${styles.saveBtn} ${!isDirty ? styles.saveBtnDisabled : ''}`}
        onClick={handleSave}
        disabled={!isDirty}
      >
        저장
      </button>

      <button className={styles.dangerBtn} onClick={handleDeleteProject}>
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
