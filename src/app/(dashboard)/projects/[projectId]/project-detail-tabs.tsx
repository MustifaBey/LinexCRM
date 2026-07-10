"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { KanbanBoard } from "@/components/kanban/board";
import { DeleteProjectButton } from "@/components/kanban/delete-project-button";
import { GanttChart } from "@/components/timeline/gantt-chart";
import { updateProjectCanvas, updateProject } from "@/actions/projects";
import { toast } from "sonner";
import {
  ChevronRight,
  Folder,
  LayoutGrid,
  Calendar,
  Grid3X3,
  Loader2,
  ExternalLink,
  Edit2,
  LifeBuoy,
  X,
  FileImage
} from "lucide-react";
import { ProjectForm } from "@/components/kanban/project-form";
import { FileCard } from "@/components/media/file-card";
import dynamic from "next/dynamic";
const UploadDialog = dynamic(() => import("@/components/media/upload-dialog").then((mod) => mod.UploadDialog), {
  ssr: false,
});
import { getMediaFiles } from "@/actions/media";

interface ProjectDetailTabsProps {
  project: any;
  columns: any[];
  teamMembers: any[];
  clients: any[];
  mediaFiles: any[];
}

function extractIframeUrl(pastedText: string): string {
  // Regex to extract src attribute if they pasted full iframe code
  const srcMatch = pastedText.match(/src="([^"]+)"/);
  if (srcMatch && srcMatch[1]) {
    return srcMatch[1];
  }
  return pastedText.trim();
}

interface TabsListProps {
  className?: string;
  children: React.ReactNode;
}

function TabsList({ className, children }: TabsListProps) {
  return (
    <div className={cn("flex border-b border-border/80 pb-px", className)}>
      <div 
        className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-card/30 border border-border/60 p-1.5 rounded-2xl w-full md:w-auto mb-[15px]"
        style={{ marginBottom: '15px' }}
      >
        {children}
      </div>
    </div>
  );
}

