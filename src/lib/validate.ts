import type { Task, WbsNode, TaskStatus, TaskPriority } from '@/types';

// Server-side input checks for server actions. Each returns the cleaned value or null.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLOR = /^#[0-9a-f]{6}$/i;
const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done'];
const PRIORITIES: TaskPriority[] = ['high', 'medium', 'low'];
const NAME_MAX = 100;
const TEXT_MAX = 2000;
const TASK_FIELDS = ['name', 'start_date', 'end_date', 'assignee_id', 'status', 'priority', 'memo', 'url', 'wbs_node_id', 'is_milestone'] as const;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v);
}

export function isColor(v: unknown): v is string {
  return typeof v === 'string' && COLOR.test(v);
}

export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length >= 1 && s.length <= NAME_MAX ? s : null;
}

// no trim: passwords were hashed exactly as typed, so trimming would break existing logins
export function cleanPassword(v: unknown): string | null {
  return typeof v === 'string' && v.length >= 1 && v.length <= NAME_MAX ? v : null;
}

export function isDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function isOptionalText(v: unknown): v is string | null {
  return v === null || (typeof v === 'string' && v.length <= TEXT_MAX);
}

// Checks only the editable fields present; unknown fields are dropped.
// Start/end order is checked when both are given (a calendar resize sends end_date alone).
export function cleanTaskChanges(v: unknown): Partial<Task> | null {
  if (!v || typeof v !== 'object') return null;
  const src = v as Record<string, unknown>;
  const out: Partial<Task> = {};
  for (const key of TASK_FIELDS) {
    if (!(key in src) || src[key] === undefined) continue;
    const val = src[key];
    switch (key) {
      case 'name': {
        const name = cleanName(val);
        if (!name) return null;
        out.name = name;
        break;
      }
      case 'start_date':
      case 'end_date':
        if (!isDate(val)) return null;
        out[key] = val;
        break;
      case 'wbs_node_id':
        if (!isUuid(val)) return null;
        out.wbs_node_id = val;
        break;
      case 'assignee_id':
        if (val !== null && !isUuid(val)) return null;
        out.assignee_id = val as string | null;
        break;
      case 'status':
        if (!STATUSES.includes(val as TaskStatus)) return null;
        out.status = val as TaskStatus;
        break;
      case 'priority':
        if (val !== null && !PRIORITIES.includes(val as TaskPriority)) return null;
        out.priority = val as TaskPriority | null;
        break;
      case 'is_milestone':
        if (typeof val !== 'boolean') return null;
        out.is_milestone = val;
        break;
      case 'memo':
      case 'url':
        if (!isOptionalText(val)) return null;
        out[key] = val;
        break;
    }
  }
  if (Object.keys(out).length === 0) return null;
  if (out.start_date && out.end_date && out.start_date > out.end_date) return null;
  return out;
}

export function cleanNewTask(v: unknown): Task | null {
  if (!v || typeof v !== 'object') return null;
  const src = v as Record<string, unknown>;
  if (!isUuid(src.id)) return null;
  const fields = cleanTaskChanges(src);
  if (!fields?.name || !fields.start_date || !fields.end_date || !fields.wbs_node_id) return null;
  return {
    assignee_id: null, status: 'todo', priority: null, memo: null, url: null, is_milestone: false,
    ...fields,
    id: src.id,
  } as Task;
}

export function cleanNewWbsNode(v: unknown): Omit<WbsNode, 'id'> | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  const name = cleanName(s.name);
  if (!name || !isUuid(s.project_id)) return null;
  if (s.parent_id !== null && !isUuid(s.parent_id)) return null;
  if (typeof s.color !== 'string' || !COLOR.test(s.color)) return null;
  if (typeof s.depth !== 'number' || !Number.isInteger(s.depth) || s.depth < 0) return null;
  if (typeof s.sort_order !== 'number' || !Number.isInteger(s.sort_order)) return null;
  return { project_id: s.project_id, parent_id: s.parent_id, name, color: s.color, depth: s.depth, sort_order: s.sort_order };
}
