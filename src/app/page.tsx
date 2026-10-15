import Link from 'next/link';
import { listProjects } from './actions';
import { errorMessage } from '@/lib/actionResult';
import NewProjectForm from '@/components/NewProjectForm';

// Server-rendered so the list arrives in the HTML instead of after hydration + a server action round trip.
export default async function ProjectListPage() {
  const { data: projects, error } = await listProjects();

  if (!projects) {
    console.error(error);
    return (
      <div className="flex items-center justify-center min-h-screen p-lg">
        <p className="text-body-sm text-muted text-center">{errorMessage(error, '프로젝트 목록을 불러오지 못했습니다. 새로고침해 주세요')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-lg">
      <h1 className="flex items-center gap-sm font-display text-display-sm text-ink mb-xs">
        <img src="/icon.svg" alt="" className="w-xl h-xl" />
        WBS 캘린더
      </h1>
      <p className="text-muted text-body-sm mb-xl">프로젝트를 선택하세요</p>

      {projects.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-md max-w-[500px] w-full">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/${encodeURIComponent(p.name)}`}
              className="flex flex-col items-center gap-xs py-lg px-md bg-canvas border border-hairline rounded-lg"
            >
              <div className="w-9 h-9 rounded-full bg-surface-card text-ink flex items-center justify-center text-title-sm">
                {p.name.charAt(0)}
              </div>
              <span className="text-body-sm font-medium text-ink">{p.name}</span>
            </Link>
          ))}
        </div>
      )}

      <NewProjectForm hasProjects={projects.length > 0} />
    </div>
  );
}
