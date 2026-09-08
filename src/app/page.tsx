'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { hashPin, verifyPin, saveSession, getSession } from '@/lib/auth';
import PinModal from '@/components/PinModal';
import type { User } from '@/types';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const [setupProject, setSetupProject] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session) {
      router.replace('/calendar');
      return;
    }
    loadUsers();
  }, [router]);

  async function loadUsers() {
    const { data } = await supabase.from('users').select('*');
    if (data) setUsers(data);
    setLoaded(true);
  }

  async function handlePinSubmit(pin: string) {
    if (!selectedUser) return;
    const valid = await verifyPin(pin, selectedUser.pin_hash);
    if (valid) {
      saveSession({
        user_id: selectedUser.id,
        project_id: selectedUser.project_id,
        role: selectedUser.role,
      });
      router.push('/calendar');
    } else {
      setPinError('PIN이 올바르지 않습니다');
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!setupProject.trim() || !setupName.trim() || !/^\d{4}$/.test(setupPin)) {
      setSetupError('모든 필드를 입력하세요 (PIN은 숫자 4자리)');
      return;
    }
    setSetupLoading(true);
    setSetupError(null);

    const { data: project, error: pErr } = await supabase
      .from('projects')
      .insert({ name: setupProject.trim() })
      .select()
      .single();

    if (pErr || !project) {
      setSetupError('프로젝트 생성 실패');
      setSetupLoading(false);
      return;
    }

    const pinHash = await hashPin(setupPin);
    const { data: user, error: uErr } = await supabase
      .from('users')
      .insert({ name: setupName.trim(), pin_hash: pinHash, role: 'pm', project_id: project.id })
      .select()
      .single();

    if (uErr || !user) {
      setSetupError('사용자 생성 실패');
      setSetupLoading(false);
      return;
    }

    await supabase.from('projects').update({ owner_id: user.id }).eq('id', project.id);

    saveSession({ user_id: user.id, project_id: project.id, role: 'pm' });
    router.push('/calendar');
  }

  if (!loaded) return null;

  if (users.length === 0) {
    return (
      <div className={styles.container}>
        <h1 className={styles.logo}>WBS·Cal</h1>
        <p className={styles.subtitle}>첫 프로젝트를 만들어주세요</p>
        <form className={styles.setupForm} onSubmit={handleSetup}>
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
            placeholder="PIN 4자리"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={setupPin}
            onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ''))}
          />
          {setupError && <p className={styles.setupError}>{setupError}</p>}
          <button className={styles.setupBtn} type="submit" disabled={setupLoading}>
            {setupLoading ? '생성 중...' : '시작하기'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.logo}>WBS·Cal</h1>
      <p className={styles.subtitle}>프로필을 선택하세요</p>
      <div className={styles.grid}>
        {users.map((user) => (
          <button
            key={user.id}
            className={styles.card}
            onClick={() => { setSelectedUser(user); setPinError(null); }}
          >
            <div className={styles.avatar}>
              {user.name.charAt(0)}
            </div>
            <span className={styles.name}>{user.name}</span>
            {user.role === 'pm' && <span className={styles.badge}>PM</span>}
          </button>
        ))}
      </div>

      {selectedUser && (
        <PinModal
          userName={selectedUser.name}
          onSubmit={handlePinSubmit}
          onClose={() => setSelectedUser(null)}
          error={pinError}
        />
      )}
    </div>
  );
}
