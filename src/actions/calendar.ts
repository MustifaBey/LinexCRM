"use server";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getContentPosts(month: number, year: number) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("content_posts")
    .select(`
      *,
      project:projects (id, name)
    `)
    .order("publish_date", { ascending: true }) as any;

  if (error) console.error("FETCH ERROR:", error.message);
  console.log("FETCHED POSTS:", data);

  return data || [];
}

export async function createContentPost(data: {
  project_id?: string | null;
  publish_date: string;
  content: string;
  status: "draft" | "pending" | "published";
  image_url?: string | null;
}) {
  try {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

    const inputDate = new Date(data.publish_date);
    if (isNaN(inputDate.getTime())) {
      return { error: "Geçersiz tarih formatı." };
    }

    const safeIsoString = new Date(Date.UTC(
      inputDate.getFullYear(),
      inputDate.getMonth(),
      inputDate.getDate(),
      12, 0, 0
    )).toISOString();

    const safeProjectId = (!data.project_id || data.project_id === "" || data.project_id === "none") ? null : data.project_id;

    const { data: newPost, error } = await supabase
      .from("content_posts")
      .insert({
        project_id: safeProjectId,
        publish_date: safeIsoString,
        content: data.content,
        status: data.status,
        image_url: data.image_url || null,
        created_by: user.id,
      } as any)
      .select()
      .single() as any;

    if (error) return { error: error.message };

    revalidatePath("/calendar");
    revalidatePath("/portal");
    return { data: newPost };
  } catch (err: any) {
    console.error("CREATE POST ERROR:", err);
    return { error: err.message || "Bir hata oluştu." };
  }
}

export async function updateContentPost(
  id: string,
  data: {
    project_id?: string | null;
    publish_date?: string;
    content?: string;
    status?: "draft" | "pending" | "published";
    image_url?: string | null;
  }
) {
  try {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

    const updatePayload: any = { ...data };
    if ("project_id" in data) {
      const safeProjectId = (!data.project_id || data.project_id === "" || data.project_id === "none") ? null : data.project_id;
      updatePayload.project_id = safeProjectId;
    }

    if (data.publish_date) {
      const inputDate = new Date(data.publish_date);
      if (isNaN(inputDate.getTime())) {
        return { error: "Geçersiz tarih formatı." };
      }
      updatePayload.publish_date = new Date(Date.UTC(
        inputDate.getFullYear(),
        inputDate.getMonth(),
        inputDate.getDate(),
        12, 0, 0
      )).toISOString();
    }

    const { data: updatedPost, error } = await (supabase
      .from("content_posts") as any)
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single() as any;

    if (error) return { error: error.message };

    revalidatePath("/calendar");
    revalidatePath("/portal");
    return { data: updatedPost };
  } catch (err: any) {
    console.error("UPDATE POST ERROR:", err);
    return { error: err.message || "Bir hata oluştu." };
  }
}

export async function deleteContentPost(id: string) {
  try {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

    const { error } = await supabase
      .from("content_posts")
      .delete()
      .eq("id", id);

    if (error) return { error: error.message };

    revalidatePath("/calendar");
    revalidatePath("/portal");
    return { success: true };
  } catch (err: any) {
    console.error("DELETE POST ERROR:", err);
    return { error: err.message || "Bir hata oluştu." };
  }
}
