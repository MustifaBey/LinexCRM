import { getProject, getClients } from "@/actions/projects";
import { getKanbanData, getTeamMembers } from "@/actions/tasks";
import { ProjectDetailTabs } from "./project-detail-tabs";
import { Folder } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = await params;

  // Fetch all necessary data in parallel on the server
  const [project, columns, teamMembers, clients] = await Promise.all([
    getProject(projectId).catch(() => null) as Promise<any>,
    getKanbanData(projectId).catch(() => []) as Promise<any[]>,
    getTeamMembers().catch(() => []) as Promise<any[]>,
    getClients().catch(() => []) as Promise<any[]>,
  ]);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 select-none">
        <div className="bg-burgundy/10 border border-burgundy/20 p-4 rounded-full mb-4">
          <Folder className="w-10 h-10 text-burgundy" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Proje Bulunamadı
        </h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-sm">
          Aradığınız proje mevcut değil veya görüntüleme yetkiniz yok.
        </p>
        <Link
          href="/projects"
          className="mt-6 px-4 py-2 rounded-xl border border-border bg-card text-muted-foreground text-sm font-medium hover:text-foreground hover:bg-muted transition-all"
        >
          Projelere Geri Dön
        </Link>
      </div>
    );
  }

  return (
    <ProjectDetailTabs
      project={project}
      columns={columns}
      teamMembers={teamMembers}
      clients={clients}
    />
  );
}
