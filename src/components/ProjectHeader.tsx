'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ProjectSummary } from '@/types';

// Tabler icons (MIT), inlined like the rest of the app's icons
const Svg = ({ children, size = 20 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const SpreadsheetIcon = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M8 11h8v7h-8z" /><path d="M8 15h8" /><path d="M11 11v7" /></Svg>
);
const SettingsIcon = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></Svg>
);
const ListTreeIcon = () => (
  <Svg><path d="M9 6h11" /><path d="M12 12h8" /><path d="M15 18h5" /><path d="M5 6v.01" /><path d="M8 12v.01" /><path d="M11 18v.01" /></Svg>
);
const ChevronIcon = ({ up }: { up: boolean }) => (
  <Svg size={16}><path d={up ? 'M6 15l6 -6l6 6' : 'M6 9l6 6l6 -6'} /></Svg>
);
const CheckIcon = () => <Svg size={16}><path d="M5 12l5 5l10 -10" /></Svg>;

const iconBtn = 'w-9 h-9 rounded-md border-none bg-transparent text-on-dark cursor-pointer flex items-center justify-center hover:bg-surface-dark-elevated disabled:opacity-40 disabled:cursor-default';
const menuItem = 'w-full flex items-center gap-xs px-xs py-[7px] rounded-sm text-body-sm text-ink text-left bg-transparent border-none cursor-pointer hover:bg-surface-card disabled:opacity-40 disabled:cursor-default';
const menuSection = 'px-xs pt-xs pb-xxs text-micro text-muted-soft';

interface Excel { run: () => void; busy: boolean; empty: boolean }

interface ProjectHeaderProps {
  project: ProjectSummary;
  projects: ProjectSummary[];
  excel: Excel;
  onToggleWbs: () => void;
  wbsOpen: boolean;
}

export default function ProjectHeader({ project, projects, excel, onToggleWbs, wbsOpen }: ProjectHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const settingsHref = `/settings?project=${project.id}`;
  const excelTitle = excel.empty ? '내보낼 작업이 없습니다' : excel.busy ? '내보내는 중…' : '엑셀로 내보내기';

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [menuOpen]);

  return (
    <header className="flex items-center gap-xxs md:gap-xs px-xs h-12 md:px-md md:h-14 bg-surface-dark shrink-0">
      <button className={`${iconBtn} text-body-md`} onClick={() => router.push('/')} aria-label="프로젝트 목록" title="프로젝트 목록">←</button>

      <div ref={menuRef} className="relative min-w-0">
        <button
          className="flex items-center gap-xxs min-w-0 max-w-full px-xs h-9 rounded-md border-none bg-transparent text-on-dark cursor-pointer hover:bg-surface-dark-elevated"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="font-display text-title-sm md:text-title-md truncate">{project.name}</span>
          <span className="shrink-0 text-on-dark-soft"><ChevronIcon up={menuOpen} /></span>
        </button>

        {menuOpen && (
          <div role="menu" className="fixed md:absolute left-xs right-xs md:left-0 md:right-auto top-[52px] md:top-full md:mt-xxs md:w-[280px] z-50 bg-canvas border border-hairline rounded-lg shadow-card p-xxs max-h-[70dvh] overflow-y-auto">
            {/* desktop has these as header icons */}
            <div className="md:hidden">
              <p className={`${menuSection} m-0`}>이 프로젝트</p>
              <button role="menuitem" className={menuItem} disabled={excel.empty || excel.busy} onClick={() => { setMenuOpen(false); excel.run(); }}>
                <SpreadsheetIcon size={18} />{excel.busy ? '내보내는 중…' : '엑셀로 내보내기'}
              </button>
              <Link role="menuitem" href={settingsHref} className={`${menuItem} no-underline`} onClick={() => setMenuOpen(false)}>
                <SettingsIcon size={18} />설정
              </Link>
              <div className="my-xxs border-t border-hairline" />
            </div>
            <p className={`${menuSection} m-0`}>프로젝트 이동</p>
            {projects.map((p) => (
              <Link
                key={p.id}
                role="menuitem"
                href={`/${encodeURIComponent(p.name)}`}
                className={`${menuItem} no-underline ${p.id === project.id ? 'bg-surface-card font-medium' : ''}`}
                aria-current={p.id === project.id ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <span className="flex-1 truncate">{p.name}</span>
                {p.id === project.id && <CheckIcon />}
              </Link>
            ))}
            <Link role="menuitem" href="/" className={`${menuItem} no-underline text-muted`} onClick={() => setMenuOpen(false)}>
              모든 프로젝트 보기
            </Link>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-xxs">
        <button className={iconBtn} onClick={excel.run} disabled={excel.empty || excel.busy} aria-label={excelTitle} title={excelTitle}>
          {excel.busy ? <span className="w-4 h-4 rounded-full border-2 border-on-dark-soft border-t-on-dark animate-spin" /> : <SpreadsheetIcon />}
        </button>
        <Link href={settingsHref} className={iconBtn} aria-label="설정" title="설정"><SettingsIcon /></Link>
      </div>

      <button
        className={`${iconBtn} ${wbsOpen ? 'bg-surface-dark-elevated' : ''}`}
        onClick={onToggleWbs}
        aria-label="분류 목록"
        aria-expanded={wbsOpen}
        title="분류 목록"
      >
        <ListTreeIcon />
      </button>
    </header>
  );
}
