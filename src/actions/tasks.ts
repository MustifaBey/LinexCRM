"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";

/**
 * Helper to dynamically calculate and update project progress.
 * Formula: (Tasks in 'Done' / Total Tasks) * 100
 */
async function syncProjectProgress(supabase: any, projectId: string) {
  try {
    // 1. Fetch all columns ordered by position
    const { data: columns, error: colError } = await supabase
      .from("kanban_columns")
      .select("id, title")
      .eq("project_id", projectId)
      .order("position");

    if (colError || !columns || columns.length === 0) return;

    // 2. Identify the Done column (English 'Done' or Turkish 'Tamamlandı')
    const doneCol = columns.find(
      (col: any) =>
        col.title === "Done" ||
        col.title === "Tamamlandı" ||
        col.title === "Tamamlandı (Done)"
    ) || columns[columns.length - 1]; // Fallback to last column

    const doneColId = doneCol?.id;

    // 3. Get all tasks in project
    const { data: tasks, error: taskError } = await supabase
      .from("tasks")
      .select("column_id")
      .eq("project_id", projectId);

    if (taskError || !tasks) return;

    const totalCount = tasks.length;
    const doneCount = tasks.filter((t: any) => t.column_id === doneColId).length;

    const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    // 4. Persist progress to projects table
    await supabase
      .from("projects")
      .update({ progress })
      .eq("id", projectId);
  } catch (err) {
    console.error("Error in syncProjectProgress:", err);
  }
}

/**
 * Fetch all Kanban columns and tasks for a project.
 * Tasks are nested within their respective columns, sorted by position.
 */
export async function getKanbanData(projectId: string) {
  const supabase = await createClient();

  // Fetch columns with nested tasks and assignee profiles
  const { data: columns, error: colError } = await supabase
    .from("kanban_columns")
    .select("*")
    .eq("project_id", projectId)
    .order("position");

  if (colError) throw new Error(colError.message);

  const { data: tasks, error: taskError } = await supabase
    .from("tasks")
    .select("*, assignee:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url, email)")
    .eq("project_id", projectId)
    .order("position");

  if (taskError) throw new Error(taskError.message);

  // Nest tasks inside columns
  const columnsWithTasks = (columns || []).map((col: any) => ({
    ...col,
    tasks: (tasks || []).filter((task: any) => task.column_id === col.id),
  }));

  return columnsWithTasks;
}

/**
 * Create a new task card
 */
export async function createTask(data: {
  project_id: string;
  column_id: string;
  title: string;
  description?: string;
  priority?: string;
  assigned_to?: string | null;
  due_date?: string | null;
  start_date?: string | null;
  estimated_hours?: number | null;
  labels?: string[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Get the max position in the target column
  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", data.column_id)
    .order("position", { ascending: false })
    .limit(1) as any;

  const nextPosition = (existingTasks?.[0]?.position ?? -1) + 1;

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      project_id: data.project_id,
      column_id: data.column_id,
      title: data.title,
      description: data.description || null,
      priority: (data.priority as "low" | "medium" | "high" | "urgent") || "medium",
      position: nextPosition,
      assigned_to: data.assigned_to || null,
      due_date: data.due_date || null,
      start_date: data.start_date || null,
      estimated_hours: data.estimated_hours || null,
      labels: data.labels || [],
      created_by: user.id,
    } as any)
    .select("*, assignee:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url, email)")
    .single() as any;

  if (error) return { error: error.message };

  // Notify assignee if assigned to someone else
  if (task && data.assigned_to && data.assigned_to !== user.id) {
    try {
      await supabase.from("notifications").insert({
        user_id: data.assigned_to,
        title: "Yeni Görev Atandı",
        message: `Size yeni bir görev atandı: "${task.title}"`,
        type: "task",
        action_url: `/projects/${data.project_id}`,
      } as any);
    } catch (notifErr) {
      console.error("Error creating task assignment notification:", notifErr);
    }
  }

  // Sync project progress
  await syncProjectProgress(supabase, data.project_id);

  // Log activity
  try {
    const { data: proj } = await supabase.from("projects").select("name").eq("id", data.project_id).single() as any;
    await logActivity(`yeni bir görev oluşturdu: "${task.title}"`, "task", task.id, { projectName: proj?.name || "Proje" });
  } catch (err) {
    console.error(err);
  }

  revalidatePath(`/projects/${data.project_id}`);
  return { data: task };
}

