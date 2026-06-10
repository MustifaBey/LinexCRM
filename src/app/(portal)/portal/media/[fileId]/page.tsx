import { createClient } from "@/lib/supabase/server";
import { getMediaFileDetail } from "@/actions/media";
import { MediaReviewPortal } from "@/components/media/review-portal";
import { redirect, notFound } from "next/navigation";

export const revalidate = 0; // Fresh details on load

interface ClientMediaDetailPageProps {
  params: Promise<{
    fileId: string;
  }>;
}

export default async function ClientMediaDetailPage({ params }: ClientMediaDetailPageProps) {
  const { fileId } = await params;
  const supabase = await createClient();

  // 1. Get current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch media details
  const result = await getMediaFileDetail(fileId);

  if (result.error || !result.data) {
    notFound();
  }

  // Double-check if the media belongs to the client's assigned projects
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as any;

  const isClient = profile?.role === "client";
  const isAdminOrStaff = profile
    ? ["owner", "admin", "member"].includes(profile.role)
    : false;

  if (isClient) {
    // Get client's projects
    const { data: clients } = await supabase
      .from("clients")
      .select("id")
      .eq("portal_user_id", user.id) as any;

    const clientIds = clients?.map((c: any) => c.id) || [];
    clientIds.push(user.id);

    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .in("client_id", clientIds) as any;

    const clientProjectIds = projects?.map((p: any) => p.id) || [];

    if (!clientProjectIds.includes(result.data.file.project_id)) {
      redirect("/portal"); // Unauthorized access
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <MediaReviewPortal
        initialFile={result.data.file as any}
        initialLineage={result.data.lineage}
        isAdminOrStaff={isAdminOrStaff}
        backUrl="/portal"
      />
    </div>
  );
}
