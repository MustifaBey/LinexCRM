"use client";

import { useSupabase } from "@/providers/supabase-provider";

/**
 * Hook to check the current user's role.
 */
export function useUser() {
  const { user, profile, isLoading } = useSupabase();

  const isAdmin = profile?.role === "owner" || profile?.role === "admin";
  const isMember = profile?.role === "member";
  const isClient = profile?.role === "client";

  return {
    user,
    profile,
    isLoading,
    isAdmin,
    isMember,
    isClient,
    isAuthenticated: !!user,
  };
}
