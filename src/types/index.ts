export type UserRole = 'pm' | 'member';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Project {
  id: string;
  name: string;
  admin_password_hash: string | null;
  created_at: string;
  owner_id: string | null;
}

export interface User {
  id: string;
  name: string;
  pin_hash: string | null;
  role: UserRole;
  project_id: string;
}

export interface WbsNode {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  color: string;
  depth: number;
}

export interface Task {
  id: string;
  wbs_node_id: string;
  name: string;
  start_date: string;
  end_date: string;
  assignee_id: string | null;
  status: TaskStatus;
}

export interface WbsTreeNode extends WbsNode {
  children: WbsTreeNode[];
  task_count: number;
}

