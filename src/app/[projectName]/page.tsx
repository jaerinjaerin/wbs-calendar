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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultStart, setModalDefaultStart] = useState<string | null>(null);
  const [modalDefaultEnd, setModalDefaultEnd] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [popoverRect, setPopoverRect] = useState<DOMRect | null>(null);

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
    if (!selectedNodeId) return tasks;
    const nodeIds = new Set<string>();
    function collectIds(id: string) {
      nodeIds.add(id);
      wbsNodes.filter((n) => n.parent_id === id).forEach((n) => collectIds(n.id));
    }
    collectIds(selectedNodeId);
    return tasks.filter((t) => nodeIds.has(t.wbs_node_id));
  }

  async function handleUpdateTask(taskId: string, changes: Partial<Task>) {
    await supabase.from('tasks').update(changes).eq('id', taskId);
    if (projectId) await loadData(projectId);
  }

  async function handleSaveTask(task: Omit<Task, 'id'> & { id?: string }) {
    if (task.id) {
      const { id, ...rest } = task;
      await supabase.from('tasks').update(rest).eq('id', id);
    } else {
      await supabase.from('tasks').insert(task);
    }
    setModalOpen(false);
    if (projectId) await loadData(projectId);
  }

  async function handleDeleteTask(taskId: string) {
    await supabase.from('tasks').delete().eq('id', taskId);
    setSelectedTaskId(null);
    if (projectId) await loadData(projectId);
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-md">
        <p className="text-body-md text-muted">프로젝트를 찾을 수 없습니다</p>
        <button className="py-xs px-5 rounded-md border border-hairline bg-canvas text-[13px] font-medium cursor-pointer" onClick={() => router.push('/')}>
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
          <button className="bg-transparent border-none text-on-dark text-base cursor-pointer px-xs py-xxs rounded-md hover:bg-white/[0.08]" onClick={() => router.push('/')}>←</button>
          <span className="font-display text-[13px] md:text-[15px] font-medium text-on-dark">WBS·Cal</span>
          <span className="text-on-dark-soft text-caption font-medium max-w-[100px] md:max-w-none truncate max-[480px]:hidden">{projectName}</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-xs">
          <ExportButtons tasks={filteredTasks()} wbsNodes={wbsNodes} users={users} calendarRef={calendarRef} />
          <button className="px-2.5 md:px-3.5 py-1.5 rounded-md text-[11px] md:text-xs font-medium border border-white/10 bg-white/[0.08] text-on-dark cursor-pointer" onClick={() => router.push(`/settings?project=${projectId}`)}>
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
            selectedNodeId={selectedNodeId}
            onSelectNode={(id) => { setSelectedNodeId(id); setSidebarOpen(false); }}
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
          onDelete={() => handleDeleteTask(selectedTask.id)}
          onClose={() => setSelectedTaskId(null)}
        />
        </>
      )}
    </div>
  );
}
