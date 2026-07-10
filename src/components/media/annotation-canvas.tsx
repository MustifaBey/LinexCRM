"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { createAnnotation, resolveAnnotation, deleteAnnotation } from "@/actions/media";
import type { MediaAnnotation } from "@/types/database";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { Check, Trash2, Send, X, MessageSquare, CheckSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface AnnotationCanvasProps {
  fileId: string;
  imageUrl: string;
  annotations: MediaAnnotation[];
  onAnnotationCreated?: (newAnn: any) => void;
  onAnnotationUpdated?: (annId: string, updates: Partial<MediaAnnotation>) => void;
  onAnnotationDeleted?: (annId: string) => void;
  activeAnnotationId?: string | null;
  onSelectPin?: (annId: string | null) => void;
  isAdminOrStaff?: boolean;
}

export function AnnotationCanvas({
  fileId,
  imageUrl,
  annotations,
  onAnnotationCreated,
  onAnnotationUpdated,
  onAnnotationDeleted,
  activeAnnotationId,
  onSelectPin,
  isAdminOrStaff = false,
}: AnnotationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tempPinMarkerRef = useRef<HTMLDivElement>(null);
  
  const [tempPin, setTempPin] = useState<{ x: number; y: number } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [mounted, setMounted] = useState(false);
  const [tempCoords, setTempCoords] = useState<{ left: number; top: number } | null>(null);

  // Sync internal active state with prop
  useEffect(() => {
    if (activeAnnotationId) {
      setActivePinId(activeAnnotationId);
    }
  }, [activeAnnotationId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track temporary pin coords
  useEffect(() => {
    if (!tempPin || !mounted) {
      setTempCoords(null);
      return;
    }

    const updateTempCoords = () => {
      if (tempPinMarkerRef.current) {
        const rect = tempPinMarkerRef.current.getBoundingClientRect();
        setTempCoords({
          left: rect.left + rect.width / 2,
          top: rect.top - 8,
        });
      }
    };

    const animId = requestAnimationFrame(updateTempCoords);

    window.addEventListener("scroll", updateTempCoords, true);
    window.addEventListener("resize", updateTempCoords);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("scroll", updateTempCoords, true);
      window.removeEventListener("resize", updateTempCoords);
    };
  }, [tempPin, mounted]);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If clicking directly on a pin or a portal element (in React tree), do not place a new one
    if ((e.target as HTMLElement).closest(".pin-element")) return;

    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setTempPin({ x, y });
    setCommentText("");
    setActivePinId(null);
    if (onSelectPin) onSelectPin(null);
  };

  const handleAddAnnotation = () => {
    if (!tempPin || !commentText.trim()) return;

    startTransition(async () => {
      const result = await createAnnotation({
        media_file_id: fileId,
        x_percent: parseFloat(tempPin.x.toFixed(2)),
        y_percent: parseFloat(tempPin.y.toFixed(2)),
        comment: commentText.trim(),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Geri bildirim pini yerleştirildi");
      setTempPin(null);
      setCommentText("");

      if (onAnnotationCreated) {
        onAnnotationCreated(result.data);
      }
    });
  };

  const handleToggleResolve = (ann: MediaAnnotation) => {
    const nextResolved = !ann.is_resolved;
    startTransition(async () => {
      const result = await resolveAnnotation(ann.id, nextResolved);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(nextResolved ? "Pin çözüldü olarak işaretlendi" : "Pin yeniden açıldı");
      if (onAnnotationUpdated) {
        onAnnotationUpdated(ann.id, { is_resolved: nextResolved });
      }
    });
  };

  const handleDelete = (annId: string) => {
    if (!window.confirm("Bu pini silmek istediğinize emin misiniz?")) return;

    startTransition(async () => {
      const result = await deleteAnnotation(annId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Geri bildirim pini kaldırıldı");
      if (onAnnotationDeleted) {
        onAnnotationDeleted(annId);
      }
      if (activePinId === annId) {
        setActivePinId(null);
        if (onSelectPin) onSelectPin(null);
      }
    });
  };

  const handlePinClick = (annId: string) => {
    const nextId = activePinId === annId ? null : annId;
    setActivePinId(nextId);
    setTempPin(null); // Cancel temp pin if opening existing
    if (onSelectPin) onSelectPin(nextId);
  };

  const sortedAnnotations = [...annotations].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="relative select-none w-full border border-border/80 rounded-2xl overflow-hidden bg-zinc-950">
      {/* Tip Banner */}
      <div className="bg-muted/30 px-4 py-2 border-b border-border/50 text-[11px] text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-medium">
          <MessageSquare className="w-3.5 h-3.5 text-burgundy" />
          Geri bildirim pini bırakmak için aşağıdaki görsele tıklayın
        </span>
      </div>

      {/* Interactive Image Container */}
      <div
        ref={containerRef}
        onClick={handleImageClick}
        className="relative cursor-crosshair max-w-full overflow-hidden flex items-center justify-center p-2"
        style={{ minHeight: "300px" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Annotation Canvas"
          className="max-w-full max-h-[70vh] object-contain rounded-lg pointer-events-none select-none"
        />

        {/* Existing Pins */}
        {sortedAnnotations.map((ann, idx) => {
          const index = idx + 1;
          const isActive = activePinId === ann.id;
          const isHovered = hoveredPinId === ann.id;

          return (
            <PinBubble
              key={ann.id}
              ann={ann}
              index={index}
              isActive={isActive}
              isHovered={isHovered}
              onPinClick={handlePinClick}
              onMouseEnter={() => setHoveredPinId(ann.id)}
              onMouseLeave={() => setHoveredPinId(null)}
              onToggleResolve={handleToggleResolve}
              onDelete={handleDelete}
              isPending={isPending}
              isAdminOrStaff={isAdminOrStaff}
            />
          );
        })}

        {/* Temporary Pin Marker in canvas */}
        {tempPin && (
          <div
            ref={tempPinMarkerRef}
            className="temp-pin-marker absolute"
            style={{
              left: `${tempPin.x}%`,
              top: `${tempPin.y}%`,
            }}
          >
            <div className="relative">
              <div className="absolute inset-0 -m-2 rounded-full bg-burgundy/30 animate-ping pointer-events-none" />
              <div className="w-5 h-5 rounded-full bg-burgundy border-2 border-white shadow-lg animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* Temporary Pin Form Portal */}
      {mounted && tempPin && tempCoords && createPortal(
        <div
          className="fixed z-50 w-[280px] bg-card border border-border p-3 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
          style={{
            left: tempCoords.left,
            top: tempCoords.top,
            transform: "translate(-50%, -100%)",
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-burgundy uppercase tracking-wider">
              Yeni Geri Bildirim Pini
            </span>
            <button
              onClick={() => setTempPin(null)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Tasarım geri bildiriminizi buraya yazın..."
            rows={3}
            disabled={isPending}
            className="w-full text-xs p-2 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none text-foreground bg-background"
            autoFocus
          />

          <div className="mt-2 flex items-center justify-end gap-1.5">
            <button
              onClick={() => setTempPin(null)}
              disabled={isPending}
              className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleAddAnnotation}
              disabled={isPending || !commentText.trim()}
              className="h-7 px-3 rounded-lg gradient-burgundy text-white text-[11px] font-medium flex items-center gap-1 shadow-md shadow-burgundy/10"
            >
              {isPending ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              <span>Pini Bırak</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

interface PinBubbleProps {
  ann: MediaAnnotation;
  index: number;
  isActive: boolean;
  isHovered: boolean;
  onPinClick: (annId: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onToggleResolve: (ann: MediaAnnotation) => void;
  onDelete: (annId: string) => void;
  isPending: boolean;
  isAdminOrStaff: boolean;
}

function PinBubble({
  ann,
  index,
  isActive,
  isHovered,
  onPinClick,
  onMouseEnter,
  onMouseLeave,
  onToggleResolve,
  onDelete,
  isPending,
  isAdminOrStaff,
}: PinBubbleProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showPopover = isActive || isHovered;

  useEffect(() => {
    if (!showPopover || !mounted) {
      setCoords(null);
      return;
    }

    const updateCoords = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setCoords({
          left: rect.left + rect.width / 2,
          top: rect.top - 8,
        });
      }
    };

    updateCoords();

    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [showPopover, mounted]);

  const authorName = (ann as any).author?.full_name || (ann as any).author?.email || "Kullanıcı";
  const initials = getInitials(authorName);

  return (
    <div
      className="pin-element absolute"
      style={{
        left: `${ann.x_percent}%`,
        top: `${ann.y_percent}%`,
      }}
    >
      {/* Glowing Aura if active */}
      {isActive && (
        <div className="absolute inset-0 -m-3 rounded-full bg-burgundy/25 animate-ping pointer-events-none" />
      )}

      {/* Pin Bubble */}
      <button
        ref={buttonRef}
        onClick={() => onPinClick(ann.id)}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={cn(
          "relative w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border shadow-lg transition-all transform hover:scale-110 active:scale-95",
          ann.is_resolved
            ? "bg-emerald-950/80 text-emerald-400 border-emerald-700/50"
            : isActive
            ? "bg-burgundy text-white border-burgundy-light ring-4 ring-burgundy/30 scale-105"
            : "bg-zinc-900 text-white border-zinc-600 hover:border-burgundy hover:bg-zinc-800"
        )}
      >
        {index}
      </button>

      {/* Annotation Popover Portal */}
      {mounted && showPopover && coords && createPortal(
        <div
          className="fixed z-50 w-[280px] bg-card border border-border/80 rounded-xl p-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150"
          style={{
            left: coords.left,
            top: coords.top,
            transform: "translate(-50%, -100%)",
          }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2.5">
            {/* Author Meta */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-burgundy/10 text-[9px] font-bold text-burgundy flex items-center justify-center overflow-hidden">
                {(ann as any).author?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={(ann as any).author.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-foreground leading-tight">
                  {authorName}
                </span>
                <span className="text-[9px] text-muted-foreground leading-none">
                  {formatDate(ann.created_at)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Resolve toggle */}
              <button
                onClick={() => onToggleResolve(ann)}
                disabled={isPending}
                className={cn(
                  "p-1 rounded-md transition-colors",
                  ann.is_resolved
                    ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                    : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10"
                )}
                title={ann.is_resolved ? "Yeniden Aç" : "Çözüldü Olarak İşaretle"}
              >
                <Check className="w-3.5 h-3.5" />
              </button>

              {/* Delete */}
              {(isAdminOrStaff || (ann.created_by === (ann as any).created_by)) && (
                <button
                  onClick={() => onDelete(ann.id)}
                  disabled={isPending}
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Pini Sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Comment Text */}
          <p className="mt-2 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {ann.comment}
          </p>

          {ann.is_resolved && (
            <div className="mt-2.5 flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/20 border border-emerald-900/35 rounded-lg py-1 px-2.5">
              <CheckSquare className="w-3.5 h-3.5 shrink-0" />
              <span>Çözüldü</span>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
