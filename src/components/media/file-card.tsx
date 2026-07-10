"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cn, formatFileSize, formatRelativeTime, getInitials } from "@/lib/utils";
import type { MediaFile } from "@/types/database";
import { deleteMediaFile } from "@/actions/media";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
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
  X,
  Check,
  Edit2,
} from "lucide-react";

interface FileCardProps {
  file: MediaFile & {
    project?: { name: string };
    client?: { name: string };
    uploader?: { full_name: string | null; email: string; avatar_url: string | null };
  };
  onDelete?: (id: string) => void;
}

/**
 * Returns a lucide icon based on the file's mime-type
 */
export function getFileIcon(type: string | undefined | null) {
  const t = (type || "").toLowerCase();
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

export function FileCard({ file, onDelete }: FileCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(file.file_name || "");
  const [isSavingName, setIsSavingName] = useState(false);

  const handleRename = async () => {
    if (!newName.trim()) {
      toast.error("Dosya adı boş bırakılamaz.");
      return;
    }

    if (newName.trim() === file.file_name) {
      setIsRenaming(false);
      return;
    }

    setIsSavingName(true);
    try {
      const supabase = createClient();
      const { error } = await (supabase
        .from('media_files') as any)
        .update({ file_name: newName.trim() })
        .eq('id', file.id);

      if (error) {
        toast.error("Dosya adı güncellenirken hata oluştu: " + error.message);
      } else {
        toast.success("Dosya adı başarıyla güncellendi.");
        file.file_name = newName.trim();
        setIsRenaming(false);
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Dosya adı güncellenemedi: " + message);
    } finally {
      setIsSavingName(false);
    }
  };
  
  const isImage = file.file_type ? file.file_type.startsWith("image/") : false;
  
  // Construct Supabase public URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";
  const fileUrl = `${supabaseUrl}/storage/v1/object/public/media/${file.file_path}`;
  const thumbUrl = file.thumbnail_path
    ? `${supabaseUrl}/storage/v1/object/public/media/${file.thumbnail_path}`
    : fileUrl;

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

    toast("Bu dosyayı kalıcı olarak silmek istediğinizden emin misiniz?", {
      action: {
        label: "Sil",
        onClick: async () => {
          setIsDeleting(true);
          try {
            const res = await deleteMediaFile(file.id);
            if (res && res.error) {
              toast.error("Dosya silinirken hata oluştu: " + res.error);
            } else {
              toast.success("Dosya başarıyla silindi.");
              if (onDelete) {
                onDelete(file.id);
              }
              router.refresh();
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            toast.error("Dosya silinirken hata oluştu: " + message);
          } finally {
            setIsDeleting(false);
          }
        }
      }
    });
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
        <div className="relative rounded-xl md:rounded-2xl bg-card border border-border/80 p-2.5 md:p-3 hover:border-burgundy/60 hover:shadow-lg hover:shadow-burgundy/5 transition-all duration-300 overflow-hidden flex flex-col h-[200px] md:h-[280px]">
          {/* Preview Panel */}
          <div className="relative flex-1 rounded-lg md:rounded-xl bg-muted/65 border border-border/40 overflow-hidden flex items-center justify-center">
            {isImage ? (
              <Image
                src={thumbUrl}
                alt={file.file_name || "Dosya Önizleme"}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 md:gap-2.5">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-card border border-border/60 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                  {getFileIcon(file.file_type)}
                </div>
                <span className="text-[9px] md:text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                  {file.file_type ? file.file_type.split("/")[1]?.toUpperCase() : "DOSYA"}
                </span>
              </div>
            )}

            {/* Floating Top Left Actions */}
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 z-10">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1 rounded-full bg-black/60 border border-white/10 text-red-400 hover:bg-red-950/80 hover:text-red-300 transition-colors backdrop-blur-sm"
                title="Dosyayı Sil"
              >
                {isDeleting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </button>

              <button
                onClick={handleDownload}
                className="p-1 rounded-full bg-black/60 border border-white/10 text-zinc-300 hover:bg-zinc-800/80 hover:text-white transition-colors backdrop-blur-sm"
                title="Dosyayı İndir"
              >
                <Download className="w-3 h-3" />
              </button>
              
              <button
                onClick={handleShareClick}
                className="p-1 rounded-full bg-black/60 border border-white/10 text-zinc-300 hover:bg-zinc-800/80 hover:text-white transition-colors backdrop-blur-sm"
                title="Bağlantıyı Kopyala"
              >
                <Share2 className="w-3 h-3" />
              </button>
            </div>

            {/* Status Badge - Floating */}
            <div className="absolute top-1.5 right-1.5 hidden md:block">
              <div className={cn("flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] md:text-xs font-semibold border backdrop-blur-md", status.bg)}>
                {status.icon}
                <span>{status.label}</span>
              </div>
            </div>

            {/* Version Badge - Floating */}
            <div className="absolute bottom-1.5 left-1.5">
              <div className="bg-black/60 text-white border border-white/10 px-1.5 py-0.5 rounded text-[8px] md:text-[10px] font-bold tracking-wide backdrop-blur-sm">
                V{file.version}
              </div>
            </div>
          </div>

          {/* Content Info */}
          <div className="mt-2 md:mt-3.5 space-y-0.5 md:space-y-1">
            <div className="flex items-center justify-between gap-1">
              {isRenaming ? (
                <div className="flex items-center gap-1.5 w-full pr-1" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <input 
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename();
                      if (e.key === 'Escape') setIsRenaming(false);
                    }}
                    className="flex-1 bg-background/50 border border-input rounded px-1.5 py-0.5 text-xs text-white outline-none focus:border-burgundy"
                    autoFocus
                    disabled={isSavingName}
                  />
                  {isSavingName ? (
                    <Loader2 className="w-3 h-3 animate-spin text-burgundy" />
                  ) : (
                    <>
                      <button onClick={handleRename} className="text-green-500 hover:text-green-400 cursor-pointer">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => setIsRenaming(false)} className="text-red-500 hover:text-red-400 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between w-full group/title">
                  <h3 
                    className="font-semibold text-xs md:text-sm text-foreground truncate group-hover:text-burgundy-light transition-colors pr-2" 
                    title={file.file_name}
                  >
                    {file.file_name}
                  </h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className={cn("inline-block md:hidden px-1.5 py-0.5 rounded text-[8px] font-bold border backdrop-blur-sm scale-90 origin-right shrink-0", status.bg)}>
                      {status.label}
                    </div>
                    <button 
                      onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        setNewName(file.file_name); 
                        setIsRenaming(true); 
                      }} 
                      className="opacity-100 md:opacity-0 group-hover/title:opacity-100 transition-opacity text-muted-foreground hover:text-white cursor-pointer"
                      title="Yeniden Adlandır"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
              {!isRenaming && (
                <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
              )}
            </div>
            
            <div className="flex items-center justify-between text-[10px] md:text-xs text-muted-foreground">
              <span className="truncate max-w-[85px] md:max-w-[130px]" title={file.project?.name || file.client?.name || "Genel"}>
                {file.project?.name 
                  ? file.project.name 
                  : (file.client?.name ? file.client.name : "Genel")}
              </span>
              <span>{formatFileSize(file.file_size)}</span>
            </div>

            {/* Uploader Footer */}
            <div className="pt-1.5 mt-1.5 border-t border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-burgundy/10 border border-burgundy/30 text-[8px] md:text-[9px] font-bold text-burgundy flex items-center justify-center overflow-hidden">
                  {file.uploader?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.uploader.avatar_url} alt={file.uploader.full_name || ""} className="object-cover w-full h-full" />
                  ) : (
                    getInitials(file.uploader?.full_name || file.uploader?.email || "U")
                  )}
                </div>
                <span className="text-[9px] md:text-[11px] font-medium text-foreground/70 truncate max-w-[70px] md:max-w-[110px]">
                  {file.uploader?.full_name || file.uploader?.email.split("@")[0]}
                </span>
              </div>
              <span className="text-[9px] md:text-[10px] text-muted-foreground/80">
                {formatRelativeTime(file.created_at)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </>
  );
}
