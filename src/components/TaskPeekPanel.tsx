'use client';

import type { Task, WbsNode, User } from '@/types';

interface TaskPeekPanelProps {
  task: Task;
  wbsNodes: WbsNode[];
  users: User[];
  onUpdate: (changes: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
}

// ponytail: stub — full implementation lands in Task 6
export default function TaskPeekPanel(_props: TaskPeekPanelProps) {
  return null;
}
