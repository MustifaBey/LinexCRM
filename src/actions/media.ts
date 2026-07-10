"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { MediaFile, MediaAnnotation } from "@/types/database";
import { logActivity } from "./activity";

/**
 * Helper to notify project members, creator, and client of media activities
 */
async function notifyProjectMembers({
  projectId,
  excludeUserId,
  title,
  message,
  type = "info",
  actionUrl,
}: {
  projectId: string;
  excludeUserId: string;
  title: string;
  message: string;
  type?: "info" | "warning" | "error" | "success";
  actionUrl?: string;
}) {
  const supabase = await createClient();

  const userIdsToNotify = new Set<string>();

  // 1. Get project members
  const { data: members } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  if (members) {
    (members as any[]).forEach((m) => {
      if (m && typeof m.user_id === "string") {
        userIdsToNotify.add(m.user_id);
      }
    });
  }

  // 2. Get project creator
  const { data: project } = await supabase
    .from("projects")
    .select("created_by, client_id")
    .eq("id", projectId)
    .single() as any;

  if (project?.created_by) {
    userIdsToNotify.add(project.created_by);
  }

  // 3. Get client associated with project
  if (project?.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("portal_user_id")
      .eq("id", project.client_id)
      .single() as any;

    if (client?.portal_user_id) {
      userIdsToNotify.add(client.portal_user_id);
    }
  }

  // Exclude the user who triggered the action
  userIdsToNotify.delete(excludeUserId);

  if (userIdsToNotify.size === 0) return;

  const notifications = Array.from(userIdsToNotify).map((userId) => ({
    user_id: userId,
    title,
    message,
    type,
    action_url: actionUrl || null,
  }));

  await supabase.from("notifications").insert(notifications as any);
}

/**
 * Fetch all media files. If projectId is provided, filter by project.
 * Groups by version history so we only return the LATEST file in each chain.
 */
