'use client';

import type { ReactNode } from 'react';

interface BottomSheetProps {
  onClose: () => void;
  children: ReactNode;
}

// Mobile-only container for TaskPeekPanel / TaskModal. Esc is handled by those children.
export default function BottomSheet({ onClose, children }: BottomSheetProps) {
  function close() {
    // iOS doesn't blur an input when you tap empty space; blur so save-on-blur fields commit first
    (document.activeElement as HTMLElement | null)?.blur();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/30 flex flex-col justify-end" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-canvas rounded-t-xl max-h-[85dvh] overflow-y-auto px-md pt-xs pb-[calc(16px+env(safe-area-inset-bottom))] flex flex-col gap-xs animate-sheet-up motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-1 rounded-pill bg-hairline self-center mb-xxs shrink-0" />
        {children}
      </div>
    </div>
  );
}
