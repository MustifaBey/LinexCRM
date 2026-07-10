"use server";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_KANBAN_COLUMNS } from "@/lib/constants";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";

/**
 * Fetch all projects for the agency
 */
export async function getProjects() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, client:clients(id, name, logo_url)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Fetch a single project by ID with members
 */
export async function getProject(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, client:clients(id, name, logo_url)")
    .eq("id", projectId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Create a new project with default Kanban columns
 */
export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const clientId = formData.get("clientId") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const imageUrl = formData.get("imageUrl") as string;

  if (!name?.trim()) return { error: "Project name is required" };

  // Create the project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      client_id: clientId || null,
      start_date: startDate || null,
      end_date: endDate || null,
      status: "planning" as const,
      progress: 0,
      image_url: imageUrl?.trim() || null,
      created_by: user.id,
    } as any)
    .select()
    .single() as any;

  if (projectError) return { error: projectError.message };

  // Log activity
  await logActivity(`yeni bir proje oluşturdu: ${project.name}`, "project", project.id, { projectName: project.name });

  // Create default Kanban columns for the new project
  const columns = DEFAULT_KANBAN_COLUMNS.map((col) => ({
    project_id: project.id,
    title: col.title,
    position: col.position,
    color: col.color,
  }));

  const { error: columnsError } = await supabase
    .from("kanban_columns")
    .insert(columns as any);

  if (columnsError) {
    // Rollback project if columns fail
    await supabase.from("projects").delete().eq("id", project.id);
    return { error: columnsError.message };
  }

  revalidatePath("/projects");
  return { data: project };
}

/**
 * Update a project's details
 */
export async function updateProject(
  projectId: string,
  updates: {
    name?: string;
    description?: string | null;
    status?: string;
    progress?: number;
    start_date?: string | null;
    end_date?: string | null;
    client_id?: string | null;
    budget?: number | null;
  }
) {
  const supabase = await createClient();
  const { error } = await (supabase
    .from("projects") as any)
    .update(updates)
    .eq("id", projectId);

  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: true };
}

/**
 * Delete a project and all associated data (cascading)
 */
export async function deleteProject(projectId: string) {
  const supabase = await createClient();

  // 1. Delete tasks
  await supabase.from("tasks").delete().eq("project_id", projectId);

  // 2. Delete kanban_columns
  await supabase.from("kanban_columns").delete().eq("project_id", projectId);

  // 3. Delete project_members
  await supabase.from("project_members").delete().eq("project_id", projectId);

  // 4. Delete media_files
  await supabase.from("media_files").delete().eq("project_id", projectId);

  // 5. Delete project
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) return { error: error.message };
  revalidatePath("/projects");
  return { success: true };
}

/**
 * Fetch all clients (for project creation dropdown)
 */
export async function getClients() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, logo_url")
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}

export async function getSearchData() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("name");

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("name");

  let vault: any[] = [];
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as any;

    if (profile && ["owner", "admin"].includes(profile.role)) {
      const { data: credentials } = await supabase
        .from("vault_credentials")
        .select("id, label, credential_type")
        .order("label");
      vault = credentials || [];
    }
  }

  return {
    projects: projects || [],
    clients: clients || [],
    vault: vault || [],
  };
}

export async function getDashboardStats() {
  const supabase = await createClient();

  const [projectsRes, mediaRes, domainsRes, clientsRes] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("media_files").select("*", { count: "exact", head: true }),
    supabase.from("domain_records").select("*", { count: "exact", head: true }),
    supabase.from("clients").select("*", { count: "exact", head: true }),
  ]);

  return {
    projectsCount: projectsRes.count || 0,
    mediaFilesCount: mediaRes.count || 0,
    domainRecordsCount: domainsRes.count || 0,
    clientsCount: clientsRes.count || 0,
  };
}

export async function updateProjectCanvas(projectId: string, url: string | null) {
  const supabase = await createClient();

  const { error } = await (supabase
    .from("projects") as any)
    .update({
      canvas_url: url ? url.trim() : null,
    })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}
