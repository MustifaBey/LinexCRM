"use client";

import { useState, useEffect } from "react";

import { toast } from "sonner";
import { X, UploadCloud, Loader2, FileUp } from "lucide-react";
import { cn, generateClientThumbnail } from "@/lib/utils";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadSuccess: (newFileRecord: any) => void;
  projects: any[];
  clients: any[];
  initialUploadType?: "project" | "client";
  initialClientId?: string;
  initialProjectId?: string;
  lockType?: boolean;
}

export function UploadDialog({
  open,
  onClose,
  onUploadSuccess,
  projects,
  clients,
  initialUploadType = "project",
  initialClientId = "",
  initialProjectId = "",
  lockType = false,
}: UploadDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadType, setUploadType] = useState<"project" | "client">(initialUploadType);
  
  // Selection Targets
  const [targetProject, setTargetProject] = useState(initialProjectId);
  const [targetClient, setTargetClient] = useState(initialClientId);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Sync initial selections when open state changes
  useEffect(() => {
    if (open) {
      setUploadType(initialUploadType);
      setTargetProject(initialProjectId);
      setTargetClient(initialClientId);
      setSelectedUploadFile(null);
      setUploadProgress(null);
    }
  }, [open, initialUploadType, initialClientId, initialProjectId]);

  const handleUpload = async () => {
    if (!selectedUploadFile) return;

    if (selectedUploadFile.size > 50 * 1024 * 1024) {
      toast.error("Dosya boyutu 50MB sınırını aşıyor!");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", selectedUploadFile);

    // Client-side thumbnail generation for images
    if (selectedUploadFile.type.startsWith("image/")) {
      try {
        const thumbBlob = await generateClientThumbnail(selectedUploadFile);
        if (thumbBlob) {
          formData.append("thumbnail", thumbBlob, "thumbnail_thumb.webp");
        }
      } catch (err) {
        console.error("Client thumbnail generation error:", err);
      }
    }

    if (uploadType === "project" && targetProject) {
      formData.append("project_id", targetProject);
    } else if (uploadType === "client" && targetClient) {
      formData.append("client_id", targetClient);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = async () => {
      let responseData;
      try {
        responseData = JSON.parse(xhr.responseText);
      } catch (e) {
        responseData = { error: "Sunucudan geçersiz yanıt alındı." };
      }

      if (xhr.status === 200 && responseData.data) {
        toast.success("Dosya başarıyla yüklendi!");
        onUploadSuccess(responseData.data);
        onClose();
      } else {
        toast.error("HATA: " + (responseData.error || "Bilinmeyen bir hata oluştu."));
      }
      setIsSubmitting(false);
      setUploadProgress(null);
    };

    xhr.onerror = () => {
      toast.error("Ağ hatası oluştu!");
      setIsSubmitting(false);
      setUploadProgress(null);
    };

    xhr.send(formData);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSubmitting && onClose()} />

      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileUp className="w-5 h-5 text-burgundy" />
            <span>Yeni Dosya Yükle</span>
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Upload Type Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Yükleme Türü
            </label>
            <div className="flex rounded-xl bg-neutral-900/60 p-1 border border-border">
              <button
                type="button"
                onClick={() => setUploadType("project")}
                disabled={isSubmitting || lockType}
                className={cn(
                  "flex-1 h-9 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  uploadType === "project"
                    ? "bg-card text-foreground shadow-sm border border-border/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Projeye Ekle
              </button>
              <button
                type="button"
                onClick={() => setUploadType("client")}
                disabled={isSubmitting || lockType}
                className={cn(
                  "flex-1 h-9 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  uploadType === "client"
                    ? "bg-card text-foreground shadow-sm border border-border/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Müşteriye Ekle
              </button>
            </div>
          </div>

          {/* Target Select */}
          {uploadType === "project" ? (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Hedef Proje
              </label>
              <select
                value={targetProject}
                onChange={(e) => setTargetProject(e.target.value)}
                disabled={isSubmitting || lockType}
                className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              >
                <option value="">Bir proje seçin...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Hedef Müşteri
              </label>
              <select
                value={targetClient}
                onChange={(e) => setTargetClient(e.target.value)}
                disabled={isSubmitting || lockType}
                className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              >
                <option value="">Bir müşteri seçin...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* File Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Dosya Seçimi
            </label>
            <div
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 ${
                selectedUploadFile
                  ? "border-burgundy/60 bg-burgundy/5"
                  : "border-border hover:border-burgundy/40 hover:bg-muted/30"
              }`}
              onClick={() => !isSubmitting && document.getElementById("dialog-file-input")?.click()}
            >
              <input
                type="file"
                id="dialog-file-input"
                className="hidden"
                disabled={isSubmitting}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setSelectedUploadFile(f);
                }}
              />
              <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground/80 mb-2.5" />
              {selectedUploadFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground truncate max-w-[300px] mx-auto">
                    {selectedUploadFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedUploadFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {uploadProgress !== null && (
                    <div className="w-full mt-2.5 bg-neutral-900 rounded-full h-1.5 overflow-hidden border border-border/40">
                      <div
                        className="bg-burgundy h-full transition-all duration-150 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Dosya yüklemek için tıklayın veya sürükleyin
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Herhangi bir tasarım dosyası, resim veya PDF
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/20">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="h-10 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleUpload}
            disabled={isSubmitting || (uploadType === "project" ? !targetProject : !targetClient) || !selectedUploadFile}
            className="h-10 px-5 rounded-xl gradient-burgundy text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-burgundy/15"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Yükleniyor...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Yüklemeyi Başlat</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
