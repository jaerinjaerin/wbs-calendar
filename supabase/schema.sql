create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  owner_id uuid
);

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
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
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done'))
);

create index idx_wbs_nodes_project on wbs_nodes(project_id);
create index idx_wbs_nodes_parent on wbs_nodes(parent_id);
create index idx_tasks_wbs_node on tasks(wbs_node_id);
create index idx_tasks_dates on tasks(start_date, end_date);
create index idx_users_project on users(project_id);
