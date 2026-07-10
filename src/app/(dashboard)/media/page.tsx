import { getProjects } from "@/actions/projects";
import { getMediaFiles } from "@/actions/media";
import { getClientsList } from "@/actions/clients";
import { FileGrid } from "@/components/media/file-grid";
import { Suspense } from "react";

export const revalidate = 0; // Disable caching to ensure fresh real-time list on load

export default async function MediaPage() {
  // Fetch projects, files and clients in parallel on the server
  const [projectsData, filesData, clientsData] = await Promise.all([
    getProjects().catch(() => []),
    getMediaFiles().catch(() => ({ data: [], count: 0, error: null })),
    getClientsList().catch(() => ({ data: [], error: null })),
  ]);

  const projects = projectsData || [];
  const files = filesData.data || [];
  const filesCount = filesData.count || 0;
  const clients = clientsData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Medya Kasası</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tasarım varlıklarını yükleyin, inceleyin ve gerçek zamanlı geri bildirim pinleriyle onaylayın.
          </p>
        </div>
      </div>

      <Suspense fallback={
        <div className="py-20 flex flex-col items-center justify-center gap-2">
          <div className="w-6 h-6 border-2 border-burgundy border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-muted-foreground">Medya listesi yükleniyor...</span>
        </div>
      }>
        <FileGrid initialFiles={files} initialCount={filesCount} projects={projects} clients={clients} />
      </Suspense>
    </div>
  );
}
