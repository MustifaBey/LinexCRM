"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { updateMediaStatus } from "@/actions/media";
import { getPortalMediaFiles } from "@/actions/media";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  ImagePlus,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface PortalMediaGridProps {
  initialFiles: any[];
  initialCount: number;
  clientProjectIds: string[];
}

export function PortalMediaGrid({
  initialFiles,
  initialCount,
  clientProjectIds,
}: PortalMediaGridProps) {
  const [files, setFiles] = useState<any[]>(initialFiles);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(totalCount / 6) || 1;

  const handlePageChange = async (targetPage: number) => {
    if (targetPage < 1 || targetPage > totalPages || targetPage === page || isLoading) return;
    
    setIsLoading(true);
    try {
      const res = await getPortalMediaFiles({
        page: targetPage,
        limit: 6,
        projectIds: clientProjectIds,
      });

      if (res.data) {
        setFiles(res.data);
        setPage(targetPage);
        if (typeof res.count === "number") {
          setTotalCount(res.count);
        }
      } else {
        toast.error("Dosyalar yüklenirken hata oluştu: " + res.error);
      }
    } catch (err: any) {
      toast.error("Dosyalar yüklenirken hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMediaAction = (fileId: string, action: "approved" | "rejected") => {
    startTransition(async () => {
      const res = await updateMediaStatus(fileId, action);
      if (res.error) {
        toast.error("İşlem gerçekleştirilemedi: " + res.error);
      } else {
        toast.success(action === "approved" ? "Tasarım başarıyla onaylandı!" : "Tasarım reddedildi.");
        // Update local status of the actioned file
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: action } : f))
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-burgundy" />
          <span className="text-sm text-muted-foreground">Tasarım dosyaları yükleniyor...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="col-span-3 text-center p-12 border border-dashed border-border/80 rounded-2xl text-muted-foreground text-sm">
          Paylaşılan dosya bulunmamaktadır.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            {files.map((file) => {
              const isApproved = file.status === "approved";
              const isRejected = file.status === "rejected";
              const isPendingReview = file.status === "in_review" || file.status === "uploaded";

              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";
              const fileUrl = `${supabaseUrl}/storage/v1/object/public/media/${file.file_path}`;
              const thumbUrl = file.thumbnail_path
                ? `${supabaseUrl}/storage/v1/object/public/media/${file.thumbnail_path}`
                : fileUrl;

              return (
                <div
                  key={file.id}
                  className="bg-card border border-border/80 rounded-2xl p-2.5 md:p-4 shadow-lg flex flex-col justify-between min-h-[220px] md:min-h-[320px] hover:border-border transition-all"
                >
                  <Link
                    href={`/portal/media/${file.id}`}
                    className="relative aspect-video rounded-xl bg-muted overflow-hidden flex items-center justify-center border border-border/40 select-none cursor-pointer hover:opacity-95 transition-opacity block w-full"
                  >
                    {file.file_type.startsWith("image/") ? (
                      <Image
                        src={thumbUrl}
                        alt={file.file_name || "Tasarım Dosyası"}
                        fill
                        sizes="(max-width: 768px) 50vw, 33vw"
                        className="object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-center p-2 md:p-4">
                        <ImagePlus className="w-6 h-6 md:w-10 md:h-10 text-muted-foreground/80 mx-auto mb-1 md:mb-2" />
                        <span className="text-[8px] md:text-[10px] font-bold text-muted-foreground uppercase">
                          {file.file_type.split("/")[1] || "Dosya"}
                        </span>
                      </div>
                    )}

                    <div className="absolute top-1.5 right-1.5 md:top-2.5 md:right-2.5 z-10">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase border backdrop-blur-md shadow-sm scale-90 md:scale-100 origin-top-right",
                          isApproved && "bg-emerald-950/60 border-emerald-800/60 text-emerald-400",
                          isRejected && "bg-red-950/60 border-red-800/60 text-red-400",
                          isPendingReview && "bg-zinc-850/70 border-zinc-700/60 text-zinc-300"
                        )}
                      >
                        {isApproved && "Onaylandı"}
                        {isRejected && "Reddedildi"}
                        {isPendingReview && "Onay Bekliyor"}
                      </span>
                    </div>
                  </Link>

                  <div className="space-y-0.5 md:space-y-1 mt-2.5 md:mt-4">
                    <h3 className="font-bold text-xs md:text-sm text-foreground truncate" title={file.file_name}>
                      {file.file_name}
                    </h3>
                    <p className="text-[9px] md:text-[10px] text-muted-foreground">Proje: {file.project?.name || "Genel"}</p>
                  </div>

                  <div className="mt-2.5 md:mt-4 pt-2 md:pt-3 border-t border-border/40 flex gap-1.5 md:gap-2 w-full select-none">
                    {isPendingReview ? (
                      <>
                        <button
                          onClick={() => handleMediaAction(file.id, "approved")}
                          disabled={isPending}
                          className="flex-1 h-8 md:h-9 rounded-xl bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-800/40 text-emerald-400 hover:text-emerald-300 text-[10px] md:text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          <span>Onayla</span>
                        </button>

                        <button
                          onClick={() => handleMediaAction(file.id, "rejected")}
                          disabled={isPending}
                          className="flex-1 h-8 md:h-9 rounded-xl bg-red-950/30 hover:bg-red-900/40 border border-red-800/40 text-red-400 hover:text-red-300 text-[10px] md:text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          <span>Reddet</span>
                        </button>
                      </>
                    ) : (
                      <div className="w-full text-center py-1.5 md:py-2 text-[9px] md:text-xs text-muted-foreground bg-muted/20 border border-border/30 rounded-xl font-medium">
                        <span className="hidden md:inline">
                          {isApproved && "Bu tasarım dosyası onaylanmıştır."}
                          {isRejected && "Bu tasarım dosyası reddedilmiştir."}
                        </span>
                        <span className="inline md:hidden">
                          {isApproved && "Tasarım onaylandı."}
                          {isRejected && "Tasarım reddedildi."}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Numbered Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-4">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1 || isLoading}
                className="w-9 h-9 rounded-xl border border-border bg-card text-muted-foreground flex items-center justify-center hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-muted-foreground transition-all cursor-pointer"
                title="Geri"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                const isActive = pageNum === page;

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    disabled={isLoading}
                    className={cn(
                      "w-9 h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                      isActive
                        ? "bg-burgundy border-burgundy text-white shadow-md shadow-burgundy/15"
                        : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages || isLoading}
                className="w-9 h-9 rounded-xl border border-border bg-card text-muted-foreground flex items-center justify-center hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-muted-foreground transition-all cursor-pointer"
                title="İleri"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
