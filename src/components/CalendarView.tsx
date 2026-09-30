'use client';

import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import type { ComponentType } from 'react';
import '@toast-ui/calendar/dist/toastui-calendar.min.css';
import type { Task, WbsNode, User } from '@/types';
import { getHolidays } from '@/lib/holidays';

function pad(n: number) { return n.toString().padStart(2, '0'); }

interface CalendarViewProps {
  tasks: Task[];
  wbsNodes: WbsNode[];
  users: User[];
  onClickEvent: (taskId: string) => void;
  onUpdateTask: (taskId: string, changes: Partial<Task>) => void;
  onSelectDateRange: (start: string, end: string) => void;
}

export interface CalendarViewHandle {
  getContainerEl: () => HTMLElement | null;
  getInstance: () => any;
}

// ponytail: calendars prop lets the library own color mapping per calendarId
function toCalendarInfos(wbsNodes: WbsNode[]) {
  return wbsNodes.map((n) => ({
    id: n.id,
    name: n.name,
    backgroundColor: n.color ?? '#3563e9',
    borderColor: n.color ?? '#3563e9',
  }));
}

function toCalendarEvents(tasks: Task[], users: User[]) {
  const userMap = new Map(users.map((u) => [u.id, u]));

  return tasks.map((task) => {
    const assignee = task.assignee_id ? userMap.get(task.assignee_id) : null;
    return {
      id: task.id,
      calendarId: task.wbs_node_id,
      title: task.name,
      start: task.start_date,
      end: task.end_date,
      category: 'allday' as const,
      body: assignee?.name ?? '',
    };
  });
}

const CalendarView = forwardRef<CalendarViewHandle, CalendarViewProps>(
  function CalendarView({ tasks, wbsNodes, users, onClickEvent, onUpdateTask, onSelectDateRange }, ref) {
    const calRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [view, setView] = useState<'month' | 'week'>('month');
    const [dateLabel, setDateLabel] = useState('');
    // ponytail: @toast-ui/calendar reads `window` at module-eval time, which
    // crashes Next's SSR/prerender pass. Loading it lazily in an effect keeps
    // it out of the server bundle's eval path without routing it through
    // next/dynamic, whose LoadableComponent swallows the ref (see CalendarView
    // usage in page.tsx — calendarRef must reach the real instance).
    const [CalendarComp, setCalendarComp] = useState<ComponentType<any> | null>(null);

    useEffect(() => {
      import('@toast-ui/react-calendar').then((mod) => setCalendarComp(() => mod.default));
    }, []);

    useImperativeHandle(ref, () => ({
      getContainerEl: () => containerRef.current,
      getInstance: () => calRef.current?.getInstance?.(),
    }));

    function updateDateLabel() {
      const inst = calRef.current?.getInstance?.();
      if (!inst) return;
      const date = inst.getDate();
      const d = date.toDate ? date.toDate() : new Date(date);
      setDateLabel(`${d.getFullYear()}년 ${d.getMonth() + 1}월`);
    }

    useEffect(() => {
      updateDateLabel();
    }, [view, CalendarComp]);

    function navigate(direction: 'prev' | 'next' | 'today') {
      const inst = calRef.current?.getInstance?.();
      if (!inst) return;
      if (direction === 'today') inst.today();
      else if (direction === 'prev') inst.prev();
      else inst.next();
      updateDateLabel();
    }

    const calendars = [
      ...toCalendarInfos(wbsNodes),
      { id: '_holiday', name: '공휴일', backgroundColor: '#fef2f2', borderColor: '#ef4444' },
    ];

    const currentYear = new Date().getFullYear();
    const holidayEvents = [currentYear - 1, currentYear, currentYear + 1].flatMap((y) =>
      getHolidays(y).map((h) => ({
        id: `hol_${h.date}`,
        calendarId: '_holiday',
        title: h.name,
        start: h.date,
        end: h.date,
        category: 'allday' as const,
        isReadOnly: true,
      }))
    );

    const events = [...toCalendarEvents(tasks, users), ...holidayEvents];

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-2 px-3 md:p-sm md:px-5 bg-canvas border-b border-hairline flex-wrap gap-xs">
          <div className="flex items-center gap-xs">
            <button className="w-[30px] h-[30px] rounded-md border border-hairline bg-canvas cursor-pointer text-sm flex items-center justify-center hover:bg-surface-card" onClick={() => navigate('prev')}>‹</button>
            <span className="text-base md:text-title-md min-w-0 md:min-w-[140px]">{dateLabel}</span>
            <button className="w-[30px] h-[30px] rounded-md border border-hairline bg-canvas cursor-pointer text-sm flex items-center justify-center hover:bg-surface-card" onClick={() => navigate('next')}>›</button>
            <button className="text-[11px] md:text-xs px-2 md:px-3 py-1 rounded-md border border-hairline bg-canvas cursor-pointer font-medium" onClick={() => navigate('today')}>오늘</button>
          </div>
          <div className="flex border border-hairline rounded-md overflow-hidden divide-x divide-hairline">
            <button
              className={`px-2.5 md:px-4 py-1.5 text-[11px] md:text-xs font-medium border-none cursor-pointer ${view === 'month' ? 'bg-primary text-on-primary' : 'bg-canvas'}`}
              onClick={() => setView('month')}
            >
              월간
            </button>
            <button
              className={`px-2.5 md:px-4 py-1.5 text-[11px] md:text-xs font-medium border-none cursor-pointer ${view === 'week' ? 'bg-primary text-on-primary' : 'bg-canvas'}`}
              onClick={() => setView('week')}
            >
              주간
            </button>
          </div>
        </div>
        <div ref={containerRef} className="flex-1 overflow-auto p-2 md:p-4 md:px-5">
          {CalendarComp && (
            <CalendarComp
              ref={calRef}
              height="100%"
              view={view}
              calendars={calendars}
              events={events}
              month={{ startDayOfWeek: 0, isAlways6Weeks: false }}
              week={{ startDayOfWeek: 0 }}
              usageStatistics={false}
              useDetailPopup={false}
              useFormPopup={false}
              gridSelection={true}
              onClickEvent={(e: any) => onClickEvent(e.event.id)}
              onSelectDateTime={(e: any) => {
                const toLocal = (v: any) => {
                  const d = v.toDate ? v.toDate() : new Date(v);
                  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                };
                const start = toLocal(e.start);
                const end = toLocal(e.end);
                // ponytail: TUI single-click end = next day (exclusive), drag end = last cell (inclusive)
                const diffDays = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
                const actualEnd = diffDays <= 1 ? start : end;
                onSelectDateRange(start, actualEnd);
                calRef.current?.getInstance?.().clearGridSelections();
              }}
              onBeforeUpdateEvent={(e: any) => {
                const { event, changes } = e;
                // ponytail: updateEvent() gives instant visual feedback; Supabase sync is async
                const inst = calRef.current?.getInstance?.();
                if (inst) {
                  inst.updateEvent(event.id, event.calendarId, changes);
                }
                const toLocal = (v: any) => {
                  const d = v.toDate ? v.toDate() : new Date(v);
                  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                };
                const updates: Partial<Task> = {};
                if (changes.start) {
                  updates.start_date = toLocal(changes.start);
                }
                if (changes.end) {
                  updates.end_date = toLocal(changes.end);
                }
                if (Object.keys(updates).length > 0) {
                  onUpdateTask(event.id, updates);
                }
              }}
            />
          )}
        </div>
      </div>
    );
  }
);

export default CalendarView;
