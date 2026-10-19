'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { DayRange } from '@/lib/monthStack';
import { cellAtPoint, moveRange, daysBetween, dayLabel } from '@/lib/mobileDrag';

const HOLD_MS = 450;
const SLOP = 10;
const NEW_EVENT_ID = '__new';
export const NEW_CALENDAR_ID = '_new';
const ROW_SEL = '.toastui-calendar-month-week-item';
const BLOCK_SEL = '.toastui-calendar-weekday-event-block';

export interface LongPressOptions {
  enabled: boolean;
  containerRef: RefObject<HTMLDivElement>;
  getInstance: () => any;
  weeks: DayRange[];
  getRange: (taskId: string) => DayRange | null;
  onTapTask: (taskId: string, rect: DOMRect) => void;
  onTapDate: (date: string) => void;
  onMoveTask: (taskId: string, next: DayRange, prev: DayRange) => void;
  onDropNew: (date: string) => void;
}

export interface DragOverlay {
  box: { left: number; top: number; width: number; height: number } | null;
  hint: string;
}

interface Drag {
  el: HTMLElement;      // element first touched; touch events keep targeting it even after a re-render detaches it
  x0: number;
  y0: number;
  startDate: string;
  taskId: string | null; // null = empty cell (or holiday) → new task
  calendarId: string | null;
  orig: DayRange | null;
  timer: ReturnType<typeof setTimeout>;
  lifted: boolean;
  over: string | null;
  style?: HTMLStyleElement;
}

