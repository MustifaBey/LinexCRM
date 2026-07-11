import { getContentPosts } from "@/actions/calendar";
import { getProjects } from "@/actions/projects";
import { CalendarView } from "@/components/calendar/calendar-view";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

interface CalendarPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const now = new Date();
  const month = params.month ? parseInt(params.month) : now.getMonth() + 1;
  const year = params.year ? parseInt(params.year) : now.getFullYear();

  const [postsRes, projects] = await Promise.all([
    getContentPosts(month, year),
    getProjects().catch(() => []),
  ]);

  const posts = Array.isArray(postsRes) ? postsRes : ((postsRes as any).data || []);

  return (
    <div className="px-0 py-4 md:p-0 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">İçerik Takvimi</h1>
        <p className="text-sm text-muted-foreground">
          Sosyal medya içeriklerini planlayın, yayın tarihlerini düzenleyin ve projeleri koordine edin.
        </p>
      </div>

      <CalendarView
        initialPosts={posts}
        projects={projects as any}
        currentMonth={month}
        currentYear={year}
      />
    </div>
  );
}
