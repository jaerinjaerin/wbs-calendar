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
import styles from './page.module.css';

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
  const [modalDefaultDate, setModalDefaultDate] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
        <p style={{ fontSize: 16, color: '#5c6270' }}>프로젝트를 찾을 수 없습니다</p>
        <button onClick={() => router.push('/')} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d8dce6', background: '#fff', cursor: 'pointer' }}>
          ← 프로젝트 목록
        </button>
      </div>
    );
  }

  if (!projectId) return null;

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => router.push('/')}>←</button>
          <span className={styles.logo}>WBS·Cal</span>
          <span className={styles.projectName}>{projectName}</span>
        </div>
        <div className={styles.headerRight}>
          <ExportButtons
            tasks={filteredTasks()}
            wbsNodes={wbsNodes}
            users={users}
            calendarRef={calendarRef}
          />
          <button className={styles.addBtn} onClick={() => { setModalDefaultDate(null); setModalOpen(true); }}>
            + 작업 추가
          </button>
          <button className={styles.settingsBtn} onClick={() => router.push(`/settings?project=${projectId}`)}>
            설정
          </button>
          <button className={styles.menuBtn} onClick={() => setSidebarOpen((v) => !v)} aria-label="WBS 메뉴">
            ☰
          </button>
        </div>
      </header>

      {sidebarOpen && <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />}
      <div className={styles.body}>
        <div className={`${styles.sidebarWrap} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
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
          onClickEvent={(id) => setSelectedTaskId(id)}
          onUpdateTask={handleUpdateTask}
          onClickDate={(date) => { setModalDefaultDate(date); setModalOpen(true); }}
        />
      </div>

      {modalOpen && (
        <TaskModal
          wbsNodes={wbsNodes}
          users={users}
          defaultDate={modalDefaultDate}
          onSave={handleSaveTask}
          onClose={() => setModalOpen(false)}
        />
      )}

      {selectedTask && (
        <TaskPeekPanel
          task={selectedTask}
          wbsNodes={wbsNodes}
          users={users}
          onUpdate={(changes) => handleUpdateTask(selectedTask.id, changes)}
          onDelete={() => handleDeleteTask(selectedTask.id)}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
