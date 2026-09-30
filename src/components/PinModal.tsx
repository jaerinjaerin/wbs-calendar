'use client';

import { useState, useRef, useEffect } from 'react';

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-canvas rounded-lg p-xl text-center min-w-[300px] shadow-[0_8px_32px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-title-md mb-xxs">{userName}</h2>
        <p className="text-caption text-muted mb-lg">PIN 4자리를 입력하세요</p>
        <div className="flex gap-sm justify-center mb-md">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              className="w-12 h-14 border-2 border-hairline rounded-md text-center text-2xl outline-none focus:border-primary"
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
          ))}
        </div>
        {error && <p className="text-error text-caption">{error}</p>}
      </div>
    </div>
  );
}
