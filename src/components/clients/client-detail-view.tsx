"use client";

import { useState, useEffect, useTransition } from "react";
import { createClientPortalAccountAction, updateClientAction } from "@/actions/clients";
import { createMediaFile, deleteMediaFile } from "@/actions/media";
import { UploadDialog } from "../media/upload-dialog";
import { toast } from "sonner";
import {
  Building,
  Mail,
  Phone,
  Briefcase,
  Key,
  Copy,
  Check,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Calendar,
  DollarSign,
  FileText,
  MapPin,
  Link2,
  Globe,
  Edit,
  X,
  FileUp,
  Trash2,
  Download,
  Image as ImageIcon,
  FileArchive,
  FileCode,
  Music,
  Video,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn, formatDate, formatFileSize, formatRelativeTime } from "@/lib/utils";
import { PROJECT_STATUSES } from "@/lib/constants";
import { ImageZoomModal } from "@/components/ui/image-zoom-modal";
import { VideoPlayerModal } from "@/components/ui/video-modal";

interface ClientDetailViewProps {
  client: any;
}

export function ClientDetailView({ client: initialClient }: ClientDetailViewProps) {
  const [client, setClient] = useState<any>(initialClient);
  const [isPending, startTransition] = useTransition();
  const [credentials, setCredentials] = useState<{ email: string; pass: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Links & Socials states
  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [instagramUrl, setInstagramUrl] = useState(client.instagram_url || "");
  const [mapsUrl, setMapsUrl] = useState(client.maps_url || "");
  const [websiteUrl, setWebsiteUrl] = useState(client.website_url || "");
  // Progress States
  const [isSavingLinks, setIsSavingLinks] = useState(false);

  // Sync state if initialClient changes from parent
  useEffect(() => {
    if (initialClient) {
      setClient(initialClient);
      setInstagramUrl(initialClient.instagram_url || "");
      setMapsUrl(initialClient.maps_url || "");
      setWebsiteUrl(initialClient.website_url || "");
    }
  }, [initialClient]);

  // Media states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const handleSaveLinks = async () => {
    setIsSavingLinks(true);
    try {
      const result = await updateClientAction(client.id, {
        name: client.name,
        instagram_url: instagramUrl,
        maps_url: mapsUrl,
        website_url: websiteUrl,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Bağlantılar başarıyla güncellendi.");
        setClient((prev: any) => ({
          ...prev,
          instagram_url: instagramUrl || null,
          maps_url: mapsUrl || null,
          website_url: websiteUrl || null,
        }));
        setIsEditingLinks(false);
      }
    } catch (err: any) {
      toast.error("Bağlantılar kaydedilirken bir hata oluştu: " + err.message);
    } finally {
      setIsSavingLinks(false);
    }
  };

  const handleCancelLinks = () => {
    setInstagramUrl(client.instagram_url || "");
    setMapsUrl(client.maps_url || "");
    setWebsiteUrl(client.website_url || "");
    setIsEditingLinks(false);
  };

  const handleUploadSuccess = (newFile: any) => {
    const newFileRecord = {
      ...newFile,
      uploader: {
        full_name: "Siz",
        avatar_url: null,
      },
    };

    setClient((prev: any) => ({
      ...prev,
      media_files: [newFileRecord, ...(prev.media_files || [])],
    }));
  };

  const handleDeleteMedia = async (fileId: string, filePath: string) => {
    if (!window.confirm("Bu dosyayı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
      return;
    }

    try {
      const res = await deleteMediaFile(fileId);
      if (res && res.error) {
        toast.error("Dosya silinirken hata oluştu: " + res.error);
      } else {
        toast.success("Dosya başarıyla silindi.");
        setClient((prev: any) => ({
          ...prev,
          media_files: (prev.media_files || []).filter((f: any) => f.id !== fileId),
        }));
      }
    } catch (err: any) {
      toast.error("Dosya silinemedi: " + err.message);
    }
  };

  const handleDownloadMedia = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("İndirme başlatıldı.");
    } catch (err: any) {
      toast.error("Dosya indirilemedi: " + err.message);
    }
  };

  const getMediaIcon = (fileType: string | undefined | null) => {
    const t = (fileType || "").toLowerCase();
    if (t.startsWith("image/")) return <ImageIcon className="w-6 h-6 text-burgundy" />;
    if (t.startsWith("video/")) return <Video className="w-6 h-6 text-burgundy" />;
    if (t.startsWith("audio/")) return <Music className="w-6 h-6 text-burgundy" />;
    if (t.includes("pdf")) return <FileText className="w-6 h-6 text-red-500" />;
    if (t.includes("zip") || t.includes("tar") || t.includes("rar") || t.includes("gzip")) {
      return <FileArchive className="w-6 h-6 text-amber-500" />;
    }
    if (t.includes("html") || t.includes("javascript") || t.includes("typescript") || t.includes("css") || t.includes("json")) {
      return <FileCode className="w-6 h-6 text-emerald-500" />;
    }
    return <FileText className="w-6 h-6 text-muted-foreground" />;
  };

  const projects = client.projects || [];
  const totalBudget = projects.reduce((sum: number, p: any) => sum + (p.budget || 0), 0);

  const handleCreatePortalAccount = () => {
    if (!client.contact_email) {
      toast.error("Hesap oluşturulamaz: Müşterinin e-posta adresi tanımlanmamış.");
      return;
    }

    if (!window.confirm(`${client.name} için bir portal hesabı oluşturmak istediğinize emin misiniz?`)) {
      return;
    }

    startTransition(async () => {
      const result = await createClientPortalAccountAction(client.id);
      if (result.error) {
        toast.error(result.error);
      } else if (result.success && result.password) {
        toast.success("Müşteri portal hesabı başarıyla oluşturuldu.");
        setCredentials({ email: result.email || "", pass: result.password });
        setClient((prev: any) => ({ ...prev, portal_user_id: "created" }));
      }
    });
  };

  const handleCopyCredentials = () => {
    if (!credentials) return;
    const text = `Giriş E-postası: ${credentials.email}\nGeçici Şifre: ${credentials.pass}\nGiriş URL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Giriş bilgileri panoya kopyalandı.");
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusDetails = (status: string) => {
    return PROJECT_STATUSES.find((s) => s.value === status) || {
      label: status,
      color: "#6b7280"
    };
  };

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/clients"
            className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold hover:text-burgundy transition-colors mb-2 w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Müşterilere Geri Dön</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-burgundy/10 text-burgundy flex items-center justify-center font-bold text-lg border border-burgundy/20 shrink-0">
              {client.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={client.logo_url}
                  alt={client.name}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                client.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{client.name}</h1>
              <p className="text-muted-foreground text-xs font-medium mt-0.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5" />
                <span>{client.company || "Firma Belirtilmemiş"}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Portal Account Action */}
        <div className="shrink-0">
          {client.portal_user_id ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-800/40 bg-emerald-950/20 text-emerald-400 text-xs font-semibold select-none">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Portal Hesabı Aktif</span>
            </div>
          ) : (
            <button
              onClick={handleCreatePortalAccount}
              disabled={isPending || !client.contact_email}
              className="h-10 px-5 rounded-xl gradient-burgundy text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-burgundy/15"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Hesap Oluşturuluyor...</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>Portal Hesabı Oluştur</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Generated Credentials Popup Banner */}
      {credentials && (
        <div className="p-5 rounded-2xl border border-burgundy/40 bg-burgundy/5 space-y-3.5 max-w-xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 text-burgundy font-bold text-sm">
            <Key className="w-4 h-4 animate-bounce" />
            <span>Portal Giriş Bilgileri Oluşturuldu</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Müşterinin portal girişi için kullanılacak geçici şifre aşağıdadır. Bu şifreyi lütfen şimdi kopyalayın, bu sayfadan ayrıldıktan sonra şifre tekrar görüntülenemez.
          </p>
          <div className="bg-input/60 border border-border/80 rounded-xl p-3.5 space-y-2 select-all font-mono text-xs">
            <div><span className="text-muted-foreground">E-posta:</span> <span className="text-foreground font-semibold">{credentials.email}</span></div>
            <div><span className="text-muted-foreground">Geçici Şifre:</span> <span className="text-foreground font-semibold">{credentials.pass}</span></div>
          </div>
          <button
            onClick={handleCopyCredentials}
            className="h-9 w-full px-4 rounded-xl border border-burgundy/30 bg-burgundy/10 text-burgundy hover:bg-burgundy/20 transition-all text-xs font-bold flex items-center justify-center gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Kopyalandı!" : "Bilgileri Kopyala"}</span>
          </button>
        </div>
      )}

      {/* Grid Layout: Left Client Stats/Details, Right Projects List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Client Details */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-4.5 shadow-xl">
            <h3 className="text-sm font-bold text-foreground border-b border-border/60 pb-2.5">
              İletişim ve Detaylar
            </h3>

            {/* Email */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">E-posta</span>
              {client.contact_email ? (
                <a
                  href={`mailto:${client.contact_email}`}
                  className="text-xs text-foreground font-medium hover:text-burgundy hover:underline flex items-center gap-1.5 transition-colors select-all"
                >
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{client.contact_email}</span>
                </a>
              ) : (
                <div className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span>E-posta tanımlanmamış (Portal için gerekli)</span>
                </div>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Telefon</span>
              {client.contact_phone ? (
                <a
                  href={`tel:${client.contact_phone}`}
                  className="text-xs text-foreground font-medium hover:text-burgundy transition-colors flex items-center gap-1.5 select-all"
                >
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{client.contact_phone}</span>
                </a>
              ) : (
                <span className="text-xs text-muted-foreground italic block">—</span>
              )}
            </div>

            {/* Status */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Durum</span>
              {(() => {
                const pipelineMapping: Record<string, { label: string, badge: string }> = {
                  lead: { label: "Potansiyel", badge: "bg-blue-950/40 text-blue-400 border-blue-800/50" },
                  contacted: { label: "Görüşüldü", badge: "bg-zinc-800 text-zinc-300 border-zinc-700" },
                  proposal: { label: "Teklif İletildi", badge: "bg-amber-950/40 text-amber-400 border-amber-800/50" },
                  won: { label: "Kazanıldı", badge: "bg-emerald-950/40 text-emerald-400 border-emerald-800/50" },
                  lost: { label: "Kaybedildi", badge: "bg-rose-950/40 text-rose-400 border-rose-800/50" },
                };
                const statusInfo = pipelineMapping[client.pipeline_status as string] || { label: "Potansiyel", badge: "bg-blue-950/40 text-blue-400 border-blue-800/50" };
                return (
                  <span className={cn("inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border select-none", statusInfo.badge)}>
                    {statusInfo.label}
                  </span>
                );
              })()}
            </div>

            {/* Total Value */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Toplam Proje Hacmi</span>
              <div className="text-sm font-extrabold text-foreground font-mono flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span>{totalBudget.toLocaleString("tr-TR")} TL</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Özel Notlar</span>
              <p className="text-xs text-muted-foreground/90 leading-relaxed whitespace-pre-line bg-input/40 border border-border/60 rounded-xl p-3">
                {client.notes || "Bu müşteri için henüz eklenmiş bir not bulunmamaktadır."}
              </p>
            </div>
          </div>

          {/* Links & Socials Section */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <h3 className="text-sm font-bold text-foreground">
                Bağlantılar & Sosyal Medya
              </h3>
              {!isEditingLinks ? (
                <button
                  onClick={() => setIsEditingLinks(true)}
                  className="text-xs text-muted-foreground hover:text-burgundy font-semibold flex items-center gap-1 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Düzenle</span>
                </button>
              ) : null}
            </div>

            {isEditingLinks ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Google Harita Konumu</label>
                  <input
                    type="url"
                    value={mapsUrl}
                    onChange={(e) => setMapsUrl(e.target.value)}
                    placeholder="https://maps.google.com/..."
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Instagram Profili</label>
                  <input
                    type="url"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    placeholder="https://instagram.com/kullanici"
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Web Sitesi</label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://www.firma.com"
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1.5">
                  <button
                    onClick={handleCancelLinks}
                    disabled={isSavingLinks}
                    className="h-9 px-4 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-muted-foreground transition-all"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSaveLinks}
                    disabled={isSavingLinks}
                    className="h-9 px-4 rounded-xl gradient-burgundy hover:opacity-95 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-burgundy/10"
                  >
                    {isSavingLinks ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Kaydet</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* Google Maps Link */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-muted-foreground font-semibold">Google Haritalar</span>
                  </div>
                  {client.maps_url ? (
                    <a
                      href={client.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-foreground font-medium hover:text-burgundy hover:underline transition-colors"
                    >
                      Konumu Aç
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Eklenmemiş</span>
                  )}
                </div>

                {/* Instagram Link */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-pink-500" />
                    <span className="text-xs text-muted-foreground font-semibold">Instagram</span>
                  </div>
                  {client.instagram_url ? (
                    <a
                      href={client.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-foreground font-medium hover:text-burgundy hover:underline transition-colors"
                    >
                      Profili Gör
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Eklenmemiş</span>
                  )}
                </div>

                {/* Website Link */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-muted-foreground font-semibold">Web Sitesi</span>
                  </div>
                  {client.website_url ? (
                    <a
                      href={client.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-foreground font-medium hover:text-burgundy hover:underline transition-colors truncate max-w-[150px]"
                      title={client.website_url}
                    >
                      {client.website_url.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Eklenmemiş</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Projects List */}
        <div className="space-y-6 lg:col-span-2">
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-foreground border-b border-border/60 pb-2.5 flex items-center justify-between">
              <span>İlişkili Projeler</span>
              <span className="text-xs font-semibold text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-lg font-mono">
                {projects.length} Proje
              </span>
            </h3>

            {projects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground space-y-2 select-none border border-dashed border-border/60 rounded-xl bg-card/10 mt-4">
                <Briefcase className="w-8 h-8 mx-auto text-muted-foreground/60" />
                <p className="text-xs font-bold text-foreground">Henüz İlişkili Proje Bulunmuyor</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  Bu müşteri adına oluşturulmuş herhangi bir proje kaydı mevcut değil. Projeler menüsünden yeni bir proje oluştururken bu müşteriyi seçebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40 mt-3">
                {projects.map((p: any) => {
                  const status = getStatusDetails(p.status);
                  return (
                    <div key={p.id} className="py-4.5 first:pt-1.5 last:pb-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4.5 group">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="font-bold text-sm text-foreground group-hover:text-burgundy transition-colors truncate">
                            <Link href={`/projects/${p.id}`}>
                              {p.name}
                            </Link>
                          </h4>
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border select-none"
                            style={{
                              borderColor: `${status.color}30`,
                              color: status.color,
                              backgroundColor: `${status.color}08`
                            }}
                          >
                            {status.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-semibold flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              {p.start_date ? formatDate(p.start_date) : "—"} / {p.end_date ? formatDate(p.end_date) : "—"}
                            </span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono text-foreground/80">
                            <DollarSign className="w-3 h-3 text-emerald-500" />
                            <span>{(p.budget || 0).toLocaleString("tr-TR")} TL</span>
                          </span>
                        </div>
                      </div>

                      {/* Progress bar and view button */}
                      <div className="flex items-center gap-4.5 shrink-0 self-end sm:self-auto select-none">
                        <div className="space-y-1 w-24 text-right">
                          <div className="text-[10px] font-semibold text-muted-foreground">{p.progress}% Tamamlandı</div>
                          <div className="h-1 w-full bg-input rounded-full overflow-hidden">
                            <div
                              className="h-full bg-burgundy rounded-full transition-all duration-300"
                              style={{ width: `${p.progress}%` }}
                            />
                          </div>
                        </div>

                        <Link
                          href={`/projects/${p.id}`}
                          className="h-8 px-3.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <span>Detay</span>
                          <FileText className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Customer Media Gallery Card */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Müşteri Medyası</span>
                <span className="text-xs font-semibold text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-lg font-mono">
                  {(client.media_files || []).length} Dosya
                </span>
              </h3>
              
              <div>
                <button
                  onClick={() => setUploadDialogOpen(true)}
                  className="h-8 px-3 rounded-lg gradient-burgundy text-white text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-md shadow-burgundy/10 cursor-pointer"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  <span>Yükle</span>
                </button>
              </div>
            </div>

            {(!client.media_files || client.media_files.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground space-y-2 select-none border border-dashed border-border/60 rounded-xl bg-card/10">
                <FileText className="w-8 h-8 mx-auto text-muted-foreground/60" />
                <p className="text-xs font-bold text-foreground">Henüz Dosya Yüklenmemiş</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  Bu müşteri için doğrudan yüklenmiş herhangi bir dosya veya doküman bulunmuyor. Yukarıdaki Yükle butonunu kullanarak dosya ekleyebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {(() => {
                  const allMedia = client.media_files || [];
                  const displayedMedia = allMedia.slice(0, 5);
                  const showViewAll = allMedia.length > 5;

                  return (
                    <>
                      {displayedMedia.map((file: any, index: number) => {
                        const isImage = file.file_type ? file.file_type.startsWith("image/") : false;
                        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";
                        const fileUrl = `${supabaseUrl}/storage/v1/object/public/media/${file.file_path}`;
                        const thumbUrl = file.thumbnail_path
                          ? `${supabaseUrl}/storage/v1/object/public/media/${file.thumbnail_path}`
                          : fileUrl;
                        const fileKey = file.id || `file-${index}`;

                        return (
                          <div
                            key={fileKey}
                            className="rounded-xl border border-border/80 bg-muted/20 p-2 flex flex-col justify-between hover:border-burgundy/40 hover:shadow-md hover:shadow-burgundy/5 transition-all group/media"
                          >
                            {/* Preview Box */}
                            <div className="relative aspect-video rounded-lg bg-card border border-border/40 overflow-hidden flex items-center justify-center">
                              {isImage ? (
                                <Image
                                  src={thumbUrl}
                                  alt={file.file_name || "Önizleme"}
                                  fill
                                  sizes="(max-width: 640px) 50vw, 33vw"
                                  className="object-cover w-full h-full group-hover/media:scale-105 transition-transform duration-500"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center p-2">
                                  {getMediaIcon(file.file_type)}
                                </div>
                              )}

                              {/* Hover Actions Overlay */}
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleDeleteMedia(file.id, file.file_path)}
                                  className="p-1.5 rounded-full bg-red-950/80 text-red-400 hover:bg-red-900 hover:text-white transition-colors cursor-pointer"
                                  title="Sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDownloadMedia(fileUrl, file.file_name)}
                                  className="p-1.5 rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer"
                                  title="İndir"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    const isImage = file.file_type ? file.file_type.startsWith("image/") : false;
                                    const isVideo = file.file_type ? file.file_type.startsWith("video/") : false;
                                    
                                    if (isImage) {
                                      setSelectedImage(fileUrl);
                                    } else if (isVideo) {
                                      setSelectedVideo(fileUrl);
                                    } else {
                                      window.open(fileUrl, '_blank');
                                    }
                                  }}
                                  className="p-1.5 rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                                  title="Görüntüle"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* File Info */}
                            <div className="mt-2 space-y-0.5">
                              <div
                                className="text-[11px] font-bold text-foreground truncate max-w-full"
                                title={file.file_name}
                              >
                                {file.file_name}
                              </div>
                              <div className="flex items-center justify-between text-[9px] text-muted-foreground font-semibold">
                                <span>{formatFileSize(file.file_size)}</span>
                                <span>{formatRelativeTime(file.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {showViewAll && (
                        <Link
                          href={`/media?client=${client.id}`}
                          className="rounded-xl border border-dashed border-border/80 bg-muted/5 p-2 flex flex-col items-center justify-center hover:border-burgundy/40 hover:bg-burgundy/5 transition-all text-center h-full min-h-[90px] group/all justify-between"
                        >
                          <div className="my-auto space-y-1 py-4">
                            <div className="text-xs font-bold text-foreground group-hover/all:text-burgundy transition-colors">
                              Tümünü Gör
                            </div>
                            <div className="text-[10px] text-muted-foreground font-semibold">
                              +{allMedia.length - 5} dosya daha
                            </div>
                          </div>
                        </Link>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      <UploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        projects={client.projects || []}
        clients={[{ id: client.id, name: client.name }]}
        initialUploadType="client"
        initialClientId={client.id}
        lockType={true}
      />

      <ImageZoomModal
        imageUrl={selectedImage}
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
      />

      <VideoPlayerModal
        videoUrl={selectedVideo}
        isOpen={!!selectedVideo}
        onClose={() => setSelectedVideo(null)}
      />
    </div>
  );
}
