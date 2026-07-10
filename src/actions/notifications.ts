"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Fetch all notifications for the current user
 */
export async function getNotifications() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required", data: [] };
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { error: error.message, data: [] };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    return { error: err.message || "Failed to load notifications", data: [] };
  }
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required" };
    }

    const { error } = await (supabase
      .from("notifications") as any)
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update notification" };
  }
}

/**
 * Mark all user notifications as read
 */
export async function markAllAsRead() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required" };
    }

    const { error } = await (supabase
      .from("notifications") as any)
      .update({ is_read: true })
      .eq("user_id", user.id);

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update notifications" };
  }
}