// Mobile-only replacement for Toast UI's mouse drag. See spec 3.3 for the three touch rules this relies on.
export function useLongPressDrag(opts: LongPressOptions): DragOverlay | null {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [overlay, setOverlay] = useState<DragOverlay | null>(null);
  const { enabled, containerRef } = opts;

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;
    let drag: Drag | null = null;

    const inst = () => optsRef.current.getInstance();
    const rows = () => Array.from(container.querySelectorAll(ROW_SEL)).map((r) => r.getBoundingClientRect());
    const cellAt = (x: number, y: number) => cellAtPoint(x, y, rows(), optsRef.current.weeks, container.getBoundingClientRect());

    function boxOf(rowIndex: number, col: number) {
      const r = rows()[rowIndex];
      const c = container!.getBoundingClientRect();
      const w = r.width / 7;
      return { left: r.left - c.left + container!.scrollLeft + w * col, top: r.top - c.top + container!.scrollTop, width: w, height: r.height };
    }

    function hintFor(d: Drag, over: string) {
      if (!d.taskId) return `${dayLabel(over)}에 추가`;
      const n = daysBetween(d.startDate, over);
      return `${dayLabel(over)} · ${n === 0 ? '그대로' : `${n > 0 ? '+' : ''}${n}일`}`;
    }

    function haptic(inGesture: boolean) {
      try { if (navigator.vibrate?.(15)) return; } catch {}
      // iOS has no vibrate; the switch-input trick only works inside a real user gesture (touchend)
      if (inGesture) document.getElementById('haptic-switch')?.click();
    }

    // put the preview back where it started
    function revert(d: Drag) {
      if (d.taskId && d.orig) inst()?.updateEvent(d.taskId, d.calendarId, d.orig);
      else inst()?.deleteEvent(NEW_EVENT_ID, NEW_CALENDAR_ID);
    }

    function release(d: Drag) {
      clearTimeout(d.timer);
      d.style?.remove();
      d.el.removeEventListener('touchmove', onMove);
      d.el.removeEventListener('touchend', onEnd);
      d.el.removeEventListener('touchcancel', onCancel);
      drag = null;
      setOverlay(null);
    }

    function lift() {
      const d = drag;
      if (!d) return;
      d.lifted = true;
      haptic(false);
      const id = d.taskId ?? NEW_EVENT_ID;
      // a <style> survives Toast UI re-rendering the blocks, unlike classes set on them
      d.style = document.createElement('style');
      d.style.textContent =
        `${BLOCK_SEL}:not([data-event-id="${id}"]){opacity:.35}` +
        `${BLOCK_SEL}[data-event-id="${id}"]{z-index:5;filter:drop-shadow(0 4px 8px rgba(0,0,0,.25))}`;
      document.head.appendChild(d.style);
      if (!d.taskId) {
        inst()?.createEvents([{ id: NEW_EVENT_ID, calendarId: NEW_CALENDAR_ID, title: '+ 새로운 작업', start: d.startDate, end: d.startDate, category: 'allday' }]);
      }
      hover(d.x0, d.y0);
    }

    function hover(x: number, y: number) {
      const d = drag!;
      const cell = cellAt(x, y);
      if (!cell) {
        // outside the grid: dropping here changes nothing
        if (d.over !== null) {
          d.over = null;
          if (d.taskId && d.orig) inst()?.updateEvent(d.taskId, d.calendarId, d.orig);
        }
        setOverlay({ box: null, hint: '날짜 위로 옮기세요' });
        return;
      }
      if (cell.date === d.over) return;
      d.over = cell.date;
      if (d.taskId && d.orig) inst()?.updateEvent(d.taskId, d.calendarId, moveRange(d.orig, d.startDate, cell.date));
      else inst()?.updateEvent(NEW_EVENT_ID, NEW_CALENDAR_ID, { start: cell.date, end: cell.date });
      setOverlay({ box: boxOf(cell.rowIndex, cell.col), hint: hintFor(d, cell.date) });
    }

    function onStart(e: TouchEvent) {
      if (drag) { onCancel(); return; } // second finger
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const cell = cellAt(t.clientX, t.clientY);
      if (!cell) return;
      const el = e.target as HTMLElement; // HTMLElement carries the touch event typings
      const block = el.closest<HTMLElement>(BLOCK_SEL);
      const calendarId = block?.dataset.calendarId ?? null;
      const taskId = block && calendarId !== '_holiday' && calendarId !== NEW_CALENDAR_ID ? block.dataset.eventId ?? null : null;
      drag = {
        el, x0: t.clientX, y0: t.clientY, startDate: cell.date,
        taskId, calendarId, orig: taskId ? optsRef.current.getRange(taskId) : null,
        timer: setTimeout(lift, HOLD_MS), lifted: false, over: null,
      };
      el.addEventListener('touchmove', onMove, { passive: false });
      el.addEventListener('touchend', onEnd, { passive: false });
      el.addEventListener('touchcancel', onCancel);
    }

    function onMove(e: TouchEvent) {
      const d = drag;
      if (!d) return;
      const t = e.touches[0];
      if (!d.lifted) {
        if (Math.hypot(t.clientX - d.x0, t.clientY - d.y0) > SLOP) release(d); // it's a scroll
        return;
      }
      e.preventDefault();
      hover(t.clientX, t.clientY);
    }

    function onEnd(e: TouchEvent) {
      const d = drag;
      if (!d) return;
      e.preventDefault(); // no synthetic mouse events → Toast UI's own click handling never fires
      release(d);
      const o = optsRef.current;
      if (!d.lifted) {
        if (d.taskId) {
          const bar = d.el.closest(BLOCK_SEL)?.querySelector('.toastui-calendar-weekday-event') ?? d.el;
          o.onTapTask(d.taskId, bar.getBoundingClientRect());
        } else {
          o.onTapDate(d.startDate);
        }
        return;
      }
      if (d.taskId && d.orig) {
        const next = d.over ? moveRange(d.orig, d.startDate, d.over) : d.orig;
        if (next.start === d.orig.start) { revert(d); return; }
        haptic(true);
        o.onMoveTask(d.taskId, next, d.orig);
      } else {
        inst()?.deleteEvent(NEW_EVENT_ID, NEW_CALENDAR_ID);
        if (d.over) { haptic(true); o.onDropNew(d.over); }
      }
    }

    function onCancel() {
      const d = drag;
      if (!d) return;
      release(d);
      if (d.lifted) revert(d);
    }

    // Registered up front: browsers decide at touchstart whether touchmove is cancelable,
    // so a listener added mid-gesture can't stop the scroll (empty-cell drags rely on this).
    const blockScroll = (e: TouchEvent) => { if (drag?.lifted) e.preventDefault(); };
    const noMenu = (e: Event) => e.preventDefault();

    container.addEventListener('touchstart', onStart, { passive: true });
    container.addEventListener('contextmenu', noMenu);
    document.addEventListener('touchmove', blockScroll, { passive: false });
    return () => {
      onCancel();
      container.removeEventListener('touchstart', onStart);
      container.removeEventListener('contextmenu', noMenu);
      document.removeEventListener('touchmove', blockScroll);
    };
  }, [enabled, containerRef]);

  return overlay;
}
