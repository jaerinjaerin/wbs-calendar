'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import WbsTree from '@/components/WbsTree';
import CalendarView from '@/components/CalendarView';
import type { CalendarViewHandle } from '@/components/CalendarView';
import ExportButtons from '@/components/ExportButtons';
import TaskModal from '@/components/TaskModal';
import TaskPeekPanel from '@/components/TaskPeekPanel';
import { useToast } from '@/components/Toast';
import type { Task, WbsNode, User } from '@/types';

export default function ProjectCalendarPage() {
  const params = useParams<{ projectName: string }>();
  const router = useRouter();
  const calendarRef = useRef<CalendarViewHandle>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [wbsNodes, setWbsNodes] = useState<WbsNode[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  // store unchecked ids so new nodes show by default
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultStart, setModalDefaultStart] = useState<string | null>(null);
  const [modalDefaultEnd, setModalDefaultEnd] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [popoverRect, setPopoverRect] = useState<DOMRect | null>(null);
  const { showToast, hideToast, toastNode } = useToast();

  const loadData = useCallback(async (pid: string) => {
    const [{ data: t }, { data: n }, { data: u }] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('wbs_nodes').select('*').eq('project_id', pid),
      supabase.from('users').select('*').eq('project_id', pid),
    ]);
    if (t) setTasks(t);
    if (n) setWbsNodes(n);
    if (u) setUsers(u);
  }, []);

  useEffect(() => {
    const name = decodeURIComponent(params.projectName);
    supabase
      .from('projects')
      .select('*')
      .eq('name', name)
      .single()
      .then(({ data }) => {
        if (!data) { setNotFound(true); return; }
        setProjectId(data.id);
        setProjectName(data.name);
        loadData(data.id);
      });
  }, [params.projectName, loadData]);

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
    await supabase.from('tasks').update(changes).eq('id', taskId);
    if (projectId) await loadData(projectId);
  }

  // optimistic: show immediately, roll back on failure. Client-side id makes retries idempotent (PK conflict).
  async function insertTask(task: Task) {
    setTasks((prev) => [...prev, task]);
    const { error } = await supabase.from('tasks').insert(task);
    // 23505 = unique violation: an earlier attempt already landed, so treat as success
    if (error && error.code !== '23505') {
      console.error(error);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      showToast({ message: '작업 추가에 실패했습니다', onRetry: () => { hideToast(); insertTask(task); } });
      return;
    }
    if (projectId) await loadData(projectId);
  }

  function handleSaveTask(input: Omit<Task, 'id'>) {
    setModalOpen(false);
    insertTask({ ...input, id: crypto.randomUUID() });
  }

  // optimistic like insertTask; delete by id is idempotent so retry is safe
  async function handleDeleteTask(task: Task) {
    setSelectedTaskId(null);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) {
      console.error(error);
      setTasks((prev) => [...prev, task]);
      showToast({ message: '작업 삭제에 실패했습니다', onRetry: () => { hideToast(); handleDeleteTask(task); } });
      return;
    }
    if (projectId) await loadData(projectId);
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-md">
        <p className="text-body-md text-muted">프로젝트를 찾을 수 없습니다</p>
        <button className="py-xs px-5 rounded-md border border-hairline bg-canvas text-body-xs font-medium cursor-pointer" onClick={() => router.push('/')}>
          ← 프로젝트 목록
        </button>
      </div>
    );
  }

  if (!projectId) return null;

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex items-center justify-between px-3 h-12 md:px-5 md:h-14 bg-surface-dark shrink-0">
        <div className="flex items-center gap-xs md:gap-sm">
          <button className="bg-transparent border-none text-on-dark text-base cursor-pointer px-xs py-xxs rounded-md hover:bg-white/[0.08]" onClick={() => router.push('/')} aria-label="프로젝트 목록">←</button>
          <span className="font-display text-body-xs md:text-title-sm text-on-dark">WBS 캘린더</span>
          <span className="text-on-dark-soft text-caption font-medium max-w-[100px] md:max-w-none truncate max-[480px]:hidden">{projectName}</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-xs">
          <ExportButtons tasks={filteredTasks()} wbsNodes={wbsNodes} users={users} calendarRef={calendarRef} projectName={projectName} />
          <button className="px-2.5 md:px-3.5 py-1.5 rounded-md text-micro md:text-xs font-medium border border-white/10 bg-white/[0.08] text-on-dark cursor-pointer" onClick={() => router.push(`/settings?project=${projectId}`)}>
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
            hiddenIds={hiddenIds}
            onToggleNode={toggleNode}
            onDataChange={() => loadData(projectId)}
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
        <div className="fixed inset-0 z-40" onClick={() => setSelectedTaskId(null)} />
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
