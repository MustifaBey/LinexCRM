import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMediaFile } from "@/actions/media";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // 2. Parse request payload
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const thumbnailFile = formData.get("thumbnail") as File | null;
    const projectId = formData.get("project_id") as string | null;
    const clientId = formData.get("client_id") as string | null;
    const parentFileId = formData.get("parent_file_id") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Eksik parametre: file parametresi bulunamadı." },
        { status: 400 }
      );
    }

    // 3. Prepare file paths
    const fileExt = file.name.split(".").pop() || "";
    // Clean name from special chars
    const cleanName = file.name
      .replace(/\.[^/.]+$/, "") // remove extension
      .replace(/[^a-zA-Z0-9]/g, "_");
    
    const timestamp = Date.now();
    const folder = projectId || clientId || "general";
    
    const filePath = `${folder}/${timestamp}_${cleanName}.${fileExt}`
      .replace(/^\/+/, "")
      .replace(/\/+/g, "/");
      
    const thumbPath = `${folder}/${timestamp}_${cleanName}_thumb.webp`
      .replace(/^\/+/, "")
      .replace(/\/+/g, "/");

    // 4. Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Upload original file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(filePath, buffer, {
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Orijinal dosya yüklenirken hata: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 6. If thumbnail was generated client-side, upload it
    let thumbnailPath: string | null = null;
    if (thumbnailFile) {
      try {
        const thumbArrayBuffer = await thumbnailFile.arrayBuffer();
        const thumbBuffer = Buffer.from(thumbArrayBuffer);

        const { error: thumbUploadError } = await supabase.storage
          .from("media")
          .upload(thumbPath, thumbBuffer, {
            contentType: "image/webp",
            cacheControl: "3600",
            upsert: false,
          });

        if (thumbUploadError) {
          throw new Error("Küçük resim Storage'a yüklenemedi: " + thumbUploadError.message);
        }

        thumbnailPath = thumbPath;
      } catch (thumbError: any) {
        console.error("Thumbnail upload failed:", thumbError);
        // Abort: delete original file from storage and return 500 error
        await supabase.storage.from("media").remove([filePath]);
        return NextResponse.json(
          { error: `Yükleme Başarısız (Thumbnail Hatası): ${thumbError.message || thumbError}` },
          { status: 500 }
        );
      }
    }

    // 7. Create database record using Server Action
    const result = await createMediaFile({
      project_id: projectId || null,
      client_id: clientId || null,
      file_name: file.name,
      file_path: filePath,
      thumbnail_path: thumbnailPath,
      file_type: file.type || "application/octet-stream",
      file_size: file.size,
      parent_file_id: parentFileId || null,
    });

    if (result.error) {
      // Cleanup uploaded files in storage on db insert failure
      const pathsToRemove = [filePath];
      if (thumbnailPath) {
        pathsToRemove.push(thumbnailPath);
      }
      await supabase.storage.from("media").remove(pathsToRemove);

      return NextResponse.json(
        { error: `Veritabanı kaydı oluşturulurken hata: ${result.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: result.data }, { status: 200 });
  } catch (err: any) {
    console.error("API Upload handler error:", err);
    return NextResponse.json(
      { error: "Yükleme Başarısız" },
      { status: 500 }
    );
  }
}
