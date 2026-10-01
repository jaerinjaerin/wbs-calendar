'use client';

import { useEffect, useRef } from 'react';
import type { Task, WbsNode, User, TaskStatus } from '@/types';

interface TaskPeekPanelProps {
  task: Task;
  wbsNodes: WbsNode[];
  users: User[];
  anchorRect: DOMRect | null;
  onUpdate: (changes: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const statusCls: Record<string, string> = {
  todo: 'bg-surface-card text-muted-soft',
  in_progress: 'bg-warning/10 text-warning',
  done: 'bg-success/10 text-success',
};

const POPOVER_W = 280;
const GAP = 8;

function formatDate(d: string) {
  const [, m, day] = d.split('-');
  return `${Number(m)}월 ${Number(day)}일`;
}

export default function TaskPeekPanel({ task, wbsNodes, users, anchorRect, onUpdate, onDelete, onClose }: TaskPeekPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const node = wbsNodes.find((n) => n.id === task.wbs_node_id);
  const assignee = task.assignee_id ? users.find((u) => u.id === task.assignee_id) : null;

  // ponytail: position left or right of anchor based on viewport space
  const style: React.CSSProperties = {};
  if (anchorRect) {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const spaceRight = vw - anchorRect.right;
    if (spaceRight >= POPOVER_W + GAP) {
      style.left = anchorRect.right + GAP;
    } else {
      style.left = anchorRect.left - POPOVER_W - GAP;
    }
    style.top = Math.max(8, Math.min(anchorRect.top, (typeof window !== 'undefined' ? window.innerHeight : 800) - 300));
  }

  const period = task.start_date === task.end_date
    ? formatDate(task.start_date)
    : `${formatDate(task.start_date)} → ${formatDate(task.end_date)}`;

  return (
    <div
      ref={panelRef}
      style={{ width: POPOVER_W, ...style }}
      className="fixed z-50 bg-canvas rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-hairline p-4 flex flex-col gap-3"
    >
      <h3 className="text-[15px] font-semibold text-ink pr-5 leading-snug">{task.name}</h3>
      <button className="absolute top-3 right-3 w-5 h-5 rounded-full border-none bg-transparent text-muted-soft cursor-pointer text-xs hover:text-ink" onClick={onClose}>✕</button>

      <div className="flex flex-col gap-2 text-[13px]">
        <div className="flex items-center gap-2 text-muted">{period}</div>

        <div className="flex items-center gap-2">
          <span className="text-muted-soft text-xs w-[52px] shrink-0">담당자</span>
          <span className="text-ink">{assignee?.name ?? '미지정'}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-soft text-xs w-[52px] shrink-0">Phase</span>
          <span className="text-ink flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-[2px]" style={{ background: node?.color ?? '#ccc' }} />
            {node?.name ?? ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-soft text-xs w-[52px] shrink-0">상태</span>
          <select
            className={`px-2 py-[2px] rounded-lg text-xs font-medium border-none cursor-pointer ${statusCls[task.status] ?? ''}`}
            value={task.status}
            onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })}
          >
            <option value="todo">예정</option>
            <option value="in_progress">진행중</option>
            <option value="done">완료</option>
          </select>
        </div>
      </div>

      <div className="border-t border-hairline pt-2 mt-1">
        <button className="text-error text-xs cursor-pointer bg-transparent border-none p-0 hover:underline" onClick={onDelete}>작업 삭제</button>
      </div>
    </div>
  );
}