/**
 * Update an existing task
 */
export async function updateTask(
  taskId: string,
  projectId: string,
  updates: {
    title?: string;
    description?: string | null;
    priority?: string;
    assigned_to?: string | null;
    due_date?: string | null;
    start_date?: string | null;
    estimated_hours?: number | null;
    labels?: string[];
    column_id?: string;
  }
) {
  const supabase = await createClient();

  // Fetch old task to check assignment change
  let oldTask: any = null;
  try {
    const { data } = await supabase
      .from("tasks")
      .select("assigned_to, title")
      .eq("id", taskId)
      .single() as any;
    oldTask = data;
  } catch (err) {
    console.error("Error fetching old task for notification:", err);
  }

  const { error } = await (supabase
    .from("tasks") as any)
    .update(updates)
    .eq("id", taskId);

  if (error) return { error: error.message };

  // Notify new assignee if assignment changed and it's not the current user reassigning to themselves
  if (updates.assigned_to && updates.assigned_to !== oldTask?.assigned_to) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && updates.assigned_to !== user.id) {
        await supabase.from("notifications").insert({
          user_id: updates.assigned_to,
          title: "Yeni Görev Atandı",
          message: `Size yeni bir görev atandı: "${updates.title || oldTask?.title || 'Görev'}"`,
          type: "task",
          action_url: `/projects/${projectId}`,
        } as any);
      }
    } catch (notifErr) {
      console.error("Error creating task assignment notification:", notifErr);
    }
  }

  // Sync project progress
  await syncProjectProgress(supabase, projectId);

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

/**
 * Move a task to a new column and/or position.
 * This is the core of the drag-and-drop operation.
 */
export async function moveTask(
  taskId: string,
  newColumnId: string,
  newPosition: number,
  projectId: string
) {
  const supabase = await createClient();

  const { error } = await (supabase
    .from("tasks") as any)
    .update({
      column_id: newColumnId,
      position: newPosition,
    })
    .eq("id", taskId);

  if (error) return { error: error.message };

  // Sync project progress
  await syncProjectProgress(supabase, projectId);

  // Log activity
  try {
    const { data: proj } = await supabase.from("projects").select("name").eq("id", projectId).single() as any;
    const { data: col } = await supabase.from("kanban_columns").select("title").eq("id", newColumnId).single() as any;
    const { data: task } = await supabase.from("tasks").select("title").eq("id", taskId).single() as any;
    await logActivity(`"${task?.title || 'Görev'}" görevini "${col?.title || 'Kolon'}" sütununa taşıdı`, "task", taskId, { projectName: proj?.name || "Proje" });
  } catch (err) {
    console.error(err);
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

/**
 * Batch-update positions for multiple tasks in a column.
 * Used after a drag-and-drop reorder to fix positions.
 */
export async function reorderTasks(
  tasks: { id: string; position: number; column_id: string }[],
  projectId: string
) {
  const supabase = await createClient();

  // Use parallel updates for performance
  const updates = tasks.map((task) =>
    (supabase
      .from("tasks") as any)
      .update({ position: task.position, column_id: task.column_id })
      .eq("id", task.id)
  );

  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error);

  if (firstError?.error) return { error: firstError.error.message };

  // Sync project progress
  await syncProjectProgress(supabase, projectId);

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId);

  if (error) return { error: error.message };

  // Sync project progress
  await syncProjectProgress(supabase, projectId);

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

/**
 * Fetch all team members (profiles) for task assignment
 */
export async function getTeamMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email, role")
    .in("role", ["owner", "admin", "member"])
    .order("full_name");

  if (error) throw new Error(error.message);
  return data;
}
