'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loadProjectData, createTask, updateTask, deleteTask, updateWbsNode } from '@/app/actions';
import { subtreeIds } from '@/lib/wbs';
import { errorMessage } from '@/lib/actionResult';
import WbsTree from '@/components/WbsTree';
import CalendarView from '@/components/CalendarView';
import type { CalendarViewHandle } from '@/components/CalendarView';
import ExportButtons from '@/components/ExportButtons';
import TaskModal from '@/components/TaskModal';
import TaskPeekPanel from '@/components/TaskPeekPanel';
import { useToast } from '@/components/Toast';
import { useIsMobile } from '@/lib/useIsMobile';
import { dayLabel } from '@/lib/mobileDrag';
import type { DayRange } from '@/lib/monthStack';
import type { Task, WbsNode, User, ProjectSummary } from '@/types';

interface ProjectCalendarProps {
  project: ProjectSummary;
  initial: { tasks: Task[]; wbsNodes: WbsNode[]; users: User[] };
}

// Initial data comes from the server page; this only refetches after edits.
export default function ProjectCalendar({ project, initial }: ProjectCalendarProps) {
  const router = useRouter();
  const calendarRef = useRef<CalendarViewHandle>(null);
  const { id: projectId, name: projectName } = project;
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [wbsNodes, setWbsNodes] = useState<WbsNode[]>(initial.wbsNodes);
  const [users, setUsers] = useState<User[]>(initial.users);
  // store unchecked ids so new nodes show by default
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultStart, setModalDefaultStart] = useState<string | null>(null);
  const [modalDefaultEnd, setModalDefaultEnd] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [popoverRect, setPopoverRect] = useState<DOMRect | null>(null);
  const { showToast, hideToast, toastNode } = useToast();
  const mobile = useIsMobile();

  const loadData = useCallback(async (pid: string) => {
    const { data, error } = await loadProjectData(pid);
    if (!data) {
      console.error(error);
      showToast({ message: errorMessage(error, '데이터를 불러오지 못했습니다') });
      return;
    }
    setTasks(data.tasks);
    setWbsNodes(data.wbsNodes);
    setUsers(data.users);
    // showToast only touches state setters and a ref, so it's safe to leave out of deps
  }, []);

  function filteredTasks(): Task[] {
    if (hiddenIds.size === 0) return tasks;
    return tasks.filter((t) => !hiddenIds.has(t.wbs_node_id));
  }

  // toggling a node applies the same state to its whole subtree
  function toggleNode(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      const hide = !prev.has(id);
      (function apply(nodeId: string) {
        hide ? next.add(nodeId) : next.delete(nodeId);
        wbsNodes.filter((n) => n.parent_id === nodeId).forEach((n) => apply(n.id));
      })(id);
      return next;
    });
  }

  async function handleUpdateTask(taskId: string, changes: Partial<Task>) {
    const { error } = await updateTask(taskId, changes);
    if (error) {
      console.error(error);
      showToast({ message: errorMessage(error, '작업 수정에 실패했습니다') });
    }
    // reload either way: on failure this snaps a dragged bar back to its saved dates
    if (projectId) await loadData(projectId);
  }

  // optimistic: show immediately, roll back on failure. Client-side id makes retries idempotent (PK conflict).
  async function insertTask(task: Task) {
    setTasks((prev) => [...prev, task]);
    const { error } = await createTask(task);
    // 23505 = unique violation: an earlier attempt already landed, so treat as success
    if (error && error.code !== '23505') {
      console.error(error);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      showToast({ message: errorMessage(error, '작업 추가에 실패했습니다'), onRetry: () => { hideToast(); insertTask(task); } });
      return;
    }
    if (projectId) await loadData(projectId);
  }

  // optimistic; no reload on success since only these node fields changed (keeps the serial action queue free)
  async function handleUpdateWbsNode(id: string, changes: { name?: string; color?: string }) {
    const prev = wbsNodes;
    const colorIds = changes.color ? new Set(subtreeIds(prev, id)) : new Set<string>();
    setWbsNodes(prev.map((n) => ({
      ...n,
      ...(n.id === id && changes.name ? { name: changes.name } : {}),
      ...(colorIds.has(n.id) ? { color: changes.color! } : {}),
    })));
    const { error } = await updateWbsNode(projectId, id, changes);
    if (error) {
      console.error(error);
      setWbsNodes(prev);
      showToast({ message: errorMessage(error, '분류 수정에 실패했습니다'), onRetry: () => { hideToast(); handleUpdateWbsNode(id, changes); } });
      await loadData(projectId);
    }
  }

  // mobile long-press drop: save once, offer undo with the same update path
  function handleMoveTask(taskId: string, next: DayRange, prev: DayRange) {
    const name = tasks.find((t) => t.id === taskId)?.name ?? '작업';
    handleUpdateTask(taskId, { start_date: next.start, end_date: next.end });
    showToast({
      message: `'${name}' ${dayLabel(next.start)}로 이동`,
      actionLabel: '되돌리기',
      onRetry: () => { hideToast(); handleUpdateTask(taskId, { start_date: prev.start, end_date: prev.end }); },
    });
  }

  function openAddFor(date: string) {
    setModalDefaultStart(date); setModalDefaultEnd(date); setModalOpen(true);
  }

  function handleSaveTask(input: Omit<Task, 'id'>) {
    setModalOpen(false);
    insertTask({ ...input, id: crypto.randomUUID() });
  }

  // optimistic like insertTask; delete by id is idempotent so retry is safe
  async function handleDeleteTask(task: Task) {
    setSelectedTaskId(null);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const { error } = await deleteTask(task.id);
    if (error) {
      console.error(error);
      setTasks((prev) => [...prev, task]);
      showToast({ message: errorMessage(error, '작업 삭제에 실패했습니다'), onRetry: () => { hideToast(); handleDeleteTask(task); } });
      return;
    }
    if (projectId) await loadData(projectId);
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <header className="flex items-center justify-between px-3 h-12 md:px-5 md:h-14 bg-surface-dark shrink-0">
        <div className="flex items-center gap-xs md:gap-sm">
          <button className="bg-transparent border-none text-on-dark text-body-md cursor-pointer px-xs py-xxs rounded-md hover:bg-surface-dark-elevated" onClick={() => router.push('/')} aria-label="프로젝트 목록">←</button>
          <span className="font-display text-body-xs md:text-title-sm text-on-dark">WBS 캘린더</span>
          <span className="text-on-dark-soft text-caption font-medium max-w-[100px] md:max-w-none truncate max-[480px]:hidden">{projectName}</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-xs">
          <ExportButtons tasks={filteredTasks()} wbsNodes={wbsNodes} users={users} calendarRef={calendarRef} projectName={projectName} />
          <button className="px-2.5 md:px-3.5 py-1.5 rounded-md text-micro md:text-body-xs font-medium border-none bg-surface-dark-elevated hover:bg-primary-active text-on-dark cursor-pointer" onClick={() => router.push(`/settings?project=${projectId}`)}>
            설정
          </button>
          <button className="flex md:hidden w-9 h-9 rounded-md border border-white/10 bg-white/[0.08] text-on-dark text-lg cursor-pointer items-center justify-center" onClick={() => setSidebarOpen((v) => !v)} aria-label="WBS 메뉴">
            ☰
          </button>
        </div>
      </header>

      {sidebarOpen && <div className="block md:hidden fixed inset-0 top-12 bg-black/30 z-[39]" onClick={() => setSidebarOpen(false)} />}
      <div className="flex flex-1 overflow-hidden">
        <div className={`block fixed top-12 left-0 bottom-0 w-[280px] z-40 transition-transform duration-[250ms] md:contents ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <WbsTree
            projectId={projectId}
            wbsNodes={wbsNodes}
            tasks={tasks}
            hiddenIds={hiddenIds}
            onToggleNode={toggleNode}
            onDataChange={() => loadData(projectId)}
            onUpdateNode={handleUpdateWbsNode}
          />
        </div>
        <CalendarView
          ref={calendarRef}
          tasks={filteredTasks()}
          wbsNodes={wbsNodes}
          users={users}
          onClickEvent={(id, rect) => { setSelectedTaskId(id); setPopoverRect(rect); }}
          onUpdateTask={handleUpdateTask}
          onSelectDateRange={(start, end) => {
            if (selectedTaskId) { setSelectedTaskId(null); return; }
            setModalDefaultStart(start); setModalDefaultEnd(end); setModalOpen(true);
          }}
          onAddTask={() => { setModalDefaultStart(null); setModalDefaultEnd(null); setModalOpen(true); }}
          onMoveTask={handleMoveTask}
          onPickDate={openAddFor}
        />
      </div>

      {modalOpen && (
        <TaskModal
          wbsNodes={wbsNodes}
          users={users}
          defaultStart={modalDefaultStart}
          defaultEnd={modalDefaultEnd}
          onSave={handleSaveTask}
          onClose={() => setModalOpen(false)}
        />
      )}

      {selectedTask && (
        <>
        {!mobile && <div className="fixed inset-0 z-40" onClick={() => setSelectedTaskId(null)} />}
        <TaskPeekPanel
          key={selectedTask.id}
          task={selectedTask}
          wbsNodes={wbsNodes}
          users={users}
          anchorRect={popoverRect}
          onUpdate={(changes) => handleUpdateTask(selectedTask.id, changes)}
          onDelete={() => handleDeleteTask(selectedTask)}
          onClose={() => setSelectedTaskId(null)}
        />
        </>
      )}

      {toastNode}
    </div>
  );
}
