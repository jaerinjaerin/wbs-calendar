'use client';

import { useState, useCallback, useRef } from 'react';
import { loadProjectData, createTask, updateTask, deleteTask, updateWbsNode, createWbsNode } from '@/app/actions';
import { subtreeIds, WBS_COLLAPSED_COOKIE } from '@/lib/wbs';
import { errorMessage } from '@/lib/actionResult';
import WbsTree from '@/components/WbsTree';
import CalendarView from '@/components/CalendarView';
import type { CalendarViewHandle } from '@/components/CalendarView';
import ProjectHeader from '@/components/ProjectHeader';
import { pretendard } from '@/app/fonts/pretendard';
import { useExcelExport } from '@/components/useExcelExport';
import TaskModal from '@/components/TaskModal';
import TaskPeekPanel from '@/components/TaskPeekPanel';
import { useToast } from '@/components/Toast';
import { useIsMobile } from '@/lib/useIsMobile';
import { dayLabel } from '@/lib/mobileDrag';
import type { DayRange } from '@/lib/monthStack';
import type { Task, WbsNode, User, ProjectSummary } from '@/types';

interface ProjectCalendarProps {
  project: ProjectSummary;
  projects: ProjectSummary[]; // for the header's project switcher
  initial: { tasks: Task[]; wbsNodes: WbsNode[]; users: User[] };
  initialWbsCollapsed: boolean; // desktop sidebar, from the cookie
}

// Initial data comes from the server page; this only refetches after edits.
export default function ProjectCalendar({ project, projects, initial, initialWbsCollapsed }: ProjectCalendarProps) {
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
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drop-down panel
  const [wbsCollapsed, setWbsCollapsed] = useState(initialWbsCollapsed); // desktop sidebar

  // remembered across reloads (and projects) so the server renders it collapsed from the start
  function toggleWbsCollapsed() {
    const next = !wbsCollapsed;
    setWbsCollapsed(next);
    document.cookie = `${WBS_COLLAPSED_COOKIE}=${next ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
  }
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

  // the task popup's new-category form, then reload so the popup can select it.
  // Same rules as the sidebar: last among its siblings, and a child takes its parent's color.
  async function createNodeFromPopup(name: string, color: string, parentId: string | null): Promise<string | null> {
    const parent = parentId ? wbsNodes.find((n) => n.id === parentId) : undefined;
    const sortOrder = wbsNodes.filter((n) => n.parent_id === (parent?.id ?? null)).length + 1;
    const { data, error } = await createWbsNode({
      project_id: projectId,
      parent_id: parent?.id ?? null,
      name,
      color: parent?.color ?? color,
      depth: parent ? parent.depth + 1 : 0,
      sort_order: sortOrder,
    });
    if (!data) {
      console.error(error);
      showToast({ message: errorMessage(error, '분류 추가에 실패했습니다') });
      return null;
    }
    await loadData(projectId);
    return data.id;
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
  const excel = useExcelExport(filteredTasks(), wbsNodes, projectName);

  return (
    <div className={`flex flex-col h-dvh overflow-hidden ${pretendard.variable}`}>
      <ProjectHeader
        project={project}
        projects={projects}
        excel={excel}
        wbsOpen={mobile ? sidebarOpen : !wbsCollapsed}
        onToggleWbs={() => (mobile ? setSidebarOpen((v) => !v) : toggleWbsCollapsed())}
      />
      {excel.toastNode}

      {sidebarOpen && <div className="block md:hidden fixed inset-0 top-12 bg-black/30 z-[39]" onClick={() => setSidebarOpen(false)} />}
      <div className="flex flex-1 overflow-hidden">
        {/* mobile: drops down from under the header; the outer box clips it while it's tucked away.
            desktop: an in-flow sidebar that is simply removed when collapsed (no width animation,
            which iPad Safari's calendar didn't follow) */}
        <div className="block fixed top-12 inset-x-0 bottom-0 z-40 overflow-hidden pointer-events-none md:pointer-events-auto md:contents">
        <div className={`flex max-h-[70dvh] shadow-card transition-transform duration-[250ms] md:max-h-none md:shadow-none md:translate-y-0 md:w-[280px] md:shrink-0 ${sidebarOpen ? 'translate-y-0 pointer-events-auto' : '-translate-y-full'} ${wbsCollapsed ? 'md:hidden' : ''}`}>
          <WbsTree
            projectId={projectId}
            wbsNodes={wbsNodes}
            tasks={tasks}
            hiddenIds={hiddenIds}
            onToggleNode={toggleNode}
            onSetAllVisible={(visible) => setHiddenIds(visible ? new Set() : new Set(wbsNodes.map((n) => n.id)))}
            onDataChange={() => loadData(projectId)}
            onUpdateNode={handleUpdateWbsNode}
          />
        </div>
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
          onCreateNode={createNodeFromPopup}
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
