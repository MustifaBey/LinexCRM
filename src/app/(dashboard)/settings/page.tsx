import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Profil Ayarları",
};

export default async function SettingsPage() {
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
    .single();

  return (
    <SettingsForm initialProfile={profile} initialUser={user} />
  );
}
