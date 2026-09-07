'use client';

import type { RefObject } from 'react';
import type { Task, WbsNode, User } from '@/types';
import type { CalendarViewHandle } from './CalendarView';

interface ExportButtonsProps {
  tasks: Task[];
  wbsNodes: WbsNode[];
  users: User[];
  calendarRef: RefObject<CalendarViewHandle>;
}

// ponytail: stub — full implementation lands in Task 7
export default function ExportButtons(_props: ExportButtonsProps) {
  return null;
}
