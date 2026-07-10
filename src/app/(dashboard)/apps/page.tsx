"use client";

import { useState, useEffect } from "react";
import { 
  Globe, 
  Search,
  Sparkles,
  ExternalLink,
  Laptop,
  Plus,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AppItem {
  id: string;
  name: string;
  url: string;
  description?: string;
}

export default function AppsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // App list & state
  const [apps, setApps] = useState<AppItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(9); // limit: 9

  // Add App Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppUrl, setNewAppUrl] = useState("");
  const [newAppDesc, setNewAppDesc] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // 1. Fetch apps from Supabase on mount (Client-Side only — no Server Actions)
  const fetchApps = async () => {
    console.log("Supabase'den veriler çekiliyor (Tetiklendi)...");
    setIsLoading(true);
    setApps([]); // Clear existing stale list to enforce visible reload state
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from("integrated_apps")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase SELECT Hatası:", error);
        throw new Error(error.message);
      }

      console.log("Supabase'den Gelen Uygulamalar:", data);
      setApps(data || []);
    } catch (err: any) {
      console.error("Failed to load apps from Supabase:", err);
      setErrorMessage(err.message || "Bağlantı hatası oluştu.");
      setApps([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();

    // Trigger fetch on tab/window focus to ensure fresh data in Electron
    const handleFocus = () => {
      fetchApps();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // 2. Open app handler
  const handleOpenApp = (app: AppItem) => {
    const electron = (window as any).electron;
    if (electron && typeof electron.openExternalApp === "function") {
      electron.openExternalApp(app.url);
      toast.success(`${app.name} güvenli alt pencerede açıldı.`);
    } else {
      window.open(app.url, "_blank", "noopener,noreferrer");
      toast.info(`${app.name} yeni tarayıcı sekmesinde açıldı (Web sürümü).`);
    }
  };

  // 3. Save new custom app
  const handleSaveApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName.trim() || !newAppUrl.trim()) {
      toast.error("Lütfen ad ve URL alanlarını doldurun.");
      return;
    }

    let urlString = newAppUrl.trim();
    if (!/^https?:\/\//i.test(urlString)) {
      urlString = `https://${urlString}`;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const newRecord = {
        name: newAppName.trim(),
        url: urlString,
        description: newAppDesc.trim() || "Harici entegre uygulama.",
        created_by: user?.id || null
      };

      const { data: newApp, error } = await supabase
        .from("integrated_apps")
        .insert([newRecord] as any)
        .select()
        .single();

      if (error) throw error;

      // Add the newly saved app immediately to the list state
      setApps(prev => [newApp, ...prev]);
      toast.success("Uygulama başarıyla eklendi.");
      router.refresh(); // Clear Next.js Router cache
      
      // Reset form
      setNewAppName("");
      setNewAppUrl("");
      setNewAppDesc("");
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error("Uygulama eklenemedi: " + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Delete app
  const handleDeleteApp = async (appId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Bu uygulamayı kaldırmak istediğinizden emin misiniz?")) return;

    // Optimistic removal
    const previousApps = [...apps];
    setApps(prev => prev.filter(a => a.id !== appId));

    if (appId.startsWith("def-")) {
      toast.success("Uygulama listeden kaldırıldı.");
      return;
    }

    try {
      const { error } = await supabase
        .from("integrated_apps")
        .delete()
        .eq("id", appId);

      if (error) throw error;
      toast.success("Uygulama başarıyla veritabanından kaldırıldı.");
      router.refresh(); // Clear Next.js Router cache
    } catch (err: any) {
      console.error("Delete failed:", err);
      toast.error("Kayıt veritabanından silinemedi!");
      setApps(previousApps); // Rollback
    }
  };

  // Filter apps based on search
  const filteredApps = apps.filter(
    (app) =>
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.url.toLowerCase().includes(search.toLowerCase()) ||
      (app.description && app.description.toLowerCase().includes(search.toLowerCase()))
  );

  // Pagination slice
  const paginatedApps = filteredApps.slice(0, visibleCount);
  const hasMore = filteredApps.length > visibleCount;

  return (
    <div className="space-y-6">
      {/* Header Title Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Entegre Uygulamalar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Harici web araçlarını özel Electron alt pencerelerinde açıp yönetin.
          </p>
        </div>

        {/* Search & Add triggers */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Uygulama ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-card/65 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-md shadow-primary/10 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Ekle</span>
          </button>
        </div>
      </div>

      {/* Red Error Message box (if database loading failed) */}
      {errorMessage && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Uygulamalar veritabanından çekilemedi</div>
            <div className="opacity-80">Hata Detayı: {errorMessage}</div>
            <div className="opacity-60 mt-1">Sistem, çevrimdışı kullanım için varsayılan araç listesini yükledi.</div>
          </div>
        </div>
      )}

      {/* Loading state spinner */}
      {isLoading && apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground">Uygulamalar listesi yükleniyor...</p>
        </div>
      ) : (
        /* Apps Directory Grid */
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedApps.map((app) => {
              // Extract clean domain for favicon API
              let domain = "google.com";
              try {
                const urlObj = new URL(app.url);
                domain = urlObj.hostname;
              } catch (e) {
                const match = app.url.match(/^(?:https?:\/\/)?(?:www\.)?([^/]+)/i);
                if (match) domain = match[1];
              }

              return (
                <div
                  key={app.id}
                  onClick={() => handleOpenApp(app)}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl border border-border/80 bg-card/45 hover:bg-card/90 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl cursor-pointer overflow-hidden min-h-[190px]"
                >
                  <div className="space-y-3.5 relative z-10">
                    <div className="flex items-start justify-between">
                      {/* Google Favicon API Image inside a rounded glass frame */}
                      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-muted/65 border border-border shadow-inner p-2 shrink-0 overflow-hidden backdrop-blur-md">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
                          alt={`${app.name} favicon`}
                          className="w-full h-full object-contain filter drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                        <Globe className="w-5 h-5 text-muted-foreground absolute" style={{ zIndex: -1 }} />
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteApp(app.id, e)}
                        className="p-1.5 rounded-lg border border-border/50 bg-card/85 text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Uygulamayı kaldır"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors truncate">
                        {app.name}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {app.description || `${domain} üzerinden entegre harici araç.`}
                      </p>
                    </div>
                  </div>

                  {/* Open Link Indicator */}
                  <div className="flex justify-end pt-3.5 relative z-10">
                    <span className="text-[10px] font-bold text-primary tracking-wider uppercase flex items-center gap-1 group-hover:underline">
                      <span>Uygulamayı Aç</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setVisibleCount(prev => prev + 9)}
                className="h-10 px-6 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
              >
                Daha Fazla Yükle
              </button>
            </div>
          )}

          {/* Empty search results fallback */}
          {filteredApps.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Laptop className="w-10 h-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold text-muted-foreground">Sonuç bulunamadı</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Aramanızla eşleşen bir entegrasyon bulunmuyor.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Add App Modal Form ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                Yeni Uygulama Entegre Et
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSaveApp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Uygulama Adı</label>
                <input
                  type="text"
                  placeholder="Örn: Canva, SEO Araçları, ChatGPT"
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-xl bg-input/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Uygulama URL adresi</label>
                <input
                  type="text"
                  placeholder="Örn: https://seocu.com"
                  value={newAppUrl}
                  onChange={(e) => setNewAppUrl(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-xl bg-input/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Açıklama (İsteğe Bağlı)</label>
                <textarea
                  placeholder="Araç veya panel hakkında kısa bir not girin..."
                  value={newAppDesc}
                  onChange={(e) => setNewAppDesc(e.target.value)}
                  rows={2}
                  className="w-full p-3 rounded-xl bg-input/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="h-10 px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-all"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all shadow-md shadow-primary/10 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <span>Kaydet ve Entegre Et</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
