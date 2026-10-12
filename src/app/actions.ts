'use server';

import { headers } from 'next/headers';
import { db } from '@/lib/server/db';
import { clientIp, isAllowed, type LimitKind } from '@/lib/server/rateLimit';
import { passwordMatches } from '@/lib/server/password';
import { hashPin } from '@/lib/auth';
import { ok, fail, fromDb, type ActionResult } from '@/lib/actionResult';
import { isUuid, cleanName, cleanPassword, cleanNewTask, cleanTaskChanges, cleanNewWbsNode } from '@/lib/validate';
import type { Task, WbsNode, User, ProjectSummary } from '@/types';

// Every action: rate limit → validate → query. Results mirror supabase-js ({ data, error }).

async function limited(kind: LimitKind): Promise<boolean> {
  const ip = clientIp(headers().get('x-forwarded-for'));
  return !(await isAllowed((args) => db.rpc('hit_rate_limit', args), kind, ip));
}

const rateLimited = () => fail('rate_limited', 'Too many requests');
const invalid = () => fail('invalid_input', 'Invalid input');
const unauthorized = () => fail('unauthorized', 'Wrong admin password');

async function adminOk(projectId: unknown, password: unknown): Promise<boolean> {
  const pw = cleanPassword(password);
  if (!isUuid(projectId) || !pw) return false;
  const { data, error } = await db.from('projects').select('admin_password_hash').eq('id', projectId).maybeSingle();
  if (error) console.error('adminOk query failed', error);
  return !!data?.admin_password_hash && (await passwordMatches(pw, data.admin_password_hash));
}

// never select the legacy pin_hash column; rows get pin_hash: null to satisfy the User type
const USER_COLUMNS = 'id, name, role, project_id';
const toUsers = (rows: Omit<User, 'pin_hash'>[]): User[] => rows.map((r) => ({ ...r, pin_hash: null }));

// ponytail: in.(...) puts every category id in the URL; switch to an inner-join filter if a project ever has hundreds of categories
async function tasksOf(nodeIds: string[], columns = '*') {
  if (nodeIds.length === 0) return { data: [], error: null };
  return db.from('tasks').select(columns).in('wbs_node_id', nodeIds);
}

// ---- projects ----

export async function listProjects(): Promise<ActionResult<ProjectSummary[]>> {
  if (await limited('read')) return rateLimited();
  return fromDb(await db.from('projects').select('id, name').order('created_at', { ascending: false }));
}

export async function createProject(name: string, adminName: string, password: string): Promise<ActionResult<ProjectSummary>> {
  if (await limited('project_create')) return rateLimited();
  const projectName = cleanName(name);
  const admin = cleanName(adminName);
  const pw = cleanPassword(password);
  if (!projectName || !admin || !pw) return invalid();

  const p = await db.from('projects').insert({ name: projectName, admin_password_hash: await hashPin(pw) }).select('id, name').single();
  if (p.error) return fail(p.error.code, p.error.message);
  const u = await db.from('users').insert({ name: admin, pin_hash: null, role: 'pm', project_id: p.data.id }).select('id').single();
  if (u.error) {
    await db.from('projects').delete().eq('id', p.data.id); // don't leave a project nobody administers
    return fail(u.error.code, u.error.message);
  }
  await db.from('projects').update({ owner_id: u.data.id }).eq('id', p.data.id);
  return ok(p.data);
}

export async function getProjectByName(name: string): Promise<ActionResult<ProjectSummary>> {
  if (await limited('read')) return rateLimited();
  if (typeof name !== 'string') return invalid();
  return fromDb(await db.from('projects').select('id, name').eq('name', name).maybeSingle());
}

export async function getProject(id: string): Promise<ActionResult<ProjectSummary>> {
  if (await limited('read')) return rateLimited();
  if (!isUuid(id)) return invalid();
  return fromDb(await db.from('projects').select('id, name').eq('id', id).maybeSingle());
}

export async function loadProjectData(projectId: string): Promise<ActionResult<{ tasks: Task[]; wbsNodes: WbsNode[]; users: User[] }>> {
  if (await limited('read')) return rateLimited();
  if (!isUuid(projectId)) return invalid();
  const [n, u] = await Promise.all([
    db.from('wbs_nodes').select('*').eq('project_id', projectId),
    db.from('users').select(USER_COLUMNS).eq('project_id', projectId),
  ]);
  if (n.error) return fail(n.error.code, n.error.message);
  if (u.error) return fail(u.error.code, u.error.message);
  const t = await tasksOf(n.data.map((node) => node.id));
  if (t.error) return fail(t.error.code, t.error.message);
  return ok({ tasks: t.data as Task[], wbsNodes: n.data, users: toUsers(u.data) });
}

// ---- tasks ----

