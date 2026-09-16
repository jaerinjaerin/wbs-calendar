'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { hashPin } from '@/lib/auth';
import type { Project } from '@/types';
import styles from './page.module.css';

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

  return (
    <div className={styles.container}>
      <h1 className={styles.logo}>WBS·Cal</h1>
      <p className={styles.subtitle}>프로젝트를 선택하세요</p>

      {projects.length > 0 && (
        <div className={styles.grid}>
          {projects.map((p) => (
            <button
              key={p.id}
              className={styles.card}
              onClick={() => router.push(`/${encodeURIComponent(p.name)}`)}
            >
              <div className={styles.avatar}>{p.name.charAt(0)}</div>
              <span className={styles.name}>{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {(showForm || projects.length === 0) && (
        <form className={styles.setupForm} onSubmit={handleSetup}>
          <p className={styles.formTitle}>새 프로젝트 만들기</p>
          <input
            className={styles.setupInput}
            placeholder="프로젝트명"
            value={setupProject}
            onChange={(e) => setSetupProject(e.target.value)}
            autoFocus
          />
          <input
            className={styles.setupInput}
            placeholder="PM 이름"
            value={setupName}
            onChange={(e) => setSetupName(e.target.value)}
          />
          <input
            className={styles.setupInput}
            placeholder="관리자 비밀번호 (설정 접근용)"
            type="password"
            value={setupPassword}
            onChange={(e) => setSetupPassword(e.target.value)}
          />
          {setupError && <p className={styles.setupError}>{setupError}</p>}
          <button className={styles.setupBtn} type="submit" disabled={setupLoading}>
            {setupLoading ? '생성 중...' : '만들기'}
          </button>
          {projects.length > 0 && (
            <button type="button" className={styles.cancelBtn} onClick={() => setShowForm(false)}>
              취소
            </button>
          )}
        </form>
      )}

      {!showForm && projects.length > 0 && (
        <button className={styles.newProjectBtn} onClick={() => setShowForm(true)}>
          + 새 프로젝트
        </button>
      )}
    </div>
  );
}
