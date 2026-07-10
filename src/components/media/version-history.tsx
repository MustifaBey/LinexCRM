"use client";

import { useState, useTransition } from "react";
import type { MediaFile } from "@/types/database";
import { cn, formatFileSize, formatRelativeTime, getInitials, generateClientThumbnail } from "@/lib/utils";
import { UploadCloud, CheckCircle2, XCircle, Clock, HelpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface VersionHistoryProps {
  currentFile: MediaFile;
  lineage: MediaFile[];
  onSelectVersion: (file: MediaFile) => void;
  onUploadSuccess: (newFile: MediaFile) => void;
}

export function VersionHistory({
  currentFile,
  lineage,
  onSelectVersion,
  onUploadSuccess,
}: VersionHistoryProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Status icons
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case "rejected":
        return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
      case "in_review":
        return <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    }
  };

  const handleRevisionUpload = async (file: File) => {
    // Find the latest file in the lineage to serve as the direct parent
    const latestFile = lineage[lineage.length - 1];
    if (!latestFile) {
      toast.error("Üst dosya bilgisi bulunamadı.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Client-side thumbnail generation for images
      if (file.type.startsWith("image/")) {
        try {
          const thumbBlob = await generateClientThumbnail(file);
          if (thumbBlob) {
            formData.append("thumbnail", thumbBlob, "thumbnail_thumb.webp");
          }
        } catch (err) {
          console.error("Client-side thumbnail generation failed:", err);
        }
      }

      if (latestFile.project_id) {
        formData.append("project_id", latestFile.project_id);
      }
      if (latestFile.client_id) {
        formData.append("client_id", latestFile.client_id);
      }
      formData.append("parent_file_id", latestFile.id);

      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Dosya yüklenirken bir hata oluştu.");
      }

      toast.success(`Yeni sürüm V${latestFile.version + 1} başarıyla yüklendi!`);

      // Format object structure for state merge
      const newFileRecord = {
        ...result.data,
        uploader: {
          full_name: "You",
          email: "",
          avatar_url: null
        }
      };

      onUploadSuccess(newFileRecord as any);
    } catch (err: any) {
      console.error("Revision upload error details:", err);
      toast.error(err.message || "Dosya yüklenirken beklenmeyen bir hata oluştu");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Revision Area */}
      <div className="bg-card border border-border/80 p-4 rounded-2xl space-y-3">
        <h4 className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
          Revizyon Yükle
        </h4>
        <p className="text-[11px] text-muted-foreground leading-normal">
          Bu sürüm geçmişi zincirinin üzerine V
          {lineage[lineage.length - 1]?.version + 1 || 1} olarak eklenecek yeni bir tasarım dosyası yükleyin.
        </p>

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
            if (file) handleRevisionUpload(file);
          }}
          onClick={() => !isSubmitting && document.getElementById("rev-input")?.click()}
          className={cn(
            "border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-300",
            dragActive
              ? "border-burgundy bg-burgundy/5 scale-98"
              : "border-border/60 hover:border-burgundy/40 hover:bg-muted/30",
            isSubmitting && "pointer-events-none opacity-50"
          )}
        >
          <input
            type="file"
            id="rev-input"
            className="hidden"
            disabled={isSubmitting}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleRevisionUpload(file);
            }}
          />
          {isSubmitting ? (
            <div className="flex flex-col items-center gap-1">
              <Loader2 className="w-6 h-6 text-burgundy animate-spin mb-1" />
              <span className="text-xs text-foreground font-semibold">
                Revizyon yükleniyor...
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <UploadCloud className="w-7 h-7 text-muted-foreground/85" />
              <span className="text-xs font-medium text-foreground">
                Yeni revizyon yükle
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Timeline Node Chain */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
        {lineage.slice().reverse().map((file, idx) => {
          const isActive = file.id === currentFile.id;
          const uploaderName = (file as any).uploader?.full_name || (file as any).uploader?.email || "User";
          const initials = getInitials(uploaderName);

          return (
            <div key={file.id} className="relative group/timeline">
              {/* Timeline dot */}
              <div
                className={cn(
                  "absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 transform -translate-x-1/2 transition-colors",
                  isActive
                    ? "bg-burgundy border-burgundy scale-120 shadow-md shadow-burgundy/20"
                    : "bg-background border-zinc-500 hover:border-burgundy"
                )}
              />

              <div
                onClick={() => onSelectVersion(file)}
                className={cn(
                  "cursor-pointer p-3.5 rounded-xl border transition-all duration-300 flex flex-col gap-2 bg-card/45 hover:border-burgundy/40",
                  isActive
                    ? "border-burgundy bg-burgundy/5 ring-1 ring-burgundy/10 shadow-sm"
                    : "border-border/80"
                )}
              >
                {/* Node Top: V# & status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">
                      Sürüm V{file.version}
                    </span>
                    {isActive && (
                      <span className="text-[9px] bg-burgundy/10 border border-burgundy/30 text-burgundy font-bold py-0.5 px-1.5 rounded-md leading-none">
                        Aktif
                      </span>
                    )}
                  </div>
                  {getStatusIcon(file.status)}
                </div>

                {/* Node mid: Size & date */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{formatFileSize(file.file_size)}</span>
                  <span>{formatRelativeTime(file.created_at)}</span>
                </div>

                {/* Node Bottom: uploader */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                  <div className="w-4 h-4 rounded-full bg-burgundy/10 text-[8px] font-bold text-burgundy flex items-center justify-center overflow-hidden">
                    {(file as any).uploader?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={(file as any).uploader.avatar_url} alt="" className="object-cover w-full h-full" />
                    ) : (
                      initials
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-foreground/75 truncate max-w-[120px]">
                    {uploaderName}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
