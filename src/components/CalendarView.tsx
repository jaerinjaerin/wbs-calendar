'use client';

import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import type { ComponentType } from 'react';
import '@toast-ui/calendar/dist/toastui-calendar.min.css';
import type { Task, WbsNode, User } from '@/types';
import styles from './CalendarView.module.css';

interface CalendarViewProps {
  tasks: Task[];
  wbsNodes: WbsNode[];
  users: User[];
  onClickEvent: (taskId: string) => void;
  onUpdateTask: (taskId: string, changes: Partial<Task>) => void;
  onClickDate: (date: string) => void;
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
  function CalendarView({ tasks, wbsNodes, users, onClickEvent, onUpdateTask, onClickDate }, ref) {
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

    const calendars = toCalendarInfos(wbsNodes);
    const events = toCalendarEvents(tasks, users);

    return (
      <div className={styles.wrapper}>
        <div className={styles.toolbar}>
          <div className={styles.nav}>
            <button className={styles.navBtn} onClick={() => navigate('prev')}>‹</button>
            <span className={styles.month}>{dateLabel}</span>
            <button className={styles.navBtn} onClick={() => navigate('next')}>›</button>
            <button className={styles.todayBtn} onClick={() => navigate('today')}>오늘</button>
          </div>
          <div className={styles.views}>
            <button
              className={`${styles.viewBtn} ${view === 'month' ? styles.active : ''}`}
              onClick={() => setView('month')}
            >
              월간
            </button>
            <button
              className={`${styles.viewBtn} ${view === 'week' ? styles.active : ''}`}
              onClick={() => setView('week')}
            >
              주간
            </button>
          </div>
        </div>
        <div ref={containerRef} className={styles.calendarContainer}>
          {CalendarComp && (
            <CalendarComp
              ref={calRef}
              height="100%"
              view={view}
              calendars={calendars}
              events={events}
              month={{ startDayOfWeek: 1, isAlways6Weeks: false }}
              week={{ startDayOfWeek: 1 }}
              usageStatistics={false}
              useDetailPopup={false}
              useFormPopup={false}
              gridSelection={true}
              onClickEvent={(e: any) => onClickEvent(e.event.id)}
              onSelectDateTime={(e: any) => {
                const d = e.start;
                const date = d.toDate ? d.toDate() : new Date(d);
                onClickDate(date.toISOString().split('T')[0]);
              }}
              onBeforeUpdateEvent={(e: any) => {
                const { event, changes } = e;
                // ponytail: updateEvent() gives instant visual feedback; Supabase sync is async
                const inst = calRef.current?.getInstance?.();
                if (inst) {
                  inst.updateEvent(event.id, event.calendarId, changes);
                }
                const updates: Partial<Task> = {};
                if (changes.start) {
                  const s = changes.start.toDate ? changes.start.toDate() : new Date(changes.start);
                  updates.start_date = s.toISOString().split('T')[0];
                }
                if (changes.end) {
                  const ed = changes.end.toDate ? changes.end.toDate() : new Date(changes.end);
                  updates.end_date = ed.toISOString().split('T')[0];
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
