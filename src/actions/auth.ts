"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/**
 * Sign in with email and password
 */
export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}

/**
 * Sign up with email, password, and full name
 */
export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || "",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data?.user) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminSupabase = createAdminClient();
    await (adminSupabase
      .from("profiles") as any)
      .update({ role: "client" })
      .eq("id", data.user.id);
  }

  redirect("/");
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Update current user's profile details (full_name and avatar_url)
 */
export async function updateProfile(data: { full_name: string | null; avatar_url: string | null }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Kimlik doğrulaması gerekiyor." };
    }

    // 1. Update profiles table
    const { error: dbError } = await (supabase
      .from("profiles") as any)
      .update({
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (dbError) {
      return { error: dbError.message };
    }

    // 2. Update Supabase Auth user metadata
    const { error: authError } = await supabase.auth.updateUser({
      data: {
        full_name: data.full_name,
        avatar_url: data.avatar_url,
      },
    });

    if (authError) {
      return { error: authError.message };
    }

    // 3. Revalidate globally
    revalidatePath("/", "layout");

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Profil güncellenirken bir hata oluştu." };
  }
}
