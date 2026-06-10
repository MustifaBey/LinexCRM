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
export async function getMediaFiles(projectId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from("media_files")
    .select("*, uploader:profiles(*), project:projects(name)");

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return { error: error.message, data: null };
  }

  const allFiles = (data || []) as (MediaFile & { project?: { name: string } })[];

  // Filter in memory to return only the latest version in each version chain.
  // A file is the latest if no other file has parent_file_id equal to its id.
  const latestFiles = allFiles.filter(
    (file) => !allFiles.some((other) => other.parent_file_id === file.id)
  );

  return { data: latestFiles, error: null };
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
    .select("*, uploader:profiles(*), project:projects(name)")
    .eq("id", fileId)
    .single();

  if (error || !file) {
    return { error: error?.message || "File not found", data: null };
  }

  const typedFile = file as MediaFile & { project?: { name: string } };

  // 2. Fetch annotations with author profiles
  const { data: annotations } = await supabase
    .from("media_annotations")
    .select("*, author:profiles(*)")
    .eq("media_file_id", fileId)
    .order("created_at", { ascending: true });

  typedFile.annotations = (annotations || []) as MediaAnnotation[];

  // 3. Fetch all files for this project to reconstruct version lineage
  const { data: projectFiles } = await supabase
    .from("media_files")
    .select("*, uploader:profiles(*)")
    .eq("project_id", typedFile.project_id) as any;

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
  project_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  parent_file_id: string | null;
}) {
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
      project_id: data.project_id,
      file_name: data.file_name,
      file_path: data.file_path,
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
  await notifyProjectMembers({
    projectId: data.project_id,
    excludeUserId: user.id,
    title: "New File Uploaded",
    message: `A new version (V${version}) of "${data.file_name}" was uploaded to the project.`,
    type: "info",
    actionUrl: `/media/${newFile.id}`,
  });

  // Log activity
  try {
    const { data: proj } = await supabase.from("projects").select("name").eq("id", data.project_id).single() as any;
    await logActivity(`yeni bir medya dosyası yükledi: "${data.file_name}"`, "media", newFile.id, { projectName: proj?.name || "Proje" });
  } catch (err) {
    console.error(err);
  }

  revalidatePath("/media");
  revalidatePath(`/media/${newFile.id}`);

  return { data: newFile, error: null };
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
    .select("file_path, project_id")
    .eq("id", fileId)
    .single() as any;

  if (!file) {
    return { error: "File not found" };
  }

  // 1. Delete from Supabase Storage
  const { error: storageError } = await supabase.storage
    .from("media")
    .remove([file.file_path]);

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
