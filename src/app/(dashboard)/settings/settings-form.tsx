"use client";

import { useState, useEffect } from "react";
import { uploadFileToServer } from "@/actions/storage";
import { updateProfile } from "@/actions/profile";
import { toast } from "sonner";
import { User, Mail, Shield, Loader2, Camera, Lock, Volume2 } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

interface SettingsFormProps {
  initialProfile: any;
  initialUser: any;
}

export function SettingsForm({ initialProfile, initialUser }: SettingsFormProps) {

  const [profile, setProfile] = useState<any>(initialProfile);
  const [user, setUser] = useState<any>(initialUser);

  // Form States
  const [fullName, setFullName] = useState(initialProfile?.full_name || "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile?.avatar_url || "");
  const [soundVolume, setSoundVolume] = useState(initialProfile?.sound_volume ?? 75);
  
  // Progress States
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync if initial props change
  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      setFullName(initialProfile.full_name || "");
      setAvatarUrl(initialProfile.avatar_url || "");
      setSoundVolume(initialProfile.sound_volume ?? 75);
    }
    if (initialUser) {
      setUser(initialUser);
    }
  }, [initialProfile, initialUser]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen sadece görsel dosyaları yükleyin.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Profil resmi boyutu en fazla 2MB olabilir.");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `avatars/${user?.id || "unknown"}_${Date.now()}.${fileExt}`;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "media");
      formData.append("path", filePath);

      const response = await uploadFileToServer(formData);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.publicUrl) {
        setAvatarUrl(response.publicUrl);
        toast.success("Profil resmi yüklendi. Değişiklikleri kaydetmek için lütfen formu gönderin.");
      } else {
        throw new Error("Görsel bağlantısı alınamadı.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Profil resmi yüklenirken hata oluştu.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await updateProfile(fullName.trim(), soundVolume, avatarUrl);
      if (result.error) throw new Error(result.error);
      toast.success("Profil başarıyla güncellendi!");
      // Kaydet ve Sayfayı Yenile
      window.location.replace(window.location.pathname);
    } catch (err: any) {
      toast.error("Hata: " + (err.message || "Güncelleme başarısız"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateUpdateClick = () => {
    // 1. Trigger update available
    window.dispatchEvent(new CustomEvent("simulate-update", { detail: { type: "available" } }));
    toast.info("Güncelleme simülasyonu başlatıldı: v1.0.13 sürümü algılandı.");

    setTimeout(() => {
      let percent = 0;
      const interval = setInterval(() => {
        percent += 10;
        if (percent > 100) {
          clearInterval(interval);
          // 3. Update downloaded
          window.dispatchEvent(new CustomEvent("simulate-update", { detail: { type: "downloaded" } }));
        } else {
          // 2. Dispatch progress
          window.dispatchEvent(new CustomEvent("simulate-update", { detail: { type: "progress", progress: percent } }));
        }
      }, 300);
    }, 1500);
  };

  const roleText =
    profile?.role === "owner"
      ? "Kurucu"
      : profile?.role === "admin"
      ? "Yönetici"
      : profile?.role === "member"
      ? "Üye"
      : "Müşteri";

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profil Ayarları</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Kişisel profil bilgilerinizi ve hesabınızı buradan güncelleyin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Avatar Panel */}
        <div className="md:col-span-1 bg-card border border-border/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
          <div className="relative group w-28 h-28 rounded-2xl overflow-hidden border border-border flex items-center justify-center bg-muted/40 transition-all">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover transition-opacity group-hover:opacity-75"
              />
            ) : (
              <span className="text-3xl font-bold text-muted-foreground/80">
                {fullName ? getInitials(fullName) : "U"}
              </span>
            )}
            
            {/* Hover overlay upload */}
            <div
              className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center transition-all cursor-pointer opacity-0 group-hover:opacity-100 ${
                isUploading ? "opacity-100" : ""
              }`}
              onClick={() => !isUploading && document.getElementById("avatar-input")?.click()}
            >
              {isUploading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <>
                  <Camera className="w-5 h-5 text-white mb-1" />
                  <span className="text-[10px] text-white font-medium">Değiştir</span>
                </>
              )}
            </div>
            <input
              type="file"
              id="avatar-input"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={isUploading}
            />
          </div>

          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-foreground truncate max-w-[200px]">
              {fullName || "Kullanıcı"}
            </h3>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {profile?.email}
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-burgundy/10 border border-burgundy/25 text-burgundy text-xs font-semibold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" />
            {roleText}
          </span>
        </div>

        {/* Right Side: Fields Form */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleUpdate(); }}
          className="md:col-span-2 bg-card border border-border/80 rounded-2xl p-6 space-y-6 shadow-xl"
        >
          <div className="space-y-4">
            {/* Ad Soyad */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-burgundy" />
                Ad Soyad
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Örn. Ahmet Yılmaz"
                disabled={isSubmitting || isUploading}
                className="w-full h-10 px-3.5 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            {/* Bildirim Ses Seviyesi */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between gap-1.5">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-burgundy" />
                  Bildirim Ses Seviyesi
                </span>
                <span className="text-sm font-bold text-burgundy font-mono">
                  %{soundVolume}
                </span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={soundVolume}
                  onChange={(e) => setSoundVolume(Number(e.target.value))}
                  disabled={isSubmitting || isUploading}
                  className="w-full h-1.5 rounded-lg bg-neutral-900 appearance-none cursor-pointer accent-burgundy"
                />
              </div>
            </div>

            {/* Email (Readonly) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                E-posta Adresi
              </label>
              <input
                value={profile?.email || ""}
                readOnly
                disabled
                className="w-full h-10 px-3.5 rounded-xl bg-muted/40 border border-border text-sm text-muted-foreground select-none cursor-not-allowed opacity-80"
              />
              <p className="text-[10px] text-muted-foreground/80 leading-normal">
                Sistem giriş e-posta adresiniz değiştirilemez.
              </p>
            </div>

            {/* Rol (Readonly) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                Kullanıcı Rolü
              </label>
              <input
                value={roleText}
                readOnly
                disabled
                className="w-full h-10 px-3.5 rounded-xl bg-muted/40 border border-border text-sm text-muted-foreground select-none cursor-not-allowed opacity-80"
              />
              <p className="text-[10px] text-muted-foreground/80 leading-normal">
                Kullanıcı yetki seviyeniz yöneticiler tarafından belirlenir.
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end pt-4 border-t border-border/60">
            <button
              onClick={() => handleUpdate()}
              disabled={isSubmitting || isUploading || !fullName.trim()}
              className="h-10 px-5 rounded-xl gradient-burgundy text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-burgundy/15"
            >
              {isSubmitting ? "Güncelleniyor..." : "Güncelle"}
            </button>
          </div>
        </form>
      </div>

      {/* Auto Update Simulation Section */}
      <div className="bg-card border border-border/60 p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-burgundy/10 text-burgundy">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-foreground">Güncelleme Sistemini Test Et (Simülasyon)</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Uygulama içi otomatik güncelleme akışını, indirme barı ilerlemesini ve modal ekranını yapay olarak simüle etmenizi sağlar.
        </p>
        <button
          type="button"
          onClick={handleSimulateUpdateClick}
          className="h-10 px-5 rounded-xl border border-border bg-input hover:bg-muted text-foreground text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-[0.98]"
        >
          Simülasyonu Başlat (v1.0.13)
        </button>
      </div>
    </div>
  );
}
