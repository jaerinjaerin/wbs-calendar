import Link from 'next/link';
import { listProjects } from './actions';
import { errorMessage } from '@/lib/actionResult';
import { dayPct, seoulToday } from '@/lib/projectOverview';
import NewProjectForm from '@/components/NewProjectForm';

const LANE_PX = 8; // bar 5px + gap 3px
const TICKS = [1, 8, 15, 22, 29];
// desktop: name | shared month timeline | this week's deadlines; mobile: name and deadline badge in one line
const ROW = 'flex items-center gap-xs md:grid md:grid-cols-[200px_minmax(0,1fr)_88px] md:gap-md';

// Server-rendered so the list arrives in the HTML instead of after hydration + a server action round trip.
export default async function ProjectListPage() {
  const { data: projects, error } = await listProjects();

  if (!projects) {
    console.error(error);
    return (
      <div className="flex items-center justify-center min-h-dvh p-lg">
        <p className="text-body-sm text-muted text-center">{errorMessage(error, '프로젝트 목록을 불러오지 못했습니다. 새로고침해 주세요')}</p>
      </div>
    );
  }

  const title = (
    <h1 className="flex items-center gap-xs font-display text-title-lg text-ink">
      <img src="/icon.svg" alt="" className="w-lg h-lg" />
      WBS 캘린더
    </h1>
  );

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-lg min-h-dvh p-lg">
        {title}
        <NewProjectForm hasProjects={false} />
      </div>
    );
  }

  const today = seoulToday();
  const [year, month] = today.split('-').map(Number);
  const todayPct = dayPct(today, today);

  return (
    <div className="min-h-dvh px-lg pt-xl pb-lg md:pt-section">
      <div className="w-full max-w-[960px] mx-auto">
        <div className="flex items-baseline justify-between gap-md mb-lg">
          {title}
          <span className="text-body-sm text-muted">{year}년 {month}월</span>
        </div>

        <div aria-hidden="true" className={`hidden ${ROW} pb-xs border-b border-hairline text-micro text-muted`}>
          <span />
          <span className="relative h-[16px]">
            {TICKS.map((d) => (
              <span key={d} className="absolute -translate-x-1/2" style={{ left: `${dayPct(`${today.slice(0, 8)}${String(d).padStart(2, '0')}`, today)}%` }}>
                {d}
              </span>
            ))}
          </span>
          <span className="text-right">이번 주 마감</span>
        </div>

        <ul>
          {projects.map((p) => {
            const { bars, lanes, dueThisWeek } = p.overview;
            return (
              <li key={p.id}>
                <Link
                  href={`/${encodeURIComponent(p.name)}`}
                  className={`${ROW} min-h-[52px] border-b border-hairline transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent`}
                >
                  <span className="flex-1 min-w-0 py-sm text-body-sm font-medium text-ink truncate md:whitespace-normal md:break-words">{p.name}</span>
                  {/* the timeline cell spans the full row height so the today line joins up across rows */}
                  <span aria-hidden="true" className="hidden md:block relative self-stretch">
                    <span className="absolute inset-x-0 top-1/2 -translate-y-1/2" style={{ height: Math.max(lanes, 1) * LANE_PX - 3 }}>
                      {bars.map((b, i) => (
                        <span
                          key={i}
                          className="absolute h-[5px] rounded-pill"
                          style={{ top: b.lane * LANE_PX, left: `${b.left}%`, width: `${b.width}%`, background: b.color }}
                        />
                      ))}
                    </span>
                    <span className="absolute inset-y-0 w-px bg-ink" style={{ left: `${todayPct}%` }} />
                  </span>
                  <span className="shrink-0 md:text-right">
                    {dueThisWeek > 0 ? (
                      <span className="inline-block px-xs py-[2px] rounded-pill bg-error/10 text-error text-body-xs">마감 {dueThisWeek}</span>
                    ) : (
                      <span className="hidden md:inline text-body-xs text-muted-soft">—</span>
                    )}
                  </span>
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="w-[16px] h-[16px] shrink-0 text-muted-soft md:hidden" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 3.5 10.5 8 6 12.5" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>

        <NewProjectForm hasProjects />
      </div>
    </div>
  );
}
