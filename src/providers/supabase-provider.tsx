"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { SplashScreen } from "@/components/layout/splash-screen";
import type { Profile } from "@/types/database";
import type { User } from "@supabase/supabase-js";

interface SupabaseContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType>({
  user: null,
  profile: null,
  isLoading: true,
  refreshProfile: async () => {},
});

/**
 * Hook to access the current Supabase user and profile from any client component.
 */
export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }
  return context;
}

interface SupabaseProviderProps {
  children: ReactNode;
}

/**
 * Provides the current user and profile to the component tree.
 * Listens for auth state changes and fetches the profile from the database.
 */
export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        setUser(currentUser);

        if (currentUser) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .single();

          setProfile(profileData as Profile | null);
        }
      } catch (error) {
        console.error("Error fetching session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .single();

        setProfile(profileData as Profile | null);
      } else {
        setProfile(null);
      }

      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const isNative = typeof window !== "undefined" && (window as any).Capacitor;
    if (!isNative) return;

    let appListener: any;
    
    const initDeepLink = async () => {
      try {
        const supabase = createClient();
        const { App } = await import("@capacitor/app");
        appListener = await App.addListener("appUrlOpen", async (data: { url: string }) => {
          console.log("[DeepLink] App opened with URL:", data.url);
          try {
            const parsedUrl = new URL(data.url);
            
            // 1. Handle hash fragments (e.g. access_token=...)
            const hash = parsedUrl.hash;
            if (hash) {
              const params = new URLSearchParams(hash.substring(1));
              const accessToken = params.get("access_token");
              const refreshToken = params.get("refresh_token");
              const type = params.get("type");
              
              if (accessToken && refreshToken) {
                console.log("[DeepLink] Authenticating via token session...");
                const { error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
                
                if (error) {
                  console.error("[DeepLink] setSession error:", error);
                } else {
                  console.log("[DeepLink] Session authenticated successfully!");
                  await refreshProfile();
                  
                  if (type === "recovery") {
                    console.log("[DeepLink] Password recovery type detected, redirecting to reset page...");
                    window.location.href = "/sifre-yenile" + hash;
                  }
                }
              }
            }
            
            // 2. Handle search params (e.g. code=...)
            const code = parsedUrl.searchParams.get("code");
            if (code) {
              console.log("[DeepLink] Exchanging code for session...");
              const { error } = await supabase.auth.exchangeCodeForSession(code);
              if (error) {
                console.error("[DeepLink] exchangeCodeForSession error:", error);
              } else {
                console.log("[DeepLink] Code exchange successful!");
                await refreshProfile();
              }
            }
          } catch (urlErr) {
            console.error("[DeepLink] Error parsing URL:", urlErr);
          }
        });
      } catch (err) {
        console.error("[DeepLink] Failed to register appUrlOpen listener:", err);
      }
    };

    initDeepLink();

    return () => {
      if (appListener) {
        appListener.remove();
      }
    };
  }, []);

  const refreshProfile = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);

      if (currentUser) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .single();

        setProfile(profileData as Profile | null);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
    }
  };

  return (
    <SupabaseContext.Provider value={{ user, profile, isLoading, refreshProfile }}>
      {children}
      <SplashScreen isLoading={isLoading} />
    </SupabaseContext.Provider>
  );
}
