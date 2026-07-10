"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { VaultCredential } from "@/types/database";
import { logActivity } from "./activity";

/**
 * Helper function to enforce owner/admin role verification
 */
async function verifyAdminAccess() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as any;

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    throw new Error("Access denied. Admin role required.");
  }

  return user.id;
}

/**
 * Fetch all vault credentials, joining their client profiles.
 */
export async function getVaultCredentials() {
  try {
    await verifyAdminAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("vault_credentials")
      .select("*, client:clients(id, name, company, logo_url)")
      .order("created_at", { ascending: false }) as any;

    if (error) {
      return { error: error.message, data: null };
    }

    return { data: data as (VaultCredential & { client?: { id: string; name: string; company: string | null; logo_url: string | null } })[], error: null };
  } catch (err: any) {
    return { error: err.message || "Failed to retrieve credentials", data: null };
  }
}

/**
 * Log a new credential inside the vault
 */
export async function createVaultCredential(data: {
  client_id: string;
  label: string;
  credential_type: "cpanel" | "wordpress" | "ftp" | "vercel" | "hosting" | "domain_registrar" | "email" | "social_media" | "other";
  url?: string | null;
  username_encrypted: string;
  password_encrypted: string;
  notes_encrypted?: string | null;
}) {
  try {
    const userId = await verifyAdminAccess();
    const supabase = await createClient();

    const { data: newRecord, error } = await supabase
      .from("vault_credentials")
      .insert({
        client_id: data.client_id,
        label: data.label.trim(),
        credential_type: data.credential_type,
        url: data.url?.trim() || null,
        username_encrypted: data.username_encrypted,
        password_encrypted: data.password_encrypted,
        notes_encrypted: data.notes_encrypted || null,
        created_by: userId,
      } as any)
      .select()
      .single() as any;

    if (error) {
      return { error: error.message };
    }

    // Log activity
    try {
      await logActivity(`yeni bir kasa kaydı ekledi: "${data.label}"`, "vault", newRecord.id, { projectName: "Şifre Kasası" });
    } catch (err) {
      console.error(err);
    }

    revalidatePath("/vault");
    return { data: newRecord, error: null };
  } catch (err: any) {
    return { error: err.message || "Failed to save credential" };
  }
}

/**
 * Update existing credentials in the vault
 */
export async function updateVaultCredential(
  id: string,
  updates: Partial<{
    client_id: string;
    label: string;
    credential_type: "cpanel" | "wordpress" | "ftp" | "vercel" | "hosting" | "domain_registrar" | "email" | "social_media" | "other";
    url: string | null;
    username_encrypted: string;
    password_encrypted: string;
    notes_encrypted: string | null;
  }>
) {
  try {
    await verifyAdminAccess();
    const supabase = await createClient();

    const { error } = await (supabase
      .from("vault_credentials") as any)
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/vault");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update credential" };
  }
}

/**
 * Delete a credential from the vault
 */
export async function deleteVaultCredential(id: string) {
  try {
    await verifyAdminAccess();
    const supabase = await createClient();

    const { error } = await supabase
      .from("vault_credentials")
      .delete()
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/vault");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to delete credential" };
  }
}
