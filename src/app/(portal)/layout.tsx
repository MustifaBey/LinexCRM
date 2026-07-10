import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { GlobalNotificationListener } from "@/components/providers/global-notification-listener";

export const dynamic = "force-dynamic";

interface PortalLayoutProps {
  children: React.ReactNode;
}

export default async function PortalLayout({ children }: PortalLayoutProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single() as any;

  if (!profile) {
    redirect("/login");
  }

  return (
    <>
      <GlobalNotificationListener userId={user.id} />
      <PortalShell userProfile={profile}>
        {children}
      </PortalShell>
    </>
  );
}
