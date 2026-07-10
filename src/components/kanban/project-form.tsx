"use client";

import { useState, useEffect } from "react";
import type { Client } from "@/types/database";
import { toast } from "sonner";
import { Loader2, ImageIcon, Plus, UploadCloud } from "lucide-react";
import { uploadFileToServer } from "@/actions/storage";
import { ClientDialog } from "./client-dialog";
import { cn } from "@/lib/utils";
import { PROJECT_STATUSES } from "@/lib/constants";

interface ProjectFormProps {
  initialData?: {
    id?: string;
    name: string;
    description: string;
    client_id: string;
    start_date: string;
    end_date: string;
    image_url: string;
    status?: string;
    progress?: number;
    budget?: number;
  };
  clients: Client[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  isEdit?: boolean;
}

export function ProjectForm({
  initialData,
  clients: initialClients,
  onSubmit,
  onCancel,
  isSubmitting,
  isEdit = false,
}: ProjectFormProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);

  // Form Fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("planning");
  const [progress, setProgress] = useState(0);
  const [budget, setBudget] = useState(0);

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Client Dialog Toggle
  const [clientDialogOpen, setClientDialogOpen] = useState(false);

  // Sync clients prop when it changes
  useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);

  // Load initial data for editing
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setDescription(initialData.description || "");
      setClientId(initialData.client_id || "");
      setStartDate(initialData.start_date || "");
      setEndDate(initialData.end_date || "");
      setImageUrl(initialData.image_url || "");
      if (initialData.status) setStatus(initialData.status);
      if (initialData.progress !== undefined) setProgress(initialData.progress);
      if (initialData.budget !== undefined) setBudget(initialData.budget);
    }
  }, [initialData]);

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
      let filePath = `project-covers/${Date.now()}_${cleanName}.${fileExt}`;
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
        toast.success("Kapak görseli başarıyla yüklendi");
      } else {
        throw new Error("Görsel bağlantısı alınamadı");
      }
    } catch (err: any) {
      toast.error(err.message || "Görsel yüklenirken beklenmeyen bir hata oluştu");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Proje adı gereklidir");
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      client_id: clientId || null,
      start_date: startDate || null,
      end_date: endDate || null,
      image_url: imageUrl.trim() || null,
      status,
      progress,
      budget: budget || null,
    });
  };

  const handleClientSaveSuccess = (newClient: Client) => {
    setClients((prev) => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
    setClientId(newClient.id);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Project Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Proje Adı
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="E-ticaret Tasarımı, Logo Markalama"
            disabled={isSubmitting || isUploading}
            className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>

        {/* Client select */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            İlişkili Müşteri (İsteğe Bağlı)
          </label>
          <div className="flex gap-2">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={isSubmitting || isUploading}
              className="flex-1 h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            >
              <option value="">Müşteri seçin...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setClientDialogOpen(true)}
              disabled={isSubmitting || isUploading}
              className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-burgundy/10 border border-burgundy/20 text-burgundy hover:bg-burgundy/20 hover:text-burgundy transition-all"
              title="Yeni Müşteri Ekle"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dates row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isSubmitting || isUploading}
              className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Bitiş Tarihi
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isSubmitting || isUploading}
              className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>
        </div>

        {/* Status, Budget, Progress row (Edit mode only) */}
        {isEdit && (
          <div className="grid grid-cols-3 gap-4 border-t border-border/40 pt-4">
            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Proje Durumu
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={isSubmitting || isUploading}
                className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Budget */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Bütçe (TL)
              </label>
              <input
                type="number"
                value={budget || ""}
                onChange={(e) => setBudget(Number(e.target.value))}
                placeholder="Örn: 25000"
                disabled={isSubmitting || isUploading}
                className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            {/* Progress */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                İlerleme (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(Math.min(100, Math.max(0, Number(e.target.value))))}
                disabled={isSubmitting || isUploading}
                className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>
          </div>
        )}

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Açıklama
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Projenin hedefleri, çıktıları ve teslimatları hakkında genel bilgi..."
            rows={3}
            disabled={isSubmitting || isUploading}
            className="w-full p-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
          />
        </div>

        {/* Cover Image Upload */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5 text-burgundy" />
            Proje Kapak Görseli
          </label>

          {imageUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-border h-36 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Proje kapağı önizleme"
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
              onClick={() => !isUploading && !isSubmitting && document.getElementById("cover-input-form")?.click()}
              className={cn(
                "border border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300",
                dragActive
                  ? "border-burgundy bg-burgundy/5 scale-[0.98]"
                  : "border-border/60 hover:border-burgundy/40 hover:bg-muted/30",
                (isUploading || isSubmitting) && "pointer-events-none opacity-50"
              )}
            >
              <input
                type="file"
                id="cover-input-form"
                className="hidden"
                accept="image/*"
                disabled={isUploading || isSubmitting}
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
                  <UploadCloud className="w-8 h-8 text-muted-foreground/80" />
                  <span className="text-xs font-medium text-foreground">
                    Kapak resmi sürükleyin veya göz atmak için tıklayın
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    PNG, JPG, JPEG (Maks. 5MB)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border bg-muted/10 px-6 py-4 -mx-6 -mb-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting || isUploading}
            className="h-10 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isUploading || !name.trim()}
            className="h-10 px-5 rounded-xl gradient-burgundy text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-burgundy/15"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isEdit ? "Güncelleniyor..." : "Proje Oluşturuluyor..."}</span>
              </>
            ) : (
              <span>{isEdit ? "Değişiklikleri Kaydet" : "Proje Oluştur"}</span>
            )}
          </button>
        </div>
      </form>

      {/* Client Dialog */}
      <ClientDialog
        open={clientDialogOpen}
        onClose={() => setClientDialogOpen(false)}
        onSaveSuccess={handleClientSaveSuccess}
      />
    </>
  );
}
