import { createClient } from "@/lib/supabase/server";
import { getMediaFileDetail } from "@/actions/media";
import { MediaReviewPortal } from "@/components/media/review-portal";
import { redirect, notFound } from "next/navigation";

export const revalidate = 0; // Fresh details on load

interface MediaDetailPageProps {
  params: Promise<{
    fileId: string;
  }>;
}

export default async function MediaDetailPage({ params }: MediaDetailPageProps) {
  const { fileId } = await params;
  const supabase = await createClient();

  // 1. Get current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch user's profile role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as any;

  const isAdminOrStaff = profile
    ? ["owner", "admin", "member"].includes(profile.role)
    : false;

  // 3. Fetch media details
  const result = await getMediaFileDetail(fileId);

  if (result.error || !result.data) {
    notFound();
  }

  return (
    <MediaReviewPortal
      initialFile={result.data.file as any}
      initialLineage={result.data.lineage}
      isAdminOrStaff={isAdminOrStaff}
    />
  );
}
