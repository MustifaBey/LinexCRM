"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnnotationCanvas } from "./annotation-canvas";
import { VersionHistory } from "./version-history";
import {
  getMediaFileDetail,
  updateMediaStatus,
  createAnnotation,
} from "@/actions/media";
import type { MediaFile, MediaAnnotation } from "@/types/database";
import { useRealtime } from "@/hooks/use-realtime";
import { cn, formatFileSize, getInitials } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  HelpCircle,
  Clock,
  ChevronRight,
  MessageSquare,
  History,
  Send,
  Loader2,
  Download,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface MediaReviewPortalProps {
  initialFile: MediaFile & { project?: { name: string }; uploader?: { full_name: string | null; email: string; avatar_url: string | null } };
  initialLineage: MediaFile[];
  isAdminOrStaff: boolean;
  backUrl?: string;
}

export function MediaReviewPortal({
  initialFile,
  initialLineage,
  isAdminOrStaff,
  backUrl,
}: MediaReviewPortalProps) {
  const router = useRouter();
  const [currentFile, setCurrentFile] = useState(initialFile);
  const [lineage, setLineage] = useState<MediaFile[]>(initialLineage);
  const [annotations, setAnnotations] = useState<MediaAnnotation[]>(
    initialFile.annotations || []
  );
  
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"feedback" | "history">("feedback");
  const [isPending, startTransition] = useTransition();

  // General comment input state for non-images
  const [generalComment, setGeneralComment] = useState("");
  const [commentPending, setCommentPending] = useState(false);

  const isImage = currentFile.file_type.startsWith("image/");
  
  // Construct Supabase public URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";
  const fileUrl = `${supabaseUrl}/storage/v1/object/public/media/${currentFile.file_path}`;

  // Realtime subscription for Annotations
  useRealtime<MediaAnnotation>({
    table: "media_annotations",
    filterColumn: "media_file_id",
    filterValue: currentFile.id,
    onInsert: (newAnn) => {
      // Find author profile if uploader matches
      setAnnotations((prev) => {
        if (prev.some((a) => a.id === newAnn.id)) return prev;
        return [...prev, newAnn];
      });
    },
    onUpdate: (updatedAnn) => {
      setAnnotations((prev) =>
        prev.map((a) => (a.id === updatedAnn.id ? { ...a, ...updatedAnn } : a))
      );
    },
    onDelete: (deletedAnn) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== deletedAnn.id));
    },
  });

  // Realtime subscription for File status updates
  useRealtime<MediaFile>({
    table: "media_files",
    filterColumn: "id",
    filterValue: currentFile.id,
    onUpdate: (updatedFile) => {
      setCurrentFile((prev) => ({
        ...prev,
        status: updatedFile.status,
      }));
    },
  });

  // Switch versions in history
  const handleSelectVersion = async (versionFile: MediaFile) => {
    startTransition(async () => {
      const result = await getMediaFileDetail(versionFile.id);
      if (result.error || !result.data) {
        toast.error("Failed to load version details");
        return;
      }
      
      setCurrentFile(result.data.file as any);
      setAnnotations(result.data.file.annotations || []);
      setActiveAnnotationId(null);
      // Keep project metadata
      setCurrentFile((prev) => ({
        ...prev,
        project: currentFile.project,
      }));
    });
  };

  const handleUploadSuccess = (newFile: MediaFile) => {
    // Append new file to version history lineage and select it
    setLineage((prev) => [...prev, newFile]);
    handleSelectVersion(newFile);
  };

  // Change Approval Status
  const handleStatusChange = (status: "approved" | "rejected" | "in_review") => {
    startTransition(async () => {
      const result = await updateMediaStatus(currentFile.id, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Design status set to ${status}`);
      setCurrentFile((prev) => ({ ...prev, status }));
      
      // Update this file in lineage array too
      setLineage((prev) =>
        prev.map((f) => (f.id === currentFile.id ? { ...f, status } : f))
      );
    });
  };

  // Create general comment (annotation with 0,0 coordinates)
  const handleAddGeneralComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generalComment.trim()) return;

    setCommentPending(true);
    try {
      const result = await createAnnotation({
        media_file_id: currentFile.id,
        x_percent: 0,
        y_percent: 0,
        comment: generalComment.trim(),
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Feedback added");
        setGeneralComment("");
        // Local list updates dynamically via Realtime channel
      }
    } catch (err: any) {
      toast.error("Failed to submit feedback");
    } finally {
      setCommentPending(false);
    }
  };

  // Status badge classes
  const statusBadges = {
    uploaded: "bg-zinc-800 text-zinc-300 border-zinc-700",
    in_review: "bg-amber-950/40 text-amber-400 border-amber-800/50",
    approved: "bg-emerald-950/40 text-emerald-400 border-emerald-800/50 animate-pulse",
    rejected: "bg-red-950/40 text-red-400 border-red-800/50",
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card/40 border border-border/60 p-4 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href={backUrl || "/media"}
            className="p-2.5 rounded-xl border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                {currentFile.project?.name || "No Project"}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
              <div className="bg-black/60 border border-border px-1.5 py-0.5 rounded text-[9px] font-bold text-white leading-none">
                V{currentFile.version}
              </div>
            </div>
            <h1 className="text-lg font-bold text-foreground mt-0.5 truncate max-w-[320px] lg:max-w-md">
              {currentFile.file_name}
            </h1>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Indicators */}
          <div className={cn("px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5", statusBadges[currentFile.status])}>
            {currentFile.status === "approved" && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
            {currentFile.status === "rejected" && <XCircle className="w-3.5 h-3.5 text-red-400" />}
            {currentFile.status === "in_review" && <HelpCircle className="w-3.5 h-3.5 text-amber-400" />}
            {currentFile.status === "uploaded" && <Clock className="w-3.5 h-3.5 text-zinc-400" />}
            <span className="capitalize">{currentFile.status.replace("_", " ")}</span>
          </div>

          <div className="h-6 w-px bg-border/60 mx-1 hidden sm:block" />

          {/* Quick Approval / Rejection Controls */}
          {currentFile.status !== "approved" && (
            <button
              onClick={() => handleStatusChange("approved")}
              disabled={isPending}
              className="h-9 px-3.5 rounded-xl border border-emerald-800 bg-emerald-950/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-950/50 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Approve Design</span>
            </button>
          )}

          {currentFile.status !== "rejected" && (
            <button
              onClick={() => handleStatusChange("rejected")}
              disabled={isPending}
              className="h-9 px-3.5 rounded-xl border border-red-800 bg-red-950/20 text-red-400 text-xs font-semibold flex items-center gap-1.5 hover:bg-red-950/50 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reject Design</span>
            </button>
          )}

          {currentFile.status === "uploaded" && (
            <button
              onClick={() => handleStatusChange("in_review")}
              disabled={isPending}
              className="h-9 px-3.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Move to Review</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Review Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
        {/* Left Preview Section (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {isImage ? (
            <AnnotationCanvas
              fileId={currentFile.id}
              imageUrl={fileUrl}
              annotations={annotations}
              activeAnnotationId={activeAnnotationId}
              onSelectPin={setActiveAnnotationId}
              isAdminOrStaff={isAdminOrStaff}
              onAnnotationCreated={(newAnn) => {
                setAnnotations((prev) => {
                  if (prev.some((a) => a.id === newAnn.id)) return prev;
                  return [...prev, newAnn];
                });
              }}
              onAnnotationUpdated={(id, updates) => {
                setAnnotations((prev) =>
                  prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
                );
              }}
              onAnnotationDeleted={(id) => {
                setAnnotations((prev) => prev.filter((a) => a.id !== id));
              }}
            />
          ) : (
            /* Non-image File Viewer */
            <div className="bg-card border border-border/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-5 min-h-[450px]">
              <div className="w-20 h-20 rounded-2xl bg-burgundy/10 border border-burgundy/30 flex items-center justify-center text-burgundy shadow-inner">
                <Download className="w-10 h-10" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-base font-bold text-foreground">
                  Non-image Asset Review
                </h3>
                <p className="text-xs text-muted-foreground">
                  Pin comments are only available on image files (PNG, JPG, SVG, WebP). Use the side panel below to submit general comments.
                </p>
                <div className="bg-muted/40 rounded-xl p-2.5 border border-border/40 text-xs text-left font-mono mt-3 select-all">
                  Name: {currentFile.file_name}<br/>
                  Type: {currentFile.file_type}<br/>
                  Size: {formatFileSize(currentFile.file_size)}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href={fileUrl}
                  download={currentFile.file_name}
                  className="h-10 px-5 rounded-xl gradient-burgundy text-white text-xs font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </a>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 px-4 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-semibold flex items-center gap-2 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in Tab</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right Tabbed Panel Section (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Tab Selector */}
          <div className="flex bg-muted/60 border border-border/60 p-1.5 rounded-xl">
            <button
              onClick={() => setActiveTab("feedback")}
              className={cn(
                "flex-1 h-8 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                activeTab === "feedback"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Feedback Pins</span>
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "flex-1 h-8 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                activeTab === "history"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <History className="w-3.5 h-3.5" />
              <span>Revisions</span>
            </button>
          </div>

          {/* Tab Content 1: Feedback Pins */}
          {activeTab === "feedback" && (
            <div className="space-y-4">
              <div className="bg-card border border-border/80 rounded-2xl p-4 flex flex-col h-[400px]">
                <h3 className="text-xs font-bold text-foreground/80 uppercase tracking-wider mb-3">
                  Feedback Pins ({annotations.length})
                </h3>

                {/* Comment list */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {annotations.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <MessageSquare className="w-8 h-8 text-muted-foreground/60 mb-2" />
                      <span className="text-xs text-muted-foreground">
                        No feedback pins dropped yet.
                      </span>
                    </div>
                  ) : (
                    annotations
                      .sort(
                        (a, b) =>
                          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                      )
                      .map((ann, idx) => {
                        const index = idx + 1;
                        const isActive = activeAnnotationId === ann.id;
                        const isResolved = ann.is_resolved;
                        const authorName = (ann as any).author?.full_name || (ann as any).author?.email || "User";
                        const initials = getInitials(authorName);

                        return (
                          <div
                            key={ann.id}
                            onClick={() => setActiveAnnotationId(ann.id)}
                            className={cn(
                              "p-3 rounded-xl border cursor-pointer transition-all text-xs space-y-2",
                              isActive
                                ? "border-burgundy bg-burgundy/5 ring-1 ring-burgundy/10"
                                : "border-border/60 bg-muted/20 hover:border-border"
                            )}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              {/* Avatar + Index */}
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] leading-none shrink-0",
                                  isResolved 
                                    ? "bg-emerald-950/80 text-emerald-400 border border-emerald-700/50" 
                                    : "bg-burgundy text-white"
                                )}>
                                  {index}
                                </span>
                                <span className="font-semibold text-foreground truncate max-w-[100px]" title={authorName}>
                                  {authorName}
                                </span>
                              </div>

                              {isResolved && (
                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 rounded px-1.5 py-0.5">
                                  Resolved
                                </span>
                              )}
                            </div>

                            {/* Comment comment text */}
                            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed select-text">
                              {ann.comment}
                            </p>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* General comment form (always active for non-images) */}
              {!isImage && (
                <form
                  onSubmit={handleAddGeneralComment}
                  className="bg-card border border-border/80 p-4 rounded-2xl space-y-2.5"
                >
                  <label className="text-xs font-bold text-foreground/80 uppercase tracking-wider block">
                    Submit General Feedback
                  </label>
                  <div className="relative">
                    <textarea
                      value={generalComment}
                      onChange={(e) => setGeneralComment(e.target.value)}
                      placeholder="Type design comment or approval remarks..."
                      rows={3}
                      disabled={commentPending}
                      className="w-full text-xs p-2.5 pr-10 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
                    />
                    <button
                      type="submit"
                      disabled={commentPending || !generalComment.trim()}
                      className="absolute right-2 bottom-2.5 p-2 rounded-lg bg-burgundy hover:opacity-90 disabled:opacity-50 text-white transition-opacity"
                    >
                      {commentPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Tab Content 2: History */}
          {activeTab === "history" && (
            <div className="bg-card border border-border/80 rounded-2xl p-4 min-h-[400px]">
              <h3 className="text-xs font-bold text-foreground/80 uppercase tracking-wider mb-3">
                Revision Chain
              </h3>
              <VersionHistory
                currentFile={currentFile}
                lineage={lineage}
                onSelectVersion={handleSelectVersion}
                onUploadSuccess={handleUploadSuccess}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
