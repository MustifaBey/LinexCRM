"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

export default function SifreYenilePage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

  useEffect(() => {
    const handleSession = async () => {
      try {
        // Parse access_token and refresh_token from URL hash (standard Supabase redirect format)
        const hash = window.location.hash;
        if (hash) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");

          if (accessToken && refreshToken) {
            console.log("[SifreYenile] URL hash credentials found, setting session...");
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error("[SifreYenile] setSession error:", error);
              toast.error("Oturum doğrulanırken hata oldu. Link geçersiz veya süresi dolmuş olabilir.");
            } else {
              console.log("[SifreYenile] Session set successfully!");
              setSessionActive(true);
            }
          }
        } else {
          // Check if session is already active (via cookie/client cache)
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setSessionActive(true);
          } else {
            toast.error("Şifre sıfırlama oturumu bulunamadı. Lütfen tekrar şifre sıfırlama maili talep edin.");
          }
        }
      } catch (err) {
        console.error("[SifreYenile] Error handling recovery session:", err);
      } finally {
        setIsVerifying(false);
      }
    };

    handleSession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast.error("Lütfen yeni bir şifre girin.");
      return;
    }

    if (password.length < 6) {
      toast.error("Şifre en az 6 karakter olmalıdır.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Şifreler eşleşmiyor.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error("Şifre güncellenirken hata oluştu: " + error.message);
      } else {
        toast.success("Şifreniz başarıyla güncellendi! Giriş yapabilirsiniz.");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      }
    } catch (err: any) {
      toast.error("Kritik hata: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="relative w-full max-w-md rounded-2xl bg-neutral-950 border border-neutral-900 p-8 space-y-6 shadow-2xl overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-burgundy/10 rounded-full blur-[60px] pointer-events-none" />

        <div className="text-center relative z-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-burgundy/10 border border-burgundy/20 text-burgundy mb-4">
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Yeni Şifre Belirleyin</h2>
          <p className="mt-1.5 text-sm text-neutral-400">
            Güvenliğiniz için yeni şifrenizi girin.
          </p>
        </div>

        {isVerifying ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3 relative z-10">
            <Loader2 className="h-7 w-7 text-burgundy animate-spin" />
            <span className="text-xs text-neutral-500">Oturum doğrulanıyor...</span>
          </div>
        ) : sessionActive ? (
          <form onSubmit={handleResetPassword} className="space-y-4 relative z-10">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                Yeni Şifre
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="w-full h-11 px-3.5 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder-neutral-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                Şifre Tekrarı
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                className="w-full h-11 px-3.5 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder-neutral-600"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl gradient-burgundy hover:opacity-90 active:scale-[0.98] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-md shadow-burgundy/15 mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Şifre Güncelleniyor...</span>
                </>
              ) : (
                <span>Şifreyi Güncelle</span>
              )}
            </button>
          </form>
        ) : (
          <div className="text-center py-4 space-y-4 relative z-10">
            <p className="text-sm text-red-400">
              Oturum doğrulanamadı. Şifre sıfırlama linkiniz geçersiz veya süresi dolmuş olabilir.
            </p>
            <button
              onClick={() => {
                window.location.href = "/login";
              }}
              className="px-5 h-10 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-sm text-neutral-200 cursor-pointer"
            >
              Giriş Sayfasına Dön
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
