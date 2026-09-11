'use client';

import type { Task, WbsNode, User, TaskStatus } from '@/types';
import styles from './TaskPeekPanel.module.css';

interface TaskPeekPanelProps {
  task: Task;
  wbsNodes: WbsNode[];
  users: User[];
  onUpdate: (changes: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function TaskPeekPanel({ task, wbsNodes, users, onUpdate, onDelete, onClose }: TaskPeekPanelProps) {
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
    <div className={styles.panel}>
      <button className={styles.close} onClick={onClose}>✕</button>
      <div className={styles.breadcrumb}>{getBreadcrumb()}</div>
      <h2 className={styles.title}>{task.name}</h2>
      <div className={styles.meta}>
        <div className={styles.row}>
          <span className={styles.label}>상태</span>
          <select
            className={`${styles.status} ${styles[task.status]}`}
            value={task.status}
            onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })}
          >
            <option value="todo">예정</option>
            <option value="in_progress">진행중</option>
            <option value="done">완료</option>
          </select>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>기간</span>
          <span className={styles.value}>{task.start_date} → {task.end_date}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>담당자</span>
          <span className={styles.value}>{assignee?.name ?? '미지정'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Phase</span>
          <span className={styles.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: node?.color ?? '#ccc' }} />
            {node?.name ?? ''}
          </span>
        </div>
      </div>
      <button className={styles.deleteBtn} onClick={onDelete}>작업 삭제</button>
    </div>
  );
}
