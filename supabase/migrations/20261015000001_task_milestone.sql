-- 엑셀 '주요 일정' 행에 넣을 일정 (WBS 이름 기반 방식을 대체)
alter table tasks add column is_milestone boolean not null default false;
