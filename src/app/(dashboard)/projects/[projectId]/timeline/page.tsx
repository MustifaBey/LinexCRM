import { getProject } from "@/actions/projects";
import { getKanbanData } from "@/actions/tasks";
import { GanttChart } from "@/components/timeline/gantt-chart";
import { ChevronRight, Folder } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectTimelinePage({ params }: PageProps) {
  const { projectId } = await params;

  // Fetch project meta and task columns in parallel on the server
  const [project, columns] = await Promise.all([
    getProject(projectId).catch(() => null) as Promise<any>,
    getKanbanData(projectId).catch(() => []) as Promise<any[]>,
  ]);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 select-none">
        <div className="bg-burgundy/10 border border-burgundy/20 p-4 rounded-full mb-4">
          <Folder className="w-10 h-10 text-burgundy" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Project Not Found
        </h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-sm">
          The project you are looking for does not exist or you do not have permission to view it.
        </p>
        <Link
          href="/projects"
          className="mt-6 px-4 py-2 rounded-xl border border-border bg-card text-muted-foreground text-sm font-medium hover:text-foreground hover:bg-muted transition-all"
        >
          Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
            <Link href="/projects" className="hover:text-burgundy transition-colors">
              Projects
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href={`/projects/${projectId}`} className="hover:text-burgundy transition-colors">
              {project.name}
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground">Timeline</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground pt-0.5">
            {project.name} — Timeline
          </h1>
          {project.description && (
            <p className="text-muted-foreground text-sm line-clamp-1">{project.description}</p>
          )}
        </div>

        {/* View Switch Link */}
        <div className="flex items-center gap-2 select-none shrink-0 self-start sm:self-auto">
          <Link
            href={`/projects/${projectId}`}
            className="px-4.5 h-10 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground text-sm font-semibold hover:bg-muted/30 transition-all flex items-center gap-2"
          >
            <span>Kanban Board</span>
          </Link>
        </div>
      </div>

      {/* Gantt Timeline View */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xl overflow-hidden">
        <GanttChart
          columns={columns}
          projectStartDate={project.start_date}
          projectEndDate={project.end_date}
        />
      </div>
    </div>
  );
}
