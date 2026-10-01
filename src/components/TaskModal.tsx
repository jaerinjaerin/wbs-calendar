'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import type { Task, WbsNode, User, TaskStatus, TaskPriority } from '@/types';
import { flattenHierarchical } from '@/lib/wbs';
import { groupCls, rowCls, labelCls, fieldCls, selectCls, statusCls, priorityCls } from './TaskPeekPanel';

interface TaskModalProps {
  wbsNodes: WbsNode[];
  users: User[];
  defaultStart: string | null;
  defaultEnd: string | null;
  onSave: (task: Omit<Task, 'id'>) => void;
  onClose: () => void;
}

export default function TaskModal({ wbsNodes, users, defaultStart, defaultEnd, onSave, onClose }: TaskModalProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(defaultStart ?? '');
  const [endDate, setEndDate] = useState(defaultEnd ?? defaultStart ?? '');
  const [assigneeId, setAssigneeId] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [memo, setMemo] = useState('');
  const [url, setUrl] = useState('');
  const sortedNodes = useMemo(() => flattenHierarchical(wbsNodes), [wbsNodes]);
  const [pickedNodeId, setWbsNodeId] = useState('');
  const wbsNodeId = pickedNodeId || sortedNodes[0]?.id || ''; // nodes may arrive after the modal opens
  const submittedRef = useRef(false); // blocks double-click before the modal unmounts

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const color = wbsNodes.find((n) => n.id === wbsNodeId)?.color ?? '#ccc';

  function changeStart(start: string) {
    setStartDate(start);
    if (start && endDate < start) setEndDate(start);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittedRef.current || !name.trim() || !startDate || !endDate || !wbsNodeId) return;
    submittedRef.current = true;
    onSave({
      name: name.trim(),
      start_date: startDate,
      end_date: endDate,
      assignee_id: assigneeId || null,
      status,
      priority: priority || null,
      memo: memo.trim() || null,
      url: url.trim() || null,
      wbs_node_id: wbsNodeId,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]" onClick={onClose}>
      <form
        className="w-[calc(100%-32px)] max-w-[460px] bg-canvas rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-hairline p-md flex flex-col gap-sm"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        {/* title + period */}
        <div className={`${groupCls} flex gap-sm`}>
          <span className="w-1 rounded-xs my-xs shrink-0" style={{ background: color }} />
          <div className="flex-1 min-w-0 flex flex-col pb-xxs">
            <input
              className={`${fieldCls} text-[16px] font-semibold text-ink py-xs px-xxs w-full placeholder:text-muted-soft`}
              placeholder="새로운 작업"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            <div className={rowCls}>
              <span className={labelCls}>시작</span>
              <input type="date" className={`${fieldCls} ml-auto text-[13px] px-xxs`} value={startDate} onChange={(e) => changeStart(e.target.value)} required />
            </div>
            <div className={rowCls}>
              <span className={labelCls}>종료</span>
              <input type="date" className={`${fieldCls} ml-auto text-[13px] px-xxs`} value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
        </div>

        {/* attributes */}
        <div className={groupCls}>
          <div className={rowCls}>
            <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: color }} />
            <select className={`${selectCls} text-ink`} value={wbsNodeId} onChange={(e) => setWbsNodeId(e.target.value)} required>
              {sortedNodes.map((n) => <option key={n.id} value={n.id}>{'　'.repeat(n.depth)}{n.name}</option>)}
            </select>
          </div>
          <div className={rowCls}>
            <span className={labelCls}>담당자</span>
            <select className={`${selectCls} text-ink`} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">미지정</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className={rowCls}>
            <span className={labelCls}>상태</span>
            <select className={`${selectCls} font-medium ${statusCls[status]}`} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              <option value="todo">예정</option>
              <option value="in_progress">진행중</option>
              <option value="done">완료</option>
            </select>
          </div>
          <div className={rowCls}>
            <span className={labelCls}>우선순위</span>
            <select
              className={`${selectCls} font-medium ${priority ? priorityCls[priority] : 'text-muted-soft'}`}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority | '')}
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
          />
          <div className={`${rowCls} border-t border-hairline`}>
            <input
              className={`${fieldCls} flex-1 min-w-0 text-[13px] text-ink py-xxs px-xxs placeholder:text-muted-soft`}
              placeholder="URL 추가"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-xs">
          <button type="button" className="h-8 px-md border border-hairline rounded-md bg-canvas text-[13px] font-semibold cursor-pointer" onClick={onClose}>취소</button>
          <button type="submit" className="h-8 px-md border-none rounded-md bg-primary text-on-primary text-[13px] font-semibold cursor-pointer">추가</button>
        </div>
      </form>
    </div>
  );
}
