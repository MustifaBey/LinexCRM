"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn, formatFileSize, formatRelativeTime, getInitials } from "@/lib/utils";
import type { MediaFile } from "@/types/database";
import { deleteMediaFile } from "@/actions/media";
import { toast } from "sonner";
import {
  FileText,
  FileArchive,
  FileCode,
  FileIcon,
  Video,
  Music,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ChevronRight,
  Trash2,
  Loader2,
  Share2,
  Download,
} from "lucide-react";

interface FileCardProps {
  file: MediaFile & { project?: { name: string }; uploader?: { full_name: string | null; email: string; avatar_url: string | null } };
}

/**
 * Returns a lucide icon based on the file's mime-type
 */
export function getFileIcon(type: string) {
  const t = type.toLowerCase();
  if (t.startsWith("image/")) return null; // handled separately
  if (t.startsWith("video/")) return <Video className="w-8 h-8 text-burgundy" />;
  if (t.startsWith("audio/")) return <Music className="w-8 h-8 text-burgundy" />;
  if (t.includes("pdf")) return <FileText className="w-8 h-8 text-red-500" />;
  if (t.includes("zip") || t.includes("tar") || t.includes("rar") || t.includes("gzip")) {
    return <FileArchive className="w-8 h-8 text-amber-500" />;
  }
  if (t.includes("html") || t.includes("javascript") || t.includes("typescript") || t.includes("css") || t.includes("json")) {
    return <FileCode className="w-8 h-8 text-emerald-500" />;
  }
  return <FileIcon className="w-8 h-8 text-muted-foreground" />;
}

export function FileCard({ file }: FileCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isImage = file.file_type.startsWith("image/");
  
  // Construct Supabase public URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";
  const fileUrl = `${supabaseUrl}/storage/v1/object/public/media/${file.file_path}`;

  // Status styling in Turkish
  const statusStyles = {
    uploaded: {
      bg: "bg-zinc-800/80 text-zinc-300 border-zinc-700",
      icon: <Clock className="w-3.5 h-3.5" />,
      label: "Yüklendi",
    },
    in_review: {
      bg: "bg-amber-950/40 text-amber-400 border-amber-800/50",
      icon: <HelpCircle className="w-3.5 h-3.5" />,
      label: "İncelemede",
    },
    approved: {
      bg: "bg-emerald-950/40 text-emerald-400 border-emerald-800/50",
      icon: <CheckCircle2 className="w-3.5 h-3.5 animate-pulse" />,
      label: "Onaylandı",
    },
    rejected: {
      bg: "bg-red-950/40 text-red-400 border-red-800/50",
      icon: <XCircle className="w-3.5 h-3.5" />,
      label: "Reddedildi",
    },
  };

  const status = statusStyles[file.status] || statusStyles.uploaded;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Bu dosyayı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteMediaFile(file.id);
      if (res && res.error) {
        toast.error("Dosya silinirken hata oluştu: " + res.error);
      } else {
        toast.success("Dosya başarıyla silindi.");
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Dosya silinirken hata oluştu: " + message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(fileUrl);
    toast.success("Dosya bağlantısı kopyalandı!");
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("İndirme başlatıldı.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Dosya indirilemedi: " + message);
    }
  };

  return (
    <>
      <Link href={`/media/${file.id}`} className="group block">
        <div className="relative rounded-2xl bg-card border border-border/80 p-3 hover:border-burgundy/60 hover:shadow-lg hover:shadow-burgundy/5 transition-all duration-300 overflow-hidden flex flex-col h-[280px]">
          {/* Preview Panel */}
          <div className="relative flex-1 rounded-xl bg-muted/65 border border-border/40 overflow-hidden flex items-center justify-center">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fileUrl}
                alt={file.file_name}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            ) : (
              <div className="flex flex-col items-center gap-2.5">
                <div className="w-16 h-16 rounded-2xl bg-card border border-border/60 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                  {getFileIcon(file.file_type)}
                </div>
                <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                  {file.file_type.split("/")[1]?.toUpperCase() || "DOSYA"}
                </span>
              </div>
            )}

            {/* Floating Top Left Actions (hover only) */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 rounded-full bg-black/60 border border-white/10 text-red-400 hover:bg-red-950/80 hover:text-red-300 transition-colors backdrop-blur-sm"
                title="Dosyayı Sil"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                onClick={handleDownload}
                className="p-1.5 rounded-full bg-black/60 border border-white/10 text-zinc-300 hover:bg-zinc-800/80 hover:text-white transition-colors backdrop-blur-sm"
                title="Dosyayı İndir"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              
              <button
                onClick={handleShareClick}
                className="p-1.5 rounded-full bg-black/60 border border-white/10 text-zinc-300 hover:bg-zinc-800/80 hover:text-white transition-colors backdrop-blur-sm"
                title="Bağlantıyı Kopyala"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Status Badge - Floating */}
            <div className="absolute top-2.5 right-2.5">
              <div className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-md", status.bg)}>
                {status.icon}
                <span>{status.label}</span>
              </div>
            </div>

            {/* Version Badge - Floating */}
            <div className="absolute bottom-2.5 left-2.5">
              <div className="bg-black/60 text-white border border-white/10 px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wide backdrop-blur-sm">
                V{file.version}
              </div>
            </div>
          </div>

          {/* Content Info */}
          <div className="mt-3.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-burgundy-light transition-colors" title={file.file_name}>
                {file.file_name}
              </h3>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{file.project?.name || "Projesiz"}</span>
              <span>{formatFileSize(file.file_size)}</span>
            </div>

            {/* Uploader Footer */}
            <div className="pt-2.5 mt-2 border-t border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-burgundy/10 border border-burgundy/30 text-[9px] font-bold text-burgundy flex items-center justify-center overflow-hidden">
                  {file.uploader?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.uploader.avatar_url} alt={file.uploader.full_name || ""} className="object-cover w-full h-full" />
                  ) : (
                    getInitials(file.uploader?.full_name || file.uploader?.email || "U")
                  )}
                </div>
                <span className="text-[11px] font-medium text-foreground/70 truncate max-w-[110px]">
                  {file.uploader?.full_name || file.uploader?.email.split("@")[0]}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/80">
                {formatRelativeTime(file.created_at)}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {/* Share Modal Dialog Removed */}
    </>
  );
}

