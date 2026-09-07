'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './PinModal.module.css';

interface PinModalProps {
  userName: string;
  onSubmit: (pin: string) => void;
  onClose: () => void;
  error: string | null;
}

export default function PinModal({ userName, onSubmit, onClose, error }: PinModalProps) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
    if (value && index === 3) {
      onSubmit(next.join(''));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{userName}</h2>
        <p className={styles.subtitle}>PIN 4자리를 입력하세요</p>
        <div className={styles.pinRow}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              className={styles.pinInput}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
          ))}
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
