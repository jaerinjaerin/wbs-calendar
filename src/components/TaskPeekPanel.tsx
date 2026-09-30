'use client';

import { useEffect } from 'react';
import type { Task, WbsNode, User, TaskStatus } from '@/types';

interface TaskPeekPanelProps {
  task: Task;
  wbsNodes: WbsNode[];
  users: User[];
  onUpdate: (changes: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const statusCls: Record<string, string> = {
  todo: 'bg-surface-card text-muted-soft',
  in_progress: 'bg-warning/10 text-warning',
  done: 'bg-success/10 text-success',
};

export default function TaskPeekPanel({ task, wbsNodes, users, onUpdate, onDelete, onClose }: TaskPeekPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const node = wbsNodes.find((n) => n.id === task.wbs_node_id);
  const assignee = task.assignee_id ? users.find((u) => u.id === task.assignee_id) : null;

  function getBreadcrumb(): string {
    const parts: string[] = [];
    let current = node;
    while (current) {
      parts.unshift(current.name);
      current = current.parent_id ? wbsNodes.find((n) => n.id === current!.parent_id) : undefined;
    }
    return parts.join(' › ');
  }

  return (
    <div className="fixed right-0 top-12 md:top-14 bottom-0 w-full md:w-[340px] bg-canvas border-l border-hairline shadow-[-4px_0_24px_rgba(0,0,0,0.06)] p-lg z-50 flex flex-col gap-sm">
      <button className="absolute top-md right-md w-6 h-6 rounded-xs border-none bg-transparent text-muted-soft cursor-pointer text-base" onClick={onClose}>✕</button>
      <div className="text-[11px] text-muted-soft">{getBreadcrumb()}</div>
      <h2 className="text-title-sm pr-lg">{task.name}</h2>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-xs text-[13px]">
          <span className="w-[60px] text-muted-soft text-xs shrink-0">상태</span>
          <select
            className={`px-2.5 py-[3px] rounded-xl text-xs font-medium border-none cursor-pointer ${statusCls[task.status] ?? ''}`}
            value={task.status}
            onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })}
          >
            <option value="todo">예정</option>
            <option value="in_progress">진행중</option>
            <option value="done">완료</option>
          </select>
        </div>
        <div className="flex items-center gap-xs text-[13px]">
          <span className="w-[60px] text-muted-soft text-xs shrink-0">기간</span>
          <span className="text-ink">{task.start_date} → {task.end_date}</span>
        </div>
        <div className="flex items-center gap-xs text-[13px]">
          <span className="w-[60px] text-muted-soft text-xs shrink-0">담당자</span>
          <span className="text-ink">{assignee?.name ?? '미지정'}</span>
        </div>
        <div className="flex items-center gap-xs text-[13px]">
          <span className="w-[60px] text-muted-soft text-xs shrink-0">Phase</span>
          <span className="text-ink flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-[2px]" style={{ background: node?.color ?? '#ccc' }} />
            {node?.name ?? ''}
          </span>
        </div>
      </div>
      <button className="mt-auto py-xs border border-error rounded-md bg-transparent text-error text-xs cursor-pointer hover:bg-error/5" onClick={onDelete}>작업 삭제</button>
    </div>
  );
}
