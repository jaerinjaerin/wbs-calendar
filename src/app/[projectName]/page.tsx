import Link from 'next/link';
import { getProjectByName, loadProjectData } from '@/app/actions';
import { errorMessage } from '@/lib/actionResult';
import ProjectCalendar from '@/components/ProjectCalendar';

// Server-rendered so project + calendar data arrive with the HTML instead of three serial server actions.
export default async function ProjectCalendarPage({ params }: { params: { projectName: string } }) {
  const project = await getProjectByName(decodeURIComponent(params.projectName));
  if (project.error) return <Message text={errorMessage(project.error, '프로젝트를 불러오지 못했습니다')} />;
  if (!project.data) return <Message text="프로젝트를 찾을 수 없습니다" />;

  const data = await loadProjectData(project.data.id);
  if (!data.data) return <Message text={errorMessage(data.error, '데이터를 불러오지 못했습니다')} />;

  return <ProjectCalendar project={project.data} initial={data.data} />;
}

function Message({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-md">
      <p className="text-body-md text-muted">{text}</p>
      <Link href="/" className="py-xs px-5 rounded-md border border-hairline bg-canvas text-body-xs font-medium">
        ← 프로젝트 목록
      </Link>
    </div>
  );
}
