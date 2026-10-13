create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  admin_password_hash text,
  created_at timestamptz default now(),
  owner_id uuid
);

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text,
  role text not null check (role in ('pm', 'member')),
  project_id uuid not null references projects(id) on delete cascade
);

alter table projects
  add constraint projects_owner_id_fkey
  foreign key (owner_id) references users(id) on delete set null;

create table wbs_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  parent_id uuid references wbs_nodes(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  color text not null default '#3563e9',
  depth int not null default 0
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  wbs_node_id uuid not null references wbs_nodes(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  assignee_id uuid references users(id) on delete set null,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  memo text,
  url text,
  priority text check (priority in ('high', 'medium', 'low'))
);

create index idx_wbs_nodes_project on wbs_nodes(project_id);
create index idx_wbs_nodes_parent on wbs_nodes(parent_id);
create index idx_tasks_wbs_node on tasks(wbs_node_id);
create index idx_tasks_dates on tasks(start_date, end_date);
create index idx_users_project on users(project_id);

-- Per-IP request counters for server actions (fixed window).
create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;

create function hit_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c int;
begin
  insert into rate_limits (key, window_start) values (p_key, w)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into c;
  -- ponytail: 1% of calls sweep day-old rows; switch to pg_cron if the table still grows
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;
  return c <= p_max;
end;
$$;

revoke all on function hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function hit_rate_limit(text, int, int) to service_role;

-- 브라우저(anon) 직접 접근 차단: 모든 DB 접근은 서버 액션(secret key)으로만.
alter table projects  enable row level security;
alter table users     enable row level security;
alter table wbs_nodes enable row level security;
alter table tasks     enable row level security;
revoke all on projects, users, wbs_nodes, tasks from anon, authenticated;
