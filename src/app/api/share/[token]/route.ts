import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const supabase = await createClient();

  // Fetch the share link
  const { data: share, error } = await supabase
    .from("media_shares")
    .select(`
      *,
      file:media_files (
        file_path,
        file_name
      )
    `)
    .eq("token", token)
    .single() as any;

  if (error || !share) {
    return new NextResponse(
      "<html><body style='font-family:sans-serif; text-align:center; padding-top:50px;'><h2>Geçersiz Bağlantı</h2><p>Paylaşım bağlantısı bulunamadı veya geçersiz.</p></body></html>",
      { 
        status: 404, 
        headers: { "Content-Type": "text/html; charset=utf-8" } 
      }
    );
  }

  // Check expiration
  const expiresAt = new Date(share.expires_at);
  if (expiresAt < new Date()) {
    return new NextResponse(
      "<html><body style='font-family:sans-serif; text-align:center; padding-top:50px;'><h2>Süresi Dolmuş Bağlantı</h2><p>Bu paylaşım bağlantısının geçerlilik süresi sona ermiştir.</p></body></html>",
      { 
        status: 410, 
        headers: { "Content-Type": "text/html; charset=utf-8" } 
      }
    );
  }

  if (!share.file?.file_path) {
    return new NextResponse(
      "<html><body style='font-family:sans-serif; text-align:center; padding-top:50px;'><h2>Dosya Bulunamadı</h2><p>İstenen dosya sistemde mevcut değil.</p></body></html>",
      { 
        status: 404, 
        headers: { "Content-Type": "text/html; charset=utf-8" } 
      }
    );
  }

  // Generate a signed URL valid for 60 seconds
  const { data: signedData, error: signedError } = await supabase.storage
    .from("media")
    .createSignedUrl(share.file.file_path, 60);

  if (signedError || !signedData?.signedUrl) {
    return new NextResponse(
      "<html><body style='font-family:sans-serif; text-align:center; padding-top:50px;'><h2>Bağlantı Hatası</h2><p>Güvenli dosya indirme bağlantısı oluşturulamadı.</p></body></html>",
      { 
        status: 500, 
        headers: { "Content-Type": "text/html; charset=utf-8" } 
      }
    );
  }

  // Redirect to the signed URL
  return NextResponse.redirect(signedData.signedUrl);
}