export function ProjectDetailTabs({
  project,
  columns,
  teamMembers,
  clients,
  mediaFiles,
}: ProjectDetailTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("kanban");
  const [canvasInput, setCanvasInput] = useState(project.canvas_url || "");
  const [showUrlForm, setShowUrlForm] = useState(!project.canvas_url);
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Pagination states
  const [files, setFiles] = useState<any[]>(mediaFiles);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(mediaFiles.length >= 12);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setFiles(mediaFiles);
    setHasMore(mediaFiles.length >= 12);
    setPage(1);
  }, [mediaFiles]);

  const loadMoreFiles = async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    const nextPage = page + 1;
    const res = await getMediaFiles({
      page: nextPage,
      limit: 12,
      projectId: project.id,
    });

    if (res.data) {
      setFiles((prev) => {
        const existingIds = new Set(prev.map((f) => f.id));
        const newFiles = res.data.filter((f: any) => !existingIds.has(f.id));
        return [...prev, ...newFiles];
      });
      setPage(nextPage);
      if (res.data.length < 12) {
        setHasMore(false);
      }
    } else {
      toast.error("Dosyalar yüklenirken hata oluştu.");
    }
    setIsLoading(false);
  };

  const handleUpdateProject = async (formData: any) => {
    setIsSubmitting(true);
    try {
      const result = await updateProject(project.id, {
        name: formData.name,
        description: formData.description,
        client_id: formData.client_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        status: formData.status,
        progress: formData.progress,
        budget: formData.budget,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Proje başarıyla güncellendi");
        setIsEditDialogOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      toast.error(`Beklenmeyen güncelleme hatası: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    if (tabParam === "timeline" || tabParam === "canvas") {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleSaveCanvasUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedUrl = extractIframeUrl(canvasInput);
    
    if (!parsedUrl) {
      toast.error("Lütfen geçerli bir bağlantı veya iframe kodu girin.");
      return;
    }

    startTransition(async () => {
      const result = await updateProjectCanvas(project.id, parsedUrl);
      if (result.error) {
        toast.error("Hata oluştu: " + result.error);
      } else {
        toast.success("Tasarım tuvali bağlantısı başarıyla güncellendi.");
        setShowUrlForm(false);
        router.refresh();
      }
    });
  };

  const handleRemoveCanvasUrl = () => {
    if (!window.confirm("Tasarım tuvali bağlantısını silmek istediğinize emin misiniz?")) {
      return;
    }

    startTransition(async () => {
      const result = await updateProjectCanvas(project.id, null);
      if (result.error) {
        toast.error("Hata oluştu: " + result.error);
      } else {
        toast.success("Tasarım tuvali bağlantısı kaldırıldı.");
        setCanvasInput("");
        setShowUrlForm(true);
        router.refresh();
      }
    });
  };

  const tabs = [
    { id: "kanban", label: "Kanban Panosu", icon: LayoutGrid },
    { id: "timeline", label: "Zaman Çizelgesi", icon: Calendar },
    { id: "canvas", label: "Tasarım Tuvali", icon: Grid3X3 },
    { id: "media", label: "Proje Medyası", icon: FileImage },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumbs and Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
            <Link href="/projects" className="hover:text-burgundy transition-colors">
              Projeler
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground">{project.name}</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground pt-0.5">
            {project.name}
          </h1>
          {project.description && (
            <p className="text-muted-foreground text-sm line-clamp-1">{project.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto select-none">
          <button
            onClick={() => setIsEditDialogOpen(true)}
            className="h-10 px-4 rounded-xl border border-border bg-card text-foreground text-sm font-semibold hover:bg-muted transition-all flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4 text-burgundy" />
            <span>Projeyi Düzenle</span>
          </button>
          <DeleteProjectButton projectId={project.id} />
        </div>
      </div>

      {/* Tabs list selector */}
      <TabsList className="mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 md:flex-initial flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold shrink-0 transition-all duration-200 select-none",
                isActive
                  ? "bg-muted text-foreground border border-border/85 shadow-lg"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5 md:w-4 md:h-4", isActive ? "text-burgundy" : "text-muted-foreground")} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </TabsList>

      {/* Tab content area */}
      <div className="mt-6">
        {/* 1. Kanban tab */}
        {activeTab === "kanban" && (
          <div className="animate-in fade-in duration-200">
            <KanbanBoard
              initialColumns={columns}
              projectId={project.id}
              teamMembers={teamMembers}
            />
          </div>
        )}

        {/* 2. Timeline tab */}
        {activeTab === "timeline" && (
          <div className="bg-card border border-border/85 rounded-2xl p-6 shadow-xl overflow-hidden animate-in fade-in duration-200">
            <GanttChart
              columns={columns}
              projectStartDate={project.start_date}
              projectEndDate={project.end_date}
            />
          </div>
        )}

        {/* 3. Design Canvas tab */}
        {activeTab === "canvas" && (
          <div className="animate-in fade-in duration-200">
            {showUrlForm ? (
              <div className="max-w-xl mx-auto bg-card border border-border/80 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-burgundy/10 text-burgundy flex items-center justify-center mx-auto mb-1">
                    <Grid3X3 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    Tasarım Tuvali Bağlantısı Ekleyin
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                    Figma, Miro veya FigJam gömme (embed) bağlantısını ekleyerek bu projeye özel bir tasarım panosu oluşturun.
                  </p>
                </div>

                <form onSubmit={handleSaveCanvasUrl} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Figma / Miro Embed Kodu veya Bağlantısı
                    </label>
                    <textarea
                      value={canvasInput}
                      onChange={(e) => setCanvasInput(e.target.value)}
                      placeholder='Örn: <iframe src="https://www.figma.com/embed?embed_host=share&url=..." ...></iframe> veya doğrudan https://www.figma.com/embed...'
                      disabled={isPending}
                      rows={4}
                      className="w-full p-3 rounded-xl bg-input border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    {project.canvas_url && (
                      <button
                        type="button"
                        onClick={() => setShowUrlForm(false)}
                        disabled={isPending}
                        className="h-10 px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        Vazgeç
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isPending || !canvasInput.trim()}
                      className="h-10 px-5 rounded-xl gradient-burgundy text-white text-xs font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-burgundy/15"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Kaydediliyor...</span>
                        </>
                      ) : (
                        <span>Bağlantıyı Kaydet</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-card/30 border border-border/50 px-4 py-2.5 rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                    <Grid3X3 className="w-4 h-4 text-burgundy" />
                    <span>Tasarım Tuvali Aktif</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowUrlForm(true)}
                      className="text-xs font-semibold text-foreground hover:text-burgundy hover:bg-muted/30 px-3 py-1.5 rounded-lg border border-border bg-card/60 transition-all flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3 h-3 text-burgundy" />
                      <span>Bağlantıyı Değiştir</span>
                    </button>
                    <button
                      onClick={handleRemoveCanvasUrl}
                      className="text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/25 px-3 py-1.5 rounded-lg border border-rose-900/30 bg-rose-950/10 transition-all"
                    >
                      Kaldır
                    </button>
                  </div>
                </div>

                <div className="bg-card border border-border/80 rounded-2xl p-2 shadow-2xl relative overflow-hidden">
                  <iframe
                    src={project.canvas_url}
                    className="w-full min-h-[75vh] rounded-xl border border-white/5 shadow-2xl bg-zinc-950"
                    allowFullScreen
                    sandbox="allow-same-origin allow-scripts allow-pointer-lock allow-forms allow-popups allow-presentation"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Project Media tab */}
        {activeTab === "media" && (
          <div className="animate-in fade-in duration-200">
            <div className="bg-card border border-border/85 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-foreground">Proje Dosyaları</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Bu projeye ait tüm görsel ve medya varlıkları.</p>
                </div>
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="h-9 px-4 rounded-xl gradient-burgundy hover:opacity-90 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-burgundy/15 self-start sm:self-auto cursor-pointer"
                >
                  <FileImage className="w-4 h-4" />
                  <span>Dosya Yükle</span>
                </button>
              </div>

              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center select-none">
                  <div className="w-12 h-12 rounded-xl bg-muted/40 text-muted-foreground/80 flex items-center justify-center mb-3">
                    <FileImage className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-foreground">Henüz Dosya Yüklenmemiş</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                    Bu projeye ait herhangi bir medya varlığı bulunmamaktadır. Yukarıdaki butona tıklayarak ilk dosyanızı yükleyebilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {files.map((file: any) => (
                      <FileCard key={file.id} file={file} />
                    ))}
                  </div>

                  {hasMore && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={loadMoreFiles}
                        disabled={isLoading}
                        className="h-10 px-5 rounded-xl border border-border bg-card text-foreground hover:bg-muted text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-burgundy" />
                            <span>Yükleniyor...</span>
                          </>
                        ) : (
                          <span>Daha Fazla Yükle</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <UploadDialog
              open={isUploadOpen}
              onClose={() => setIsUploadOpen(false)}
              onUploadSuccess={() => {
                router.refresh();
              }}
              projects={[project]}
              clients={clients}
              initialUploadType="project"
              initialProjectId={project.id}
              lockType={true}
            />
          </div>
        )}

        {/* Tickets tab removed */}
      </div>

      {/* Edit Project Modal */}
      {isEditDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSubmitting && setIsEditDialogOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Folder className="w-5 h-5 text-burgundy" />
                <span>Projeyi Düzenle</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isSubmitting}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Body Form */}
            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
              <ProjectForm
                initialData={project}
                clients={clients}
                isEdit
                onSubmit={handleUpdateProject}
                onCancel={() => setIsEditDialogOpen(false)}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
