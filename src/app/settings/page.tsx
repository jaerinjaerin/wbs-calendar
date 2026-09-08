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
