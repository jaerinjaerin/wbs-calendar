'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { WbsNode } from '@/types';
import { flattenHierarchical } from '@/lib/wbs';

const Badge = ({ color }: { color: string }) => (
  <span className="w-3 h-3 rounded-[3px] shrink-0" style={{ background: color }} />
);

// native <option> can't render color badges, so this is a minimal custom dropdown
export default function WbsSelect({ nodes, value, onChange }: { nodes: WbsNode[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sorted = useMemo(() => flattenHierarchical(nodes), [nodes]);
  const current = nodes.find((n) => n.id === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc, true); };
  }, [open]);

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        type="button"
        className="w-full flex items-center gap-xs bg-transparent border-none rounded-sm py-xxs px-xxs text-body-xs text-ink cursor-pointer hover:bg-surface-strong text-left"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Badge color={current?.color ?? '#ccc'} />
        <span className="flex-1 truncate">{current?.name ?? '분류 선택'}</span>
        <span className="text-muted-soft text-[10px]">▾</span>
      </button>
      {open && (
        <ul role="listbox" className="absolute left-0 right-0 top-full mt-1 z-50 max-h-60 overflow-y-auto bg-canvas border border-hairline rounded-md shadow-lg py-xxs list-none m-0 p-0">
          {sorted.map((n) => (
            <li
              key={n.id}
              role="option"
              aria-selected={n.id === value}
              className={`flex items-center gap-xs py-1.5 pr-sm text-body-xs cursor-pointer hover:bg-surface-card ${n.id === value ? 'font-semibold' : ''}`}
              style={{ paddingLeft: 8 + n.depth * 16 }}
              onClick={() => { onChange(n.id); setOpen(false); }}
            >
              <Badge color={n.color} />
              <span className="flex-1 truncate">{n.name}</span>
              {n.id === value && <span className="text-[11px]">✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
