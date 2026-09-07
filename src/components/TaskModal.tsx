'use client';

import type { Task, WbsNode, User } from '@/types';

interface TaskModalProps {
  wbsNodes: WbsNode[];
  users: User[];
  defaultDate: string | null;
  onSave: (task: Omit<Task, 'id'> & { id?: string }) => void;
  onClose: () => void;
}

// ponytail: stub — full implementation lands in Task 6
export default function TaskModal(_props: TaskModalProps) {
  return null;
}
