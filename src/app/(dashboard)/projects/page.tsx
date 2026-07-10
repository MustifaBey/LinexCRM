import { getProjects, getClients } from "@/actions/projects";
import { ProjectList } from "@/components/kanban/project-list";

export const revalidate = 0; // Disable caching to fetch fresh records

export default async function ProjectsPage() {
  // Fetch projects and clients in parallel on the server
  const [projects, clients] = await Promise.all([
    getProjects().catch(() => []),
    getClients().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Projeler</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Projelerinizi Kanban panoları ve zaman çizelgeleri ile yönetin.
        </p>
      </div>

      <ProjectList initialProjects={projects} clients={clients} />
    </div>
  );
}
