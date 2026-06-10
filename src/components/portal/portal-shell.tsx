"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Hexagon,
  LogOut,
  User
} from "lucide-react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface PortalShellProps {
  userProfile: any;
  children: React.ReactNode;
}

export function PortalShell({ userProfile, children }: PortalShellProps) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Çıkış yapılırken hata oluştu.");
    } else {
      toast.success("Başarıyla çıkış yapıldı.");
      router.push("/login");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Premium Top Navigation */}
      <header className="h-16 border-b border-border bg-card/45 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-50 shadow-sm select-none">
        {/* Left: Logo */}
        <Link href="/portal" className="flex items-center shrink-0 hover:opacity-90 transition-all">
          <img src="/logo.png" alt="Linex Medya Logo" className="h-30 w-auto object-contain shrink-0" />
        </Link>

        {/* Right: User Profile + Tickets + Logout */}
        <div className="flex items-center gap-4">
          <Link
            href="/portal/tickets"
            className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-burgundy/10 border border-burgundy/20 hover:bg-burgundy/20 text-burgundy transition-all"
          >
            Destek Taleplerim
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-burgundy/10 border border-burgundy/20 flex items-center justify-center overflow-hidden shrink-0">
              {userProfile.avatar_url ? (
                <img src={userProfile.avatar_url} alt="" className="object-cover w-full h-full" />
              ) : (
                <User className="w-4 h-4 text-burgundy" />
              )}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <p className="text-xs font-bold text-foreground leading-none">
                {userProfile.full_name || "Müşteri"}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5 font-medium leading-none">
                {userProfile.email}
              </p>
            </div>
          </div>

          <div className="h-5 w-px bg-border/60" />

          <button
            onClick={handleLogout}
            className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-950/20 rounded-xl transition-all"
            title="Çıkış Yap"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Content body scroll wrapper */}
      <main className="flex-1 overflow-y-auto bg-background/50 scrollbar-thin">
        {children}
      </main>
    </div>
  );
}
