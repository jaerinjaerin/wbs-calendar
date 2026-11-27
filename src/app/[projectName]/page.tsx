import Link from 'next/link';
import { cookies } from 'next/headers';
import { getProjectByName, loadProjectData, listProjectNames } from '@/app/actions';
import { errorMessage } from '@/lib/actionResult';
import ProjectCalendar from '@/components/ProjectCalendar';
import { WBS_COLLAPSED_COOKIE } from '@/lib/wbs';

// Server-rendered so project + calendar data arrive with the HTML instead of three serial server actions.
export default async function ProjectCalendarPage({ params }: { params: { projectName: string } }) {
  // the switcher list doesn't depend on this project, so it loads alongside it
  const [project, others] = await Promise.all([getProjectByName(decodeURIComponent(params.projectName)), listProjectNames()]);
  if (project.error) return <Message text={errorMessage(project.error, '프로젝트를 불러오지 못했습니다')} />;
  if (!project.data) return <Message text="프로젝트를 찾을 수 없습니다" />;

  const data = await loadProjectData(project.data.id);
  if (!data.data) return <Message text={errorMessage(data.error, '데이터를 불러오지 못했습니다')} />;

  // a failed switcher list only hides the other projects; the calendar still works
  // the sidebar's collapsed state lives in a cookie so the first render already has the right calendar width
  const wbsCollapsed = cookies().get(WBS_COLLAPSED_COOKIE)?.value === '1';
  return <ProjectCalendar project={project.data} projects={others.data ?? [project.data]} initial={data.data} initialWbsCollapsed={wbsCollapsed} />;
}

function Message({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-dvh gap-md">
      <p className="text-body-md text-muted">{text}</p>
      <Link href="/" className="py-xs px-5 rounded-md border border-hairline bg-canvas text-body-xs font-medium">
        ← 프로젝트 목록
      </Link>
    </div>
  );
}
