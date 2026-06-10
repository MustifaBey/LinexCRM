"use server";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createShareLink(fileId: string, expiresInHours: number) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  // Generate secure token
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  const { data, error } = await supabase
    .from("media_shares")
    .insert({
      file_id: fileId,
      token,
      expires_at: expiresAt.toISOString(),
    } as any)
    .select()
    .single() as any;

  if (error) return { error: error.message };

  revalidatePath("/media");
  return { data };
}

export async function getShareByToken(token: string) {
  const supabase = await createSupabaseClient();
  
  const { data, error } = await supabase
    .from("media_shares")
    .select(`
      *,
      file:media_files (
        id,
        file_name,
        file_path,
        file_type,
        file_size,
        status,
        project_id
      )
    `)
    .eq("token", token)
    .single() as any;

  if (error) return { error: "Paylaşım bağlantısı geçersiz." };

  // Check expiration
  const expiresAt = new Date(data.expires_at);
  if (expiresAt < new Date()) {
    return { error: "Paylaşım bağlantısının süresi dolmuş." };
  }

  return { data };
}
