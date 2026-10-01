'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Task, WbsNode, User, TaskStatus, TaskPriority } from '@/types';

interface TaskPeekPanelProps {
  task: Task;
  wbsNodes: WbsNode[];
  users: User[];
  anchorRect: DOMRect | null;
  onUpdate: (changes: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export const statusCls: Record<TaskStatus, string> = {
  todo: 'text-muted',
  in_progress: 'text-warning',
  done: 'text-success',
};

export const priorityCls: Record<TaskPriority, string> = {
  high: 'text-error',
  medium: 'text-warning',
  low: 'text-muted',
};

const POPOVER_W = 300;
const GAP = 8;

const fmt = (d: string) => `${d.replaceAll('-', '.')}.`;

export const groupCls = 'bg-surface-card rounded-lg px-sm';
export const rowCls = 'flex items-center gap-xs min-h-9 text-[13px] [&+&]:border-t [&+&]:border-hairline';
export const labelCls = 'text-muted text-xs shrink-0 w-[52px]';
export const fieldCls = 'bg-transparent border-none outline-none rounded-sm'; // no focus ring: the caret is enough
export const selectCls = 'flex-1 min-w-0 bg-transparent border-none outline-none rounded-sm py-xxs px-xxs text-[13px] cursor-pointer hover:bg-surface-strong';

export default function TaskPeekPanel({ task, wbsNodes, users, anchorRect, onUpdate, onDelete, onClose }: TaskPeekPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(task.name);
  const [memo, setMemo] = useState(task.memo ?? '');
  const [url, setUrl] = useState(task.url ?? '');
  const [editingDates, setEditingDates] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [top, setTop] = useState(anchorRect?.top ?? 8);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmingDelete) { setConfirmingDelete(false); return; }
      (document.activeElement as HTMLElement | null)?.blur(); // flush pending text edit before closing
      onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, confirmingDelete]);

  // clamp to viewport using the real panel height (it grows when dates expand)
  useLayoutEffect(() => {
    if (!anchorRect || !panelRef.current) return;
    const h = panelRef.current.offsetHeight;
    setTop(Math.max(8, Math.min(anchorRect.top, window.innerHeight - h - 8)));
  }, [anchorRect, editingDates]);

  const node = wbsNodes.find((n) => n.id === task.wbs_node_id);

  const left = anchorRect
    ? (window.innerWidth - anchorRect.right >= POPOVER_W + GAP ? anchorRect.right + GAP : anchorRect.left - POPOVER_W - GAP)
    : undefined;

  // save text fields on blur only when changed
  function commit<K extends 'name' | 'memo' | 'url'>(key: K, value: string) {
    const v = value.trim();
    if (key === 'name') {
      if (!v) { setName(task.name); return; }
      if (v !== task.name) onUpdate({ name: v });
      return;
    }
    if (v !== (task[key] ?? '')) onUpdate({ [key]: v || null });
  }

  function changeStart(start: string) {
    if (!start) return;
    onUpdate({ start_date: start, end_date: task.end_date < start ? start : task.end_date });
  }

  function changeEnd(end: string) {
    if (!end) return;
    onUpdate({ end_date: end < task.start_date ? task.start_date : end });
  }

  return (
    <div
      ref={panelRef}
      style={{ width: POPOVER_W, left, top }}
      className="fixed z-50 bg-canvas rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-hairline p-xs flex flex-col gap-xs"
    >
      {/* title + period */}
      <div className={`${groupCls} flex gap-sm`}>
        <span className="w-1 rounded-xs my-xs shrink-0" style={{ background: node?.color ?? '#ccc' }} />
        <div className="flex-1 min-w-0 flex flex-col">
          <input
            className={`${fieldCls} text-[16px] font-semibold text-ink py-xs px-xxs w-full`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => commit('name', name)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
          <button
            className="self-start text-[13px] text-body bg-transparent border-none cursor-pointer rounded-sm px-xxs py-xxs mb-xxs hover:bg-surface-strong"
            onClick={() => setEditingDates((v) => !v)}
          >
            {fmt(task.start_date)} ~ {fmt(task.end_date)}
          </button>
          {editingDates && (
            <div className="flex flex-col pb-xxs">
              <div className={rowCls}>
                <span className={labelCls}>시작</span>
                <input type="date" className={`${fieldCls} ml-auto text-[13px] px-xxs`} value={task.start_date} onChange={(e) => changeStart(e.target.value)} />
              </div>
              <div className={rowCls}>
                <span className={labelCls}>종료</span>
                <input type="date" className={`${fieldCls} ml-auto text-[13px] px-xxs`} value={task.end_date} min={task.start_date} onChange={(e) => changeEnd(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* attributes */}
      <div className={groupCls}>
        <div className={rowCls}>
          <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: node?.color ?? '#ccc' }} />
          <select className={`${selectCls} text-ink`} value={task.wbs_node_id} onChange={(e) => onUpdate({ wbs_node_id: e.target.value })}>
            {wbsNodes.map((n) => <option key={n.id} value={n.id}>{'　'.repeat(n.depth)}{n.name}</option>)}
          </select>
        </div>
        <div className={rowCls}>
          <span className={labelCls}>담당자</span>
          <select className={`${selectCls} text-ink`} value={task.assignee_id ?? ''} onChange={(e) => onUpdate({ assignee_id: e.target.value || null })}>
            <option value="">미지정</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className={rowCls}>
          <span className={labelCls}>상태</span>
          <select className={`${selectCls} font-medium ${statusCls[task.status]}`} value={task.status} onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })}>
            <option value="todo">예정</option>
            <option value="in_progress">진행중</option>
            <option value="done">완료</option>
          </select>
        </div>
        <div className={rowCls}>
          <span className={labelCls}>우선순위</span>
          <select
            className={`${selectCls} font-medium ${task.priority ? priorityCls[task.priority] : 'text-muted-soft'}`}
            value={task.priority ?? ''}
            onChange={(e) => onUpdate({ priority: (e.target.value || null) as TaskPriority | null })}
          >
            <option value="">없음</option>
            <option value="high">높음</option>
            <option value="medium">보통</option>
            <option value="low">낮음</option>
          </select>
        </div>
      </div>

      {/* memo + url */}
      <div className={groupCls}>
        <textarea
          className={`${fieldCls} w-full resize-none text-[13px] text-ink py-xs px-xxs min-h-[52px] placeholder:text-muted-soft`}
          placeholder="메모 추가"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          onBlur={() => commit('memo', memo)}
        />
        <div className={`${rowCls} border-t border-hairline`}>
          <input
            className={`${fieldCls} flex-1 min-w-0 text-[13px] text-ink py-xxs px-xxs placeholder:text-muted-soft`}
            placeholder="URL 추가"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => commit('url', url)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
          {/^https?:\/\//i.test(task.url ?? '') && (
            <a className="text-muted text-[13px] no-underline hover:text-ink" href={task.url!} target="_blank" rel="noopener noreferrer" title="새 탭에서 열기">↗</a>
          )}
        </div>
      </div>

      <div className="px-xxs">
        <button className="text-error text-xs cursor-pointer bg-transparent border-none py-xxs px-0 hover:underline" onClick={() => setConfirmingDelete(true)}>작업 삭제</button>
      </div>

      {/* same confirm dialog pattern as WbsTree */}
      {confirmingDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]" onClick={() => setConfirmingDelete(false)}>
          <div className="bg-canvas rounded-lg p-lg flex flex-col gap-sm w-[300px] shadow-lg" onClick={(e) => e.stopPropagation()}>
            <span className="text-[15px] font-semibold text-ink">작업 삭제</span>
            <p className="text-[13px] text-muted m-0">&lsquo;{task.name}&rsquo; 작업을 삭제합니다. 계속하시겠습니까?</p>
            <div className="flex gap-xs justify-end mt-xs">
              <button className="text-[13px] px-md py-[7px] rounded-md border border-hairline bg-transparent cursor-pointer text-muted" onClick={() => setConfirmingDelete(false)}>
                취소
              </button>
              <button className="text-[13px] px-md py-[7px] rounded-md bg-error text-on-primary cursor-pointer border-none" onClick={onDelete}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
