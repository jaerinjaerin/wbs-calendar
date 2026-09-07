'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { verifyPin, saveSession, getSession } from '@/lib/auth';
import PinModal from '@/components/PinModal';
import type { User } from '@/types';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

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