export async function getMediaFiles(options?: {
  page?: number;
  limit?: number;
  projectId?: string;
  clientId?: string;
  status?: string;
  search?: string;
  sortBy?: string;
}) {
  const page = options?.page || 1;
  const limit = options?.limit || 12;
  const projectId = options?.projectId;
  const clientId = options?.clientId;
  const status = options?.status;
  const search = options?.search;
  const sortBy = options?.sortBy || "newest";

  const supabase = await createClient();

  // Try querying from the view first
  let query = supabase
    .from("latest_media_files")
    .select("*, uploader:profiles(*), project:projects(name), client:clients(name)", { count: "exact" });

  if (projectId && projectId !== "all") {
    query = query.eq("project_id", projectId);
  }
  if (clientId && clientId !== "all") {
    query = query.eq("client_id", clientId);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (search && search.trim()) {
    query = query.ilike("file_name", `%${search.trim()}%`);
  }

  // Sorting
  if (sortBy === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else if (sortBy === "largest") {
    query = query.order("file_size", { ascending: false });
  } else if (sortBy === "smallest") {
    query = query.order("file_size", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  // Fallback: If view does not exist yet (relation "latest_media_files" does not exist)
  if (error && (error.code === "PGRST204" || error.message.includes("latest_media_files") || error.code === "42P01")) {
    console.warn("View 'latest_media_files' not found. Falling back to in-memory version filtering.");
    
    // Fetch all files from table
    let fallbackQuery = supabase
      .from("media_files")
      .select("*, uploader:profiles(*), project:projects(name), client:clients(name)");

    if (projectId && projectId !== "all") {
      fallbackQuery = fallbackQuery.eq("project_id", projectId);
    }
    if (clientId && clientId !== "all") {
      fallbackQuery = fallbackQuery.eq("client_id", clientId);
    }
    if (status && status !== "all") {
      fallbackQuery = fallbackQuery.eq("status", status);
    }

    const { data: allData, error: fallbackError } = await fallbackQuery;
    if (fallbackError) {
      return { error: fallbackError.message, data: null, count: 0 };
    }

    let files = (allData || []) as any[];

    // In-memory filter for latest version in version chain
    files = files.filter(
      (file) => !files.some((other) => other.parent_file_id === file.id)
    );

    // In-memory search filter
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      files = files.filter((f) => f.file_name?.toLowerCase().includes(q));
    }

    // In-memory sorting
    files.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();

      if (sortBy === "oldest") return dateA - dateB;
      if (sortBy === "largest") return b.file_size - a.file_size;
      if (sortBy === "smallest") return a.file_size - b.file_size;
      return dateB - dateA; // newest
    });

    const totalCount = files.length;
    const paginatedFiles = files.slice(from, from + limit);

    return { data: paginatedFiles, error: null, count: totalCount };
  }

  if (error) {
    return { error: error.message, data: null, count: 0 };
  }

  return { data: data || [], error: null, count: count || 0 };
}

/**
 * Get media file detail including uploader, annotations (with authors),
 * and the complete version lineage tree (V1 -> V2 -> V3) sorted.
 */
export async function getMediaFileDetail(fileId: string) {
  const supabase = await createClient();

  // 1. Fetch file with uploader profile and project details
  const { data: file, error } = await supabase
    .from("media_files")
    .select("*, uploader:profiles(*), project:projects(name), client:clients(name)")
    .eq("id", fileId)
    .single();

  if (error || !file) {
    return { error: error?.message || "File not found", data: null };
  }

  const typedFile = file as MediaFile & { project?: { name: string }; client?: { name: string } };

  // 2. Fetch annotations with author profiles
  const { data: annotations } = await supabase
    .from("media_annotations")
    .select("*, author:profiles(*)")
    .eq("media_file_id", fileId)
    .order("created_at", { ascending: true });

  typedFile.annotations = (annotations || []) as MediaAnnotation[];

  // 3. Fetch all files for this project/client to reconstruct version lineage
  let lineageQuery = supabase
    .from("media_files")
    .select("*, uploader:profiles(*)");

  if (typedFile.project_id) {
    lineageQuery = (lineageQuery as any).eq("project_id", typedFile.project_id);
  } else if (typedFile.client_id) {
    lineageQuery = (lineageQuery as any).eq("client_id", typedFile.client_id);
  } else {
    // If both are null, we cannot query other files in lineage
    lineageQuery = (lineageQuery as any).eq("id", typedFile.id);
  }

  const { data: projectFiles } = await lineageQuery as any;

  let lineage: MediaFile[] = [];

  if (projectFiles) {
    const filesMap = new Map<string, MediaFile>();
    projectFiles.forEach((f: any) => filesMap.set(f.id, f as any));

    // Trace all parents up to the root
    let root = typedFile;
    while (root.parent_file_id && filesMap.has(root.parent_file_id)) {
      root = filesMap.get(root.parent_file_id)!;
    }

    // Now walk forward from root to collect the chain
    let current: MediaFile | undefined = root;
    while (current) {
      lineage.push(current);
      // Find the file that lists the current file as its parent_file_id
      current = projectFiles.find((f: any) => f.parent_file_id === current!.id) as any;
    }
  }

  return {
    data: {
      file: typedFile,
      lineage,
    },
    error: null,
  };
}

/**
 * Save uploaded file metadata to the database.
 * If parent_file_id is provided, automatically increments the version.
 */
export async function createMediaFile(data: {
  project_id?: string | null;
  client_id?: string | null;
  file_name: string;
  file_path: string;
  thumbnail_path?: string | null;
  file_type: string;
  file_size: number;
  parent_file_id: string | null;
}) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required" };
    }

    let version = 1;

    // Determine version number if a parent file is defined
    if (data.parent_file_id) {
      const { data: parent } = await supabase
        .from("media_files")
        .select("version")
        .eq("id", data.parent_file_id)
        .single() as any;

      if (parent) {
        version = parent.version + 1;
      }
    }

    const { data: newFile, error } = await supabase
      .from("media_files")
      .insert({
        project_id: data.project_id || null,
        client_id: data.client_id || null,
        file_name: data.file_name,
        file_path: data.file_path,
        thumbnail_path: data.thumbnail_path || null,
        file_type: data.file_type,
        file_size: data.file_size,
        parent_file_id: data.parent_file_id,
        version,
        status: "uploaded",
        uploaded_by: user.id,
      } as any)
      .select()
      .single() as any;

    if (error) {
      return { error: error.message };
    }

    // Trigger project members notification
    if (data.project_id) {
      await notifyProjectMembers({
        projectId: data.project_id,
        excludeUserId: user.id,
        title: "New File Uploaded",
        message: `A new version (V${version}) of "${data.file_name}" was uploaded to the project.`,
        type: "info",
        actionUrl: `/media/${newFile.id}`,
      });
    }

    // Log activity
    try {
      let projectName = "Proje";
      if (data.project_id) {
        const { data: proj } = await supabase.from("projects").select("name").eq("id", data.project_id).single() as any;
        projectName = proj?.name || "Proje";
      } else if (data.client_id) {
        const { data: cl } = await supabase.from("clients").select("name").eq("id", data.client_id).single() as any;
        projectName = cl?.name || "Müşteri";
      }
      await logActivity(`yeni bir medya dosyası yükledi: "${data.file_name}"`, "media", newFile.id, { projectName });
    } catch (err) {
      console.error(err);
    }

    revalidatePath("/media");
    revalidatePath(`/media/${newFile.id}`);
    if (data.client_id) {
      revalidatePath(`/clients/${data.client_id}`);
    }

    return { data: newFile, error: null };
  } catch (error: unknown) {
    console.error("createMediaFile error in production:", error);
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Dosya kaydı oluşturulurken hata oluştu: ${message}` };
  }
}

/**
 * Update media approval status ('uploaded' | 'in_review' | 'approved' | 'rejected')
 */
export async function updateMediaStatus(
  fileId: string,
  status: "uploaded" | "in_review" | "approved" | "rejected"
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  // Get current file detail to notify the uploader
  const { data: file } = await supabase
    .from("media_files")
    .select("file_name, project_id, uploaded_by, version")
    .eq("id", fileId)
    .single() as any;

  if (!file) {
    return { error: "File not found" };
  }

  const { error } = await (supabase
    .from("media_files") as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", fileId);

  if (error) {
    return { error: error.message };
  }

  // Notify members about status change
  let statusText = "updated";
  let notifType: "info" | "success" | "error" = "info";

  if (status === "approved") {
    statusText = "APPROVED";
    notifType = "success";
  } else if (status === "rejected") {
    statusText = "REJECTED";
    notifType = "error";
  } else if (status === "in_review") {
    statusText = "marked as IN REVIEW";
  }

  await notifyProjectMembers({
    projectId: file.project_id,
    excludeUserId: user.id,
    title: `File Status Updated`,
    message: `"${file.file_name}" (V${file.version}) was ${statusText}.`,
    type: notifType,
    actionUrl: `/media/${fileId}`,
  });

  // Always notify the uploader specifically if someone else changed it
  if (file.uploaded_by !== user.id) {
    await supabase.from("notifications").insert({
      user_id: file.uploaded_by,
      title: `Your upload was ${statusText}`,
      message: `Your file "${file.file_name}" (V${file.version}) was marked as ${status}.`,
      type: notifType,
      action_url: `/media/${fileId}`,
    } as any);
  }

  revalidatePath("/media");
  revalidatePath(`/media/${fileId}`);

  return { success: true };
}

/**
 * Delete a media file record and its corresponding storage object
 */
export async function deleteMediaFile(fileId: string) {
  const supabase = await createClient();

  const { data: file } = await supabase
    .from("media_files")
    .select("file_path, thumbnail_path, project_id")
    .eq("id", fileId)
    .single() as any;

  if (!file) {
    return { error: "File not found" };
  }

  // 1. Delete from Supabase Storage
  const pathsToRemove = [file.file_path];
  if (file.thumbnail_path) {
    pathsToRemove.push(file.thumbnail_path);
  }

  const { error: storageError } = await supabase.storage
    .from("media")
    .remove(pathsToRemove);

  if (storageError) {
    console.warn("Storage deletion error: ", storageError.message);
  }

  // 2. Delete database record (RLS and cascade deletes annotations)
  const { error: dbError } = await supabase
    .from("media_files")
    .delete()
    .eq("id", fileId);

  if (dbError) {
    return { error: dbError.message };
  }

  revalidatePath("/media");

  return { success: true };
}

/**
 * Create a visual annotation pin comment on an image
 */
export async function createAnnotation(data: {
  media_file_id: string;
  x_percent: number;
  y_percent: number;
  comment: string;
}) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  // Fetch user role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as any;

  const isClient = profile?.role === "client";

  // Fetch file info for notification routing (and authorization)
  const { data: file } = await supabaseAdmin
    .from("media_files")
    .select("file_name, project_id, uploaded_by, version")
    .eq("id", data.media_file_id)
    .single() as any;

  if (!file) {
    return { error: "File not found" };
  }

  // Enforce client authorization check
  if (isClient) {
    const { data: clients } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("portal_user_id", user.id) as any;

    const clientIds = clients?.map((c: any) => c.id) || [];
    clientIds.push(user.id);

    // Fetch projects for these clients to see if they own the media project
    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id")
      .in("client_id", clientIds) as any;

    const clientProjectIds = projects?.map((p: any) => p.id) || [];

    if (!clientProjectIds.includes(file.project_id)) {
      return { error: "Unauthorized access to this project media" };
    }
  }

  // Insert annotation using admin client to bypass RLS restrictions if they exist
  const { data: annotation, error } = await supabaseAdmin
    .from("media_annotations")
    .insert({
      media_file_id: data.media_file_id,
      x_percent: data.x_percent,
      y_percent: data.y_percent,
      comment: data.comment,
      is_resolved: false,
      created_by: user.id,
    } as any)
    .select()
    .single() as any;

  if (error) {
    return { error: error.message };
  }

  // Trigger project members notification
  await notifyProjectMembers({
    projectId: file.project_id,
    excludeUserId: user.id,
    title: "New Design Comment",
    message: `New pin comment on "${file.file_name}" (V${file.version}): "${
      data.comment.length > 40 ? data.comment.substring(0, 37) + "..." : data.comment
    }"`,
    type: "info",
    actionUrl: `/media/${data.media_file_id}`,
  });

  // Notify the uploader directly if someone else left a comment
  if (file.uploaded_by !== user.id) {
    await supabaseAdmin.from("notifications").insert({
      user_id: file.uploaded_by,
      title: "New feedback on your design",
      message: `Someone commented on "${file.file_name}" (V${file.version}).`,
      type: "info",
      action_url: `/media/${data.media_file_id}`,
    } as any);
  }

  revalidatePath(`/media/${data.media_file_id}`);
  revalidatePath(`/portal/media/${data.media_file_id}`);

  return { data: annotation, error: null };
}

