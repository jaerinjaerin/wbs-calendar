'use client';

import { useMemo, useState } from 'react';
import type { Task, WbsNode, User, TaskStatus } from '@/types';
import { flattenHierarchical } from '@/lib/wbs';

interface TaskModalProps {
  wbsNodes: WbsNode[];
  users: User[];
  defaultDate: string | null;
  task?: Task;
  onSave: (task: Omit<Task, 'id'> & { id?: string }) => void;
  onClose: () => void;
}

const fieldInputCls = 'py-2 px-2.5 border border-hairline rounded-sm text-[13px] font-sans outline-none focus:border-primary';

export default function TaskModal({ wbsNodes, users, defaultDate, task, onSave, onClose }: TaskModalProps) {
  const [name, setName] = useState(task?.name ?? '');
  const [startDate, setStartDate] = useState(task?.start_date ?? defaultDate ?? '');
  const [endDate, setEndDate] = useState(task?.end_date ?? defaultDate ?? '');
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo');
  const sortedNodes = useMemo(() => flattenHierarchical(wbsNodes), [wbsNodes]);
  const [wbsNodeId, setWbsNodeId] = useState(task?.wbs_node_id ?? sortedNodes[0]?.id ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate || !wbsNodeId) return;
    onSave({
      ...(task?.id ? { id: task.id } : {}),
      name: name.trim(),
      start_date: startDate,
      end_date: endDate,
      assignee_id: assigneeId || null,
      status,
      wbs_node_id: wbsNodeId,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]" onClick={onClose}>
      <form className="bg-canvas rounded-lg p-5 md:p-7 w-[calc(100%-32px)] md:w-auto md:min-w-[420px] md:max-w-[500px] shadow-[0_8px_32px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className="text-title-sm mb-5">{task ? '작업 수정' : '작업 추가'}</h2>

        <label className="flex flex-col gap-xxs mb-3.5">
          <span className="text-xs font-medium text-muted">작업명</span>
          <input className={fieldInputCls} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>

        <label className="flex flex-col gap-xxs mb-3.5">
          <span className="text-xs font-medium text-muted">WBS 노드</span>
          <select className={fieldInputCls} value={wbsNodeId} onChange={(e) => setWbsNodeId(e.target.value)} required>
            {sortedNodes.map((n) => (
              <option key={n.id} value={n.id}>{'—'.repeat(n.depth)} {n.name}</option>
            ))}
          </select>
        </label>

        <div className="flex gap-sm max-md:flex-col max-md:gap-0">
          <label className="flex flex-col gap-xxs mb-3.5 flex-1">
            <span className="text-xs font-medium text-muted">시작일</span>
            <input className={fieldInputCls} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-xxs mb-3.5 flex-1">
            <span className="text-xs font-medium text-muted">종료일</span>
            <input className={fieldInputCls} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </label>
        </div>

        <div className="flex gap-sm max-md:flex-col max-md:gap-0">
          <label className="flex flex-col gap-xxs mb-3.5 flex-1">
            <span className="text-xs font-medium text-muted">담당자</span>
            <select className={fieldInputCls} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">미지정</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-xxs mb-3.5 flex-1">
            <span className="text-xs font-medium text-muted">상태</span>
            <select className={fieldInputCls} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              <option value="todo">예정</option>
              <option value="in_progress">진행중</option>
              <option value="done">완료</option>
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-xs mt-5">
          <button type="button" className="py-xs px-4.5 border border-hairline rounded-sm bg-canvas text-[13px] cursor-pointer" onClick={onClose}>취소</button>
          <button type="submit" className="py-xs px-4.5 border-none rounded-sm bg-primary text-on-primary text-[13px] font-medium cursor-pointer">저장</button>
        </div>
      </form>
    </div>
  );
}
