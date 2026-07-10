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
    try {
      console.log("[PORTAL] LOGOUT INITIATED");
      const supabase = createSupabaseClient();
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
      }
      console.log("[PORTAL] Sign out success, redirecting...");
      window.location.href = '/login';
    } catch (error) {
      console.error("[PORTAL] Logout failed:", error);
      window.location.href = '/login';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Premium Top Navigation */}
      <header className="h-16 border-b border-border bg-card/45 backdrop-blur-md flex items-center justify-between pl-6 pr-[130px] shrink-0 z-50 shadow-sm select-none">
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

          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="px-1 pb-1">
            <button
              onClick={(e) => {
                e.preventDefault();
                localStorage.clear();
                sessionStorage.clear();
                window.location.replace('/login');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-950/50 transition-colors rounded-lg cursor-pointer"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <LogOut className="w-4 h-4" />
              Çıkış Yap
            </button>
          </div>
        </div>
      </header>

      {/* Content body scroll wrapper */}
      <main className="flex-1 overflow-y-auto bg-background/50 scrollbar-thin">
        {children}
      </main>
    </div>
  );
}
