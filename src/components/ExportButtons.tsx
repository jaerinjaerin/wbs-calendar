'use client';

import { useState } from 'react';
import type { RefObject } from 'react';
import type { Task, WbsNode, User } from '@/types';
import type { CalendarViewHandle } from './CalendarView';
import { useToast } from './Toast';

interface ExportButtonsProps {
  tasks: Task[];
  wbsNodes: WbsNode[];
  users: User[];
  calendarRef: RefObject<CalendarViewHandle>;
  projectName: string;
}

export default function ExportButtons({ tasks, wbsNodes, projectName }: ExportButtonsProps) {
  const [busy, setBusy] = useState(false);
  const { showToast, toastNode } = useToast();
  const nodeIds = new Set(wbsNodes.map((n) => n.id));
  const empty = !tasks.some((t) => nodeIds.has(t.wbs_node_id));

  async function handleExport() {
    setBusy(true);
    try {
      // dynamic import keeps exceljs out of the main bundle
      const { buildLayout, renderWorkbook, exportFileName } = await import('@/lib/scheduleExport');
      const today = new Date();
      const buffer = await renderWorkbook(buildLayout(tasks, wbsNodes), projectName, today).xlsx.writeBuffer();
      const url = URL.createObjectURL(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName(projectName, today);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error(e);
      showToast({ message: '엑셀 내보내기에 실패했습니다' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="px-2.5 md:px-3.5 py-1.5 rounded-md text-micro md:text-xs font-medium border border-white/10 bg-white/[0.08] text-on-dark cursor-pointer disabled:opacity-40 disabled:cursor-default"
        disabled={empty || busy}
        title={empty ? '내보낼 작업이 없습니다' : undefined}
        onClick={handleExport}
      >
        {busy ? '내보내는 중…' : '엑셀'}
      </button>
      {toastNode}
    </>
  );
}
