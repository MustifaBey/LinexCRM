"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Fetch the latest 5 activities from the activity_log table.
 * Joins with the profiles table to get the user's name.
 */
export async function getRecentActivities() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activity_log")
    .select(`
      id,
      action,
      entity_type,
      entity_id,
      metadata,
      created_at,
      profiles (
        full_name,
        email
      )
    ` as any)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error in getRecentActivities:", error.message);
    return [];
  }

  // Format activities to match UI requirements
  return (data || []).map((item: any) => {
    const userName = item.profiles?.full_name || item.profiles?.email || "Bir kullanıcı";
    return {
      id: item.id,
      action: `${userName} - ${item.action}`,
      project: item.metadata?.projectName || item.entity_type,
      time: item.created_at,
      type: item.entity_type,
    };
  });
}

/**
 * Insert a new activity log entry
 */
export async function logActivity(
  action: string,
  entityType: string,
  entityId: string,
  metadata: any = {}
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("activity_log").insert({
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    } as any);

    revalidatePath("/");
  } catch (err) {
    console.error("Error in logActivity:", err);
  }
}
