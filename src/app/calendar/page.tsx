'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getSession, clearSession } from '@/lib/auth';
import WbsTree from '@/components/WbsTree';
import CalendarView from '@/components/CalendarView';
import type { CalendarViewHandle } from '@/components/CalendarView';
import ExportButtons from '@/components/ExportButtons';
import TaskModal from '@/components/TaskModal';
import TaskPeekPanel from '@/components/TaskPeekPanel';
import type { Task, WbsNode, User, SessionData } from '@/types';
import styles from './page.module.css';

export default function CalendarPage() {
  const router = useRouter();
  const calendarRef = useRef<CalendarViewHandle>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [wbsNodes, setWbsNodes] = useState<WbsNode[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');

  const loadData = useCallback(async (projectId: string) => {
    const [{ data: t }, { data: n }, { data: u }, { data: p }] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('wbs_nodes').select('*').eq('project_id', projectId),
      supabase.from('users').select('*').eq('project_id', projectId),
      supabase.from('projects').select('name').eq('id', projectId).single(),
    ]);
    if (t) setTasks(t);
    if (n) setWbsNodes(n);
    if (u) setUsers(u);
    if (p) setProjectName(p.name);
  }, []);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.replace('/'); return; }
    setSession(s);
    loadData(s.project_id);
  }, [router, loadData]);

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
    if (session) await loadData(session.project_id);
  }

  async function handleSaveTask(task: Omit<Task, 'id'> & { id?: string }) {
    if (task.id) {
      const { id, ...rest } = task;
      await supabase.from('tasks').update(rest).eq('id', id);
    } else {
      await supabase.from('tasks').insert(task);
    }
    setModalOpen(false);
    if (session) await loadData(session.project_id);
  }

  async function handleDeleteTask(taskId: string) {
    await supabase.from('tasks').delete().eq('id', taskId);
    setSelectedTaskId(null);
    if (session) await loadData(session.project_id);
  }

  function handleLogout() {
    clearSession();
    router.replace('/');
  }

  if (!session) return null;

  const currentUser = users.find((u) => u.id === session.user_id);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
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
          {session.role === 'pm' && (
            <button className={styles.settingsBtn} onClick={() => router.push('/settings')}>
              설정
            </button>
          )}
          <button className={styles.avatar} onClick={handleLogout} title="로그아웃">
            {currentUser?.name.charAt(0) ?? '?'}
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <WbsTree
          projectId={session.project_id}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onDataChange={() => loadData(session.project_id)}
        />
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
