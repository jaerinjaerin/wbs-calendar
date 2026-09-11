'use client';

import { useState } from 'react';
import type { Task, WbsNode, User, TaskStatus } from '@/types';
import styles from './TaskModal.module.css';

interface TaskModalProps {
  wbsNodes: WbsNode[];
  users: User[];
  defaultDate: string | null;
  task?: Task;
  onSave: (task: Omit<Task, 'id'> & { id?: string }) => void;
  onClose: () => void;
}

export default function TaskModal({ wbsNodes, users, defaultDate, task, onSave, onClose }: TaskModalProps) {
  const [name, setName] = useState(task?.name ?? '');
  const [startDate, setStartDate] = useState(task?.start_date ?? defaultDate ?? '');
  const [endDate, setEndDate] = useState(task?.end_date ?? defaultDate ?? '');
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo');
  const [wbsNodeId, setWbsNodeId] = useState(task?.wbs_node_id ?? wbsNodes[0]?.id ?? '');

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
    <div className={styles.overlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.title}>{task ? '작업 수정' : '작업 추가'}</h2>

        <label className={styles.field}>
          <span className={styles.label}>작업명</span>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>WBS 노드</span>
          <select className={styles.input} value={wbsNodeId} onChange={(e) => setWbsNodeId(e.target.value)} required>
            {wbsNodes.map((n) => (
              <option key={n.id} value={n.id}>{'—'.repeat(n.depth)} {n.name}</option>
            ))}
          </select>
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>시작일</span>
            <input className={styles.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>종료일</span>
            <input className={styles.input} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>담당자</span>
            <select className={styles.input} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">미지정</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>상태</span>
            <select className={styles.input} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              <option value="todo">예정</option>
              <option value="in_progress">진행중</option>
              <option value="done">완료</option>
            </select>
          </label>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>취소</button>
          <button type="submit" className={styles.saveBtn}>저장</button>
        </div>
      </form>
    </div>
  );
}
