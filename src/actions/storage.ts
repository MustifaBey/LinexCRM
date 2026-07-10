"use server";

import { createClient } from "@/lib/supabase/server";

export async function uploadFileToServer(formData: FormData) {
  try {
    const file = formData.get("file") as File | null;
    const bucket = formData.get("bucket") as string | null;
    const path = formData.get("path") as string | null;

    if (!file || !bucket || !path) {
      return { error: "Eksik parametreler: file, bucket veya path bulunamadı." };
    }

    const supabase = await createClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      return { error: error.message };
    }

    // Get public URL to return to client
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return { 
      data, 
      publicUrl: publicUrlData?.publicUrl || null, 
      error: null 
    };
  } catch (err: any) {
    console.error("Server-side upload error:", err);
    return { error: err.message || "Dosya yüklenirken sunucu hatası oluştu." };
  }
}

export async function deleteFileFromServer(bucket: string, path: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from(bucket).remove([path]);
    
    if (error) {
      return { error: error.message };
    }
    
    return { data, error: null };
  } catch (err: any) {
    console.error("Server-side delete error:", err);
    return { error: err.message || "Dosya silinirken sunucu hatası oluştu." };
  }
}
