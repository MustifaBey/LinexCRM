"use server";

import { createClient } from "@/lib/supabase/server";

export async function updateProfile(name: string, soundLevel: number, avatarUrl?: string | null) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: "Oturum bulunamadı!" };
    }

    const { error } = await (supabase.from('profiles') as any)
      .update({
        full_name: name,
        sound_volume: soundLevel,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (err: any) {
    return { error: err.message || "Güncelleme başarısız" };
  }
}
