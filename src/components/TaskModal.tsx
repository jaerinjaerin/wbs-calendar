'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import type { Task, WbsNode, User, TaskStatus, TaskPriority } from '@/types';
import { flattenHierarchical } from '@/lib/wbs';
import WbsSelect from './WbsSelect';
import { groupCls, rowCls, labelCls, fieldCls, selectCls, statusCls, priorityCls } from './TaskPeekPanel';
import { primaryBtn, secondaryBtn, modalOverlay } from '@/lib/styles';

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
  const [isMilestone, setIsMilestone] = useState(false);
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
      is_milestone: isMilestone,
    });
  }

  return (
    <div className={modalOverlay} onClick={onClose}>
      <form
        className="w-[calc(100%-32px)] max-w-[460px] bg-canvas rounded-lg shadow-card p-md flex flex-col gap-sm"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        {/* title + period */}
        <div className={`${groupCls} flex gap-sm`}>
          <span className="w-1 rounded-xs my-xs shrink-0" style={{ background: color }} />
          <div className="flex-1 min-w-0 flex flex-col pb-xxs">
            <input
              className={`${fieldCls} text-body-md font-semibold text-ink py-xs px-xxs w-full placeholder:text-muted-soft`}
              placeholder="새로운 작업"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            <label className={`${rowCls} cursor-pointer`}>
              <span className={labelCls}>주요일정</span>
              <input type="checkbox" className="ml-auto mr-xxs accent-ink cursor-pointer" checked={isMilestone} onChange={(e) => setIsMilestone(e.target.checked)} />
            </label>
            <div className={rowCls}>
              <span className={labelCls}>시작</span>
              <input type="date" className={`${fieldCls} ml-auto text-body-xs px-xxs`} value={startDate} onChange={(e) => changeStart(e.target.value)} required />
            </div>
            <div className={rowCls}>
              <span className={labelCls}>종료</span>
              <input type="date" className={`${fieldCls} ml-auto text-body-xs px-xxs`} value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
        </div>

        {/* attributes */}
        <div className={groupCls}>
          <div className={rowCls}>
            <WbsSelect nodes={wbsNodes} value={wbsNodeId} onChange={setWbsNodeId} />
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
              <option value="in_progress">진행 중</option>
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
            className={`${fieldCls} w-full resize-none text-body-xs text-ink py-xs px-xxs min-h-[52px] placeholder:text-muted-soft`}
            placeholder="메모 추가"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <div className={`${rowCls} border-t border-hairline`}>
            <input
              className={`${fieldCls} flex-1 min-w-0 text-body-xs text-ink py-xxs px-xxs placeholder:text-muted-soft`}
              placeholder="URL 추가"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-xs">
          <button type="button" className={secondaryBtn} onClick={onClose}>취소</button>
          <button type="submit" className={primaryBtn}>추가</button>
        </div>
      </form>
    </div>
  );
}
