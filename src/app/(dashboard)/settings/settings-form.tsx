"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/providers/supabase-provider";
import { uploadFileToServer } from "@/actions/storage";
import { updateProfile } from "@/actions/auth";
import { toast } from "sonner";
import { User, Mail, Shield, Loader2, Camera, Lock } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface SettingsFormProps {
  initialProfile: any;
  initialUser: any;
}

export function SettingsForm({ initialProfile, initialUser }: SettingsFormProps) {
  const { refreshProfile } = useSupabase();
  const router = useRouter();

  const [profile, setProfile] = useState<any>(initialProfile);
  const [user, setUser] = useState<any>(initialUser);

  // Form States
  const [fullName, setFullName] = useState(initialProfile?.full_name || "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile?.avatar_url || "");
  
  // Progress States
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync if initial props change
  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      setFullName(initialProfile.full_name || "");
      setAvatarUrl(initialProfile.avatar_url || "");
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Ad Soyad alanı boş bırakılamaz.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await updateProfile({
        full_name: fullName.trim(),
        avatar_url: avatarUrl || null,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Sync global topbar details instantly
      await refreshProfile();

      toast.success("Profil bilgileriniz başarıyla güncellendi.");
      
      // Request Next.js Server Components layout refresh
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Profil güncellenirken bir hata oluştu.");
    } finally {
      setIsSaving(false);
    }
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
          onSubmit={handleSave}
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
                disabled={isSaving || isUploading}
                className="w-full h-10 px-3.5 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
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
              type="submit"
              disabled={isSaving || isUploading || !fullName.trim()}
              className="h-10 px-5 rounded-xl gradient-burgundy text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-burgundy/15"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Güncelleniyor...</span>
                </>
              ) : (
                <span>Değişiklikleri Kaydet</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