export async function createTask(task: Task): Promise<ActionResult<null>> {
  if (await limited('create')) return rateLimited();
  const clean = cleanNewTask(task);
  if (!clean) return invalid();
  return fromDb(await db.from('tasks').insert(clean));
}

export async function updateTask(id: string, changes: Partial<Task>): Promise<ActionResult<null>> {
  if (await limited('write')) return rateLimited();
  const clean = cleanTaskChanges(changes);
  if (!isUuid(id) || !clean) return invalid();
  return fromDb(await db.from('tasks').update(clean).eq('id', id));
}

export async function deleteTask(id: string): Promise<ActionResult<null>> {
  if (await limited('write')) return rateLimited();
  if (!isUuid(id)) return invalid();
  return fromDb(await db.from('tasks').delete().eq('id', id));
}

// ---- categories ----

export async function loadWbsTree(projectId: string): Promise<ActionResult<{ nodes: WbsNode[]; counts: Record<string, number> }>> {
  if (await limited('read')) return rateLimited();
  if (!isUuid(projectId)) return invalid();
  const n = await db.from('wbs_nodes').select('*').eq('project_id', projectId).order('sort_order');
  if (n.error) return fail(n.error.code, n.error.message);
  const t = await tasksOf(n.data.map((node) => node.id), 'wbs_node_id');
  if (t.error) return fail(t.error.code, t.error.message);
  const counts: Record<string, number> = {};
  (t.data as { wbs_node_id: string }[]).forEach(({ wbs_node_id }) => { counts[wbs_node_id] = (counts[wbs_node_id] ?? 0) + 1; });
  return ok({ nodes: n.data, counts });
}

export async function createWbsNode(node: Omit<WbsNode, 'id'>): Promise<ActionResult<null>> {
  if (await limited('create')) return rateLimited();
  const clean = cleanNewWbsNode(node);
  if (!clean) return invalid();
  return fromDb(await db.from('wbs_nodes').insert(clean));
}

export async function renameWbsNode(id: string, name: string): Promise<ActionResult<null>> {
  if (await limited('write')) return rateLimited();
  const clean = cleanName(name);
  if (!isUuid(id) || !clean) return invalid();
  return fromDb(await db.from('wbs_nodes').update({ name: clean }).eq('id', id));
}

export async function deleteWbsNode(id: string): Promise<ActionResult<null>> {
  if (await limited('write')) return rateLimited();
  if (!isUuid(id)) return invalid();
  return fromDb(await db.from('wbs_nodes').delete().eq('id', id));
}

// ---- admin (password re-checked on every call) ----

export async function verifyAdmin(projectId: string, password: string): Promise<ActionResult<{ project: ProjectSummary; users: User[] }>> {
  if (await limited('auth')) return rateLimited();
  if (!(await adminOk(projectId, password))) return unauthorized();
  const [p, u] = await Promise.all([
    db.from('projects').select('id, name').eq('id', projectId).single(),
    db.from('users').select(USER_COLUMNS).eq('project_id', projectId),
  ]);
  if (p.error) return fail(p.error.code, p.error.message);
  if (u.error) return fail(u.error.code, u.error.message);
  return ok({ project: p.data, users: toUsers(u.data) });
}

export async function addMember(projectId: string, password: string, member: { id: string; name: string }): Promise<ActionResult<null>> {
  if (await limited('create')) return rateLimited();
  // admin actions share the auth budget so they can't be used as a faster password guesser
  if (await limited('auth')) return rateLimited();
  if (!(await adminOk(projectId, password))) return unauthorized();
  const name = cleanName(member?.name);
  if (!isUuid(member?.id) || !name) return invalid();
  return fromDb(await db.from('users').insert({ id: member.id, name, pin_hash: null, role: 'member', project_id: projectId }));
}

export async function deleteMember(projectId: string, password: string, userId: string): Promise<ActionResult<null>> {
  if (await limited('write')) return rateLimited();
  if (await limited('auth')) return rateLimited();
  if (!(await adminOk(projectId, password))) return unauthorized();
  if (!isUuid(userId)) return invalid();
  // scoped to this project's members: the admin (pm) row can't be removed here
  return fromDb(await db.from('users').delete().eq('id', userId).eq('project_id', projectId).eq('role', 'member'));
}

export async function renameProject(projectId: string, password: string, name: string): Promise<ActionResult<null>> {
  if (await limited('write')) return rateLimited();
  if (await limited('auth')) return rateLimited();
  if (!(await adminOk(projectId, password))) return unauthorized();
  const clean = cleanName(name);
  if (!clean) return invalid();
  return fromDb(await db.from('projects').update({ name: clean }).eq('id', projectId));
}

export async function deleteProject(projectId: string, password: string): Promise<ActionResult<null>> {
  if (await limited('write')) return rateLimited();
  if (await limited('auth')) return rateLimited();
  if (!(await adminOk(projectId, password))) return unauthorized();
  return fromDb(await db.from('projects').delete().eq('id', projectId));
}
