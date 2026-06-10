import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { redirect } from "next/navigation";
import { GlobalNotificationListener } from "@/components/providers/global-notification-listener";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, email, role")
    .eq("id", user.id)
    .single() as any;

  if (!profile) {
    redirect("/login");
  }


  if (profile?.role === "client") {
    redirect("/portal");
  }

  return (
    <>
      <GlobalNotificationListener userId={user.id} />
      <DashboardShell userProfile={profile}>
        {children}
      </DashboardShell>
    </>
  );
}
