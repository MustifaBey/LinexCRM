"use client";

import { useState, useEffect } from "react";
import { X, Calendar, FileText, Image, Trash2, Loader2, Save, UploadCloud, ImageIcon } from "lucide-react";
import { createContentPost, updateContentPost, deleteContentPost } from "@/actions/calendar";
import { uploadFileToServer } from "@/actions/storage";
import { toast } from "sonner";
import type { Project } from "@/types/database";
import { cn } from "@/lib/utils";

interface PostDialogProps {
  open: boolean;
  onClose: () => void;
  post: any | null; // if editing
  projects: Project[];
  initialDate: Date | null;
  onSuccess: () => void;
}

export function PostDialog({
  open,
  onClose,
  post,
  projects,
  initialDate,
  onSuccess,
}: PostDialogProps) {
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<"draft" | "pending" | "published">("draft");
  const [publishDate, setPublishDate] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const isEdit = !!post;

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen sadece resim dosyası yükleyin");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Dosya boyutu en fazla 5MB olabilir");
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, "_");
      let filePath = `calendar-posts/${Date.now()}_${cleanName}.${fileExt}`;
      filePath = filePath.replace(/^\/+/, "").replace(/\/+/g, "/");

      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("bucket", "media");
      uploadFormData.append("path", filePath);

      const response = await uploadFileToServer(uploadFormData);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.publicUrl) {
        setImageUrl(response.publicUrl);
        toast.success("Görsel başarıyla yüklendi");
      } else {
        throw new Error("Görsel bağlantısı alınamadı");
      }
    } catch (err: any) {
      toast.error(err.message || "Görsel yüklenirken bir hata oluştu");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (open) {
      if (post) {
        setContent(post.content || "");
        setProjectId(post.project_id || "");
        setStatus(post.status || "draft");
        setImageUrl(post.image_url || "");
        
        // Format ISO date to YYYY-MM-DDTHH:MM
        if (post.publish_date) {
          const d = new Date(post.publish_date);
          const offset = d.getTimezoneOffset();
          const localTime = new Date(d.getTime() - offset * 60 * 1000);
          setPublishDate(localTime.toISOString().slice(0, 16));
        } else {
          setPublishDate("");
        }
      } else {
        setContent("");
        setProjectId("");
        setStatus("draft");
        setImageUrl("");
        
        if (initialDate) {
          const d = new Date(initialDate);
          // Set to 12:00 local time
          d.setHours(12, 0, 0, 0);
          const offset = d.getTimezoneOffset();
          const localTime = new Date(d.getTime() - offset * 60 * 1000);
          setPublishDate(localTime.toISOString().slice(0, 16));
        } else {
          const d = new Date();
          d.setHours(12, 0, 0, 0);
          const offset = d.getTimezoneOffset();
          const localTime = new Date(d.getTime() - offset * 60 * 1000);
          setPublishDate(localTime.toISOString().slice(0, 16));
        }
      }
    }
  }, [open, post, initialDate]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("İçerik alanı boş olamaz.");
      return;
    }
    if (!publishDate) {
      toast.error("Yayınlanma tarihi seçilmelidir.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        project_id: projectId || null,
        publish_date: new Date(publishDate).toISOString(),
        content: content.trim(),
        status,
        image_url: imageUrl.trim() || null,
      };

      if (isEdit && post) {
        const res = await updateContentPost(post.id, payload);
        if (res.error) throw new Error(res.error);
        toast.success("İçerik planı güncellendi.");
      } else {
        const res = await createContentPost(payload);
        if (res.error) throw new Error(res.error);
        toast.success("Yeni içerik planı oluşturuldu.");
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error("İşlem başarısız: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    if (!confirm("Bu içerik planını silmek istediğinizden emin misiniz?")) return;

    setDeleting(true);
    try {
      const res = await deleteContentPost(post.id);
      if (res.error) throw new Error(res.error);
      toast.success("İçerik planı silindi.");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error("Silme işlemi başarısız: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={() => !loading && !deleting && onClose()} 
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-burgundy" />
            <span>{isEdit ? "İçerik Planını Düzenle" : "Yeni İçerik Planı"}</span>
          </h2>
          <button
            onClick={onClose}
            disabled={loading || deleting}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            
            {/* Content Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                İçerik / Metin
              </label>
              <textarea
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={loading || deleting}
                placeholder="Paylaşılacak içerik detayını veya taslak metnini yazın..."
                className="w-full min-h-[100px] p-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder:text-muted-foreground/60"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Proje (Opsiyonel)
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={loading || deleting}
                  className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                >
                  <option value="">Genel (Projesiz)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Publish Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Yayınlanma Tarihi
                </label>
                <input
                  type="datetime-local"
                  required
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  disabled={loading || deleting}
                  className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status Select */}
              <div className="space-y-1.5 col-span-1 md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Durum
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  disabled={loading || deleting || isUploading}
                  className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                >
                  <option value="draft">Taslak (Draft)</option>
                  <option value="pending">İncelemede (Pending)</option>
                  <option value="published">Yayınlandı (Published)</option>
                </select>
              </div>

              {/* Cover Image Upload */}
              <div className="space-y-1.5 col-span-1 md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-burgundy" />
                  İçerik Görseli (Opsiyonel)
                </label>

                {imageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-border h-36 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Önizleme"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-all"
                      >
                        Görseli Kaldır
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    onClick={() => !isUploading && !loading && !deleting && document.getElementById("post-image-input")?.click()}
                    className={cn(
                      "border border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300",
                      dragActive
                        ? "border-burgundy bg-burgundy/5 scale-[0.98]"
                        : "border-border/60 hover:border-burgundy/40 hover:bg-muted/30",
                      (isUploading || loading || deleting) && "pointer-events-none opacity-50"
                    )}
                  >
                    <input
                      type="file"
                      id="post-image-input"
                      className="hidden"
                      accept="image/*"
                      disabled={isUploading || loading || deleting}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <Loader2 className="w-8 h-8 text-burgundy animate-spin mb-1" />
                        <span className="text-xs text-foreground font-semibold">
                          Görsel yükleniyor...
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <UploadCloud className="w-8 h-8 text-muted-foreground/85" />
                        <span className="text-xs font-medium text-foreground">
                          Görsel sürükleyin veya göz atmak için tıklayın
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          PNG, JPG, JPEG (Maks. 5MB)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading || deleting}
                className="h-10 px-4 rounded-xl text-sm font-medium border border-red-800/40 text-red-400 hover:bg-red-950/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Sil</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={loading || deleting}
                className="h-10 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={loading || deleting}
                className="h-10 px-5 rounded-xl gradient-burgundy text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-burgundy/15"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{isEdit ? "Güncelle" : "Planla"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
