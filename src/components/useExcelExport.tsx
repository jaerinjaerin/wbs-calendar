'use client';

import { useState } from 'react';
import type { Task, WbsNode } from '@/types';
import { useToast } from './Toast';

// Shared by the header icon (desktop) and the project menu item (mobile).
export function useExcelExport(tasks: Task[], wbsNodes: WbsNode[], projectName: string) {
  const [busy, setBusy] = useState(false);
  const { showToast, toastNode } = useToast();
  const nodeIds = new Set(wbsNodes.map((n) => n.id));
  const empty = !tasks.some((t) => nodeIds.has(t.wbs_node_id));

  async function run() {
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

  return { run, busy, empty, toastNode };
}
