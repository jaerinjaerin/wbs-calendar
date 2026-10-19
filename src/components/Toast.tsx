'use client';

import { useState, useRef } from 'react';

export type ToastData = { message: string; onRetry?: () => void; actionLabel?: string };

// Bottom-right toast with optional retry; auto-hides after 6s.
export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  function hideToast() {
    clearTimeout(timer.current);
    setToast(null);
  }

  function showToast(next: ToastData) {
    clearTimeout(timer.current);
    setToast(next);
    timer.current = setTimeout(() => setToast(null), 6000);
  }

  const toastNode = toast && (
    <div role="status" className="fixed bottom-lg right-lg max-md:left-md max-md:right-md max-md:bottom-md z-[110] flex items-center gap-sm bg-surface-dark text-on-dark rounded-lg pl-md pr-xs py-xs text-body-xs font-medium shadow-card">
      <span className="flex-1">{toast.message}</span>
      {toast.onRetry && (
        <button className="h-7 px-sm rounded-md bg-surface-dark-elevated border-none text-on-dark text-body-xs font-semibold cursor-pointer hover:bg-primary-active" onClick={toast.onRetry}>{toast.actionLabel ?? '다시 시도'}</button>
      )}
      <button className="w-7 h-7 rounded-md bg-transparent border-none text-on-dark-soft cursor-pointer hover:bg-surface-dark-elevated hover:text-on-dark" onClick={hideToast} aria-label="닫기">✕</button>
    </div>
  );

  return { showToast, hideToast, toastNode };
}
