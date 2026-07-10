"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FileCard } from "./file-card";
import { UploadDialog } from "./upload-dialog";
import type { MediaFile, Project } from "@/types/database";
import { toast } from "sonner";
import { getMediaFiles } from "@/actions/media";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Filter,
  UploadCloud,
  X,
  Loader2,
  Folder,
  FileUp,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { EmptyState } from "../shared/empty-state";
import { cn } from "@/lib/utils";

interface FileGridProps {
  initialFiles: any[];
  initialCount?: number;
  projects: Project[];
  clients?: any[];
}

export function FileGrid({ initialFiles, initialCount = 0, projects, clients = [] }: FileGridProps) {
  const searchParams = useSearchParams();
  const initialClient = searchParams?.get("client") || "all";
  const initialProject = searchParams?.get("project") || "all";

  const [files, setFiles] = useState<any[]>(initialFiles);
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState(initialProject);
  const [selectedClient, setSelectedClient] = useState(initialClient);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(initialCount || 0);
  const [isLoading, setIsLoading] = useState(false);
  const isInitialMount = useRef(true);
  const [limit, setLimit] = useState(12);

  // Client-side viewport detection for responsive pagination limit
  useEffect(() => {
    const updateLimit = () => {
      setLimit(window.innerWidth < 768 ? 6 : 12);
    };
    updateLimit();
    window.addEventListener("resize", updateLimit);
    return () => window.removeEventListener("resize", updateLimit);
  }, []);

  const totalPages = Math.ceil(totalCount / limit) || 1;

  const handlePageChange = async (targetPage: number) => {
    if (targetPage < 1 || targetPage > totalPages || targetPage === page || isLoading) return;

    setIsLoading(true);
    const res = await getMediaFiles({
      page: targetPage,
      limit: limit,
      projectId: selectedProject,
      clientId: selectedClient,
      status: selectedStatus,
      search: search,
      sortBy: sortBy,
    });

    if (res.data) {
      setFiles(res.data);
      setPage(targetPage);
      if (typeof res.count === "number") {
        setTotalCount(res.count);
      }
    } else {
      toast.error("Medya dosyaları yüklenirken hata oluştu.");
    }
    setIsLoading(false);
  };

  // Reset and load on filter changes with debounce
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (selectedClient === "all" && selectedProject === "all") {
        return;
      }
    }

    let active = true;

    async function resetAndFetch() {
      setIsLoading(true);
      setPage(1);

      const res = await getMediaFiles({
        page: 1,
        limit: limit,
        projectId: selectedProject,
        clientId: selectedClient,
        status: selectedStatus,
        search: search,
        sortBy: sortBy,
      });

      if (active) {
        if (res.data) {
          setFiles(res.data);
          if (typeof res.count === "number") {
            setTotalCount(res.count);
          }
        } else {
          toast.error("Medya dosyaları yüklenirken hata oluştu.");
        }
        setIsLoading(false);
      }
    }

    const delayDebounceFn = setTimeout(() => {
      resetAndFetch();
    }, search ? 400 : 0);

    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [selectedProject, selectedClient, selectedStatus, search, sortBy, limit]);

  const handleUploadSuccess = (newFile: any) => {
    const newFileRecord = {
      ...newFile,
      project: { name: projects.find((p) => p.id === newFile.project_id)?.name || "Proje" },
      uploader: {
        full_name: "You",
        email: "",
        avatar_url: null
      }
    };
    setFiles((prev) => [newFileRecord, ...prev]);
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col gap-4 bg-card/40 border border-border/60 p-4 rounded-2xl backdrop-blur-md">
        {/* Top Search bar, toggle filters button, and Upload button */}
        <div className="flex items-center gap-2.5 w-full justify-between">
          {/* Search container */}
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Dosya ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>

          {/* Toggle filter button (mobile only) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "md:hidden flex items-center justify-center w-10 h-10 rounded-xl border transition-colors shrink-0",
              showFilters
                ? "bg-burgundy/10 border-burgundy/50 text-burgundy"
                : "bg-input/70 border-border text-muted-foreground hover:text-foreground"
            )}
            title="Filtreleri Göster/Gizle"
          >
            <Filter className="w-4 h-4" />
          </button>

          {/* Upload Button */}
          <button
            onClick={() => setUploadOpen(true)}
            className="h-10 px-4 rounded-xl gradient-burgundy text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0 shadow-lg shadow-burgundy/10 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span className="hidden sm:inline">Dosya Yükle</span>
          </button>
        </div>

        {/* Expandable filters dropdown block */}
        <div className={cn(
          "flex-wrap items-center gap-3 w-full border-t border-border/40 pt-4 md:pt-0 md:border-0",
          showFilters ? "flex" : "hidden md:flex"
        )}>
          {/* Project filter */}
          <div className="flex items-center gap-2 flex-1 min-w-[140px] md:flex-initial">
            <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            >
              <option value="all">Tüm Projeler</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Client filter */}
          <div className="flex items-center gap-2 flex-1 min-w-[140px] md:flex-initial">
            <Users className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            >
              <option value="all">Tüm Müşteriler</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2 flex-1 min-w-[140px] md:flex-initial">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="uploaded">Yüklendi</option>
              <option value="in_review">İncelemede</option>
              <option value="approved">Onaylandı</option>
              <option value="rejected">Reddedildi</option>
            </select>
          </div>

          {/* Sort Selection (now inside filter block) */}
          <div className="flex items-center gap-2 flex-1 min-w-[140px] md:flex-initial md:ml-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            >
              <option value="newest">En Yeni</option>
              <option value="oldest">En Eski</option>
              <option value="largest">En Büyük Boyut</option>
              <option value="smallest">En Küçük Boyut</option>
            </select>
          </div>
        </div>
      </div>

      {/* Media Grid */}
      {isLoading && files.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-burgundy" />
          <span className="text-sm text-muted-foreground">Medya dosyaları yükleniyor...</span>
        </div>
      ) : files.length === 0 ? (
        <EmptyState
          title="Dosya bulunamadı"
          description="Filtrelerinizi temizlemeyi deneyin veya yeni bir tasarım dosyası yükleyin."
          action={
            <button
              onClick={() => setUploadOpen(true)}
              className="px-4 py-2 rounded-xl gradient-burgundy text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Dosya Yükle</span>
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
            {files.map((file, index) => (
              <FileCard
                key={file.id || index}
                file={file}
                onDelete={(id) => {
                  setFiles((prev) => prev.filter((f) => f.id !== id));
                }}
              />
            ))}
          </div>

          {/* Numbered Pagination UI */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-6">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1 || isLoading}
                className="w-9 h-9 rounded-xl border border-border bg-card text-muted-foreground flex items-center justify-center hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-muted-foreground transition-all cursor-pointer"
                title="Önceki"
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
                title="Sonraki"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        projects={projects}
        clients={clients}
      />
    </div>
  );
}
