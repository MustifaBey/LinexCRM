import { getProjects } from "@/actions/projects";
import { getMediaFiles } from "@/actions/media";
import { FileGrid } from "@/components/media/file-grid";

export const revalidate = 0; // Disable caching to ensure fresh real-time list on load

export default async function MediaPage() {
  // Fetch projects and files in parallel on the server
  const [projectsData, filesData] = await Promise.all([
    getProjects().catch(() => []),
    getMediaFiles().catch(() => ({ data: [], error: null })),
  ]);

  const projects = projectsData || [];
  const files = filesData.data || [];

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

      <FileGrid initialFiles={files} projects={projects} />
    </div>
  );
}