/**
 * Toggle resolve status on an annotation pin comment
 */
export async function resolveAnnotation(annotationId: string, isResolved: boolean) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  // Fetch user role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as any;

  const isClient = profile?.role === "client";

  // Fetch annotation info to get the media file and check project
  const { data: annotation } = await supabaseAdmin
    .from("media_annotations")
    .select("media_file_id, created_by")
    .eq("id", annotationId)
    .single() as any;

  if (!annotation) {
    return { error: "Annotation not found" };
  }

  if (isClient) {
    // Check if client owns this media file's project
    const { data: file } = await supabaseAdmin
      .from("media_files")
      .select("project_id")
      .eq("id", annotation.media_file_id)
      .single() as any;

    if (!file) {
      return { error: "File not found" };
    }

    const { data: clients } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("portal_user_id", user.id) as any;

    const clientIds = clients?.map((c: any) => c.id) || [];
    clientIds.push(user.id);

    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id")
      .in("client_id", clientIds) as any;

    const clientProjectIds = projects?.map((p: any) => p.id) || [];

    if (!clientProjectIds.includes(file.project_id)) {
      return { error: "Unauthorized access to this project media annotation" };
    }
  }

  const { error } = await (supabaseAdmin
    .from("media_annotations") as any)
    .update({ is_resolved: isResolved })
    .eq("id", annotationId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

/**
 * Delete an annotation pin comment
 */
export async function deleteAnnotation(annotationId: string) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  // Fetch user role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as any;

  const isClient = profile?.role === "client";

  // Fetch annotation info to check creator/project
  const { data: annotation } = await supabaseAdmin
    .from("media_annotations")
    .select("media_file_id, created_by")
    .eq("id", annotationId)
    .single() as any;

  if (!annotation) {
    return { error: "Annotation not found" };
  }

  // Check authorization:
  // If client, they can only delete their OWN annotations on their projects
  if (isClient) {
    if (annotation.created_by !== user.id) {
      return { error: "Unauthorized to delete this annotation" };
    }

    // Verify project belongs to client
    const { data: file } = await supabaseAdmin
      .from("media_files")
      .select("project_id")
      .eq("id", annotation.media_file_id)
      .single() as any;

    if (!file) {
      return { error: "File not found" };
    }

    const { data: clients } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("portal_user_id", user.id) as any;

    const clientIds = clients?.map((c: any) => c.id) || [];
    clientIds.push(user.id);

    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id")
      .in("client_id", clientIds) as any;

    const clientProjectIds = projects?.map((p: any) => p.id) || [];

    if (!clientProjectIds.includes(file.project_id)) {
      return { error: "Unauthorized access to this project media annotation" };
    }
  } else {
    // If agency member/staff, they can delete their own annotations or any annotation if they are admin/owner
    const isStaffOrAdmin = ["owner", "admin", "member"].includes(profile?.role);
    if (!isStaffOrAdmin) {
      return { error: "Unauthorized" };
    }

    const isAdmin = ["owner", "admin"].includes(profile?.role);
    if (!isAdmin && annotation.created_by !== user.id) {
      return { error: "Unauthorized to delete other users' annotations" };
    }
  }

  const { error } = await supabaseAdmin
    .from("media_annotations")
    .delete()
    .eq("id", annotationId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

/**
 * Fetch paginated media files for the Client Portal.
 * Supports filtering by client project IDs.
 */
export async function getPortalMediaFiles(options?: {
  page?: number;
  limit?: number;
  projectIds?: string[];
}) {
  const page = options?.page || 1;
  const limit = options?.limit || 6;
  const projectIds = options?.projectIds;

  const supabase = await createClient();

  // Query from latest_media_files view for version filtering
  let query = supabase
    .from("latest_media_files")
    .select("*, project:projects(name)", { count: "exact" });

  if (projectIds && projectIds.length > 0) {
    query = query.in("project_id", projectIds);
  }

  query = query.order("created_at", { ascending: false });

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  // Fallback if view doesn't exist yet
  if (error && (error.code === "PGRST204" || error.message.includes("latest_media_files") || error.code === "42P01")) {
    console.warn("View 'latest_media_files' not found. Falling back to in-memory version filtering for portal.");
    
    let fallbackQuery = supabase
      .from("media_files")
      .select("*, project:projects(name)");

    if (projectIds && projectIds.length > 0) {
      fallbackQuery = fallbackQuery.in("project_id", projectIds);
    }

    const { data: allData, error: fallbackError } = await fallbackQuery;
    if (fallbackError) {
      return { error: fallbackError.message, data: null, count: 0 };
    }

    let files: any[] = (allData as any[]) || [];
    // Filter latest version
    files = files.filter(
      (file) => !files.some((other) => other.parent_file_id === file.id)
    );

    // Sort by created_at desc
    files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalCount = files.length;
    const paginatedFiles = files.slice(from, from + limit);

    return { data: paginatedFiles, error: null, count: totalCount };
  }

  if (error) {
    return { error: error.message, data: null, count: 0 };
  }

  return { data: data || [], error: null, count: count || 0 };
}
