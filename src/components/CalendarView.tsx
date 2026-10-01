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
  onClickEvent: (taskId: string, rect: DOMRect) => void;
  onUpdateTask: (taskId: string, changes: Partial<Task>) => void;
  onSelectDateRange: (start: string, end: string) => void;
  onAddTask: () => void;
}

export interface CalendarViewHandle {
  getContainerEl: () => HTMLElement | null;
  getInstance: () => any;
}

// ponytail: calendars prop lets the library own color mapping per calendarId
function toCalendarInfos(wbsNodes: WbsNode[]) {
  return wbsNodes.map((n) => {
    const c = n.color ?? '#3563e9';
    return {
      id: n.id,
      name: n.name,
      backgroundColor: c + '20',
      borderColor: c,
      color: '#333',
    };
  });
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
  function CalendarView({ tasks, wbsNodes, users, onClickEvent, onUpdateTask, onSelectDateRange, onAddTask }, ref) {
    const calRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
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
    }, [CalendarComp]);

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
        <div className="bg-canvas border-b border-hairline px-3 md:px-5">
          <div className="flex items-center justify-end py-1.5 gap-1">
            <button className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-none bg-transparent hover:bg-surface-card" aria-label="검색">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
            </button>
            <button className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-none bg-transparent hover:bg-surface-card" aria-label="작업 추가" onClick={onAddTask}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
          <div className="flex items-center justify-between pb-2.5">
            <span className="text-lg md:text-xl font-bold tracking-tight">{dateLabel}</span>
            <div className="flex items-center gap-1">
              <button className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer border-none bg-transparent text-muted hover:bg-surface-card" onClick={() => navigate('prev')}>‹</button>
              <button className="text-[13px] px-3.5 py-1 rounded-full border border-hairline bg-canvas cursor-pointer font-medium hover:bg-surface-card" onClick={() => navigate('today')}>오늘</button>
              <button className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer border-none bg-transparent text-muted hover:bg-surface-card" onClick={() => navigate('next')}>›</button>
            </div>
          </div>
        </div>
        <div ref={containerRef} className="flex-1 overflow-auto p-2 md:p-4 md:px-5">
          {CalendarComp && (
            <CalendarComp
              ref={calRef}
              height="100%"
              view="month"
              calendars={calendars}
              events={events}
              month={{ startDayOfWeek: 0, isAlways6Weeks: false }}
              week={{ startDayOfWeek: 0 }}
              usageStatistics={false}
              useDetailPopup={false}
              useFormPopup={false}
              gridSelection={true}
              onClickEvent={(e: any) => {
                const block = containerRef.current?.querySelector(`[data-event-id="${e.event.id}"]`);
                const bar = block?.querySelector('.toastui-calendar-weekday-event') ?? block;
                const rect = bar?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
                onClickEvent(e.event.id, rect);
              }}
              onSelectDateTime={(e: any) => {
                const toLocal = (v: any) => {
                  const d = v.toDate ? v.toDate() : new Date(v);
                  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                };
                // ponytail: TUI month view returns same cell for click, last cell for drag — both inclusive
                onSelectDateRange(toLocal(e.start), toLocal(e.end));
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
