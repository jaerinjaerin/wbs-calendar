-- 브라우저(anon) 직접 접근 차단: 모든 DB 접근은 서버 액션(secret key)으로만.
alter table projects  enable row level security;
alter table users     enable row level security;
alter table wbs_nodes enable row level security;
alter table tasks     enable row level security;
revoke all on projects, users, wbs_nodes, tasks from anon, authenticated;
