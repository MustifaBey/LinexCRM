"use client";

import { useState, useTransition, useMemo } from "react";
import { FileCard } from "./file-card";
import { createMediaFile } from "@/actions/media";
import { uploadFileToServer, deleteFileFromServer } from "@/actions/storage";
import type { MediaFile, Project } from "@/types/database";
import { toast } from "sonner";
import {
  Search,
  Filter,
  UploadCloud,
  X,
  Loader2,
  Folder,
  FileUp,
} from "lucide-react";
import { EmptyState } from "../shared/empty-state";

interface FileGridProps {
  initialFiles: any[];
  projects: Project[];
}

export function FileGrid({ initialFiles, projects }: FileGridProps) {
  const [files, setFiles] = useState<any[]>(initialFiles);
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [uploadOpen, setUploadOpen] = useState(false);
  
  // Upload States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetProject, setTargetProject] = useState("");
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);

  // Filter and sort files
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Project filter
    if (selectedProject !== "all") {
      result = result.filter((f) => f.project_id === selectedProject);
    }

    // Status filter
    if (selectedStatus !== "all") {
      result = result.filter((f) => f.status === selectedStatus);
    }

    // Search filter
    // Sorting
    result = [...result].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();

      if (sortBy === "newest") {
        return dateB - dateA;
      }
      if (sortBy === "oldest") {
        return dateA - dateB;
      }
      if (sortBy === "largest") {
        return b.file_size - a.file_size;
      }
      if (sortBy === "smallest") {
        return a.file_size - b.file_size;
      }
      return 0;
    });

    return result;
  }, [files, search, selectedProject, selectedStatus, sortBy]);

  const handleUpload = async () => {
    if (!targetProject) {
      toast.error("Lütfen hedef projeyi seçin");
      return;
    }
    if (!selectedUploadFile) {
      toast.error("Lütfen yüklenecek bir dosya seçin");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload file to Supabase Storage
      if (!targetProject || targetProject === "all" || targetProject === "undefined" || targetProject === "null") {
        throw new Error("Lütfen geçerli bir hedef proje seçin.");
      }

      const fileExt = selectedUploadFile.name.split(".").pop();
      const cleanName = selectedUploadFile.name.replace(/[^a-zA-Z0-9]/g, "_");
      let filePath = `${targetProject}/${Date.now()}_${cleanName}.${fileExt}`;
      filePath = filePath.replace(/^\/+/, "").replace(/\/+/g, "/");

      if (filePath.includes("undefined") || filePath.includes("null")) {
        throw new Error("Geçersiz dosya yolu: 'undefined' veya 'null' içeriyor.");
      }
      
      console.log("Upload Path:", filePath);

      const uploadFormData = new FormData();
      uploadFormData.append("file", selectedUploadFile);
      uploadFormData.append("bucket", "media");
      uploadFormData.append("path", filePath);

      const uploadPromise = uploadFileToServer(uploadFormData);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Yükleme zaman aşımına uğradı (10 saniye)")), 10000)
      );

      const { data: uploadData, error: uploadError } = await Promise.race([
        uploadPromise,
        timeoutPromise,
      ]) as any;

      console.log("Upload finished", uploadData, uploadError);

      if (uploadError) {
        throw new Error(uploadError);
      }

      if (!uploadData) {
        throw new Error("Dosya depolama alanına yüklenemedi.");
      }

      // 2. Insert record in DB
      const result = await createMediaFile({
        project_id: targetProject,
        file_name: selectedUploadFile.name,
        file_path: filePath,
        file_type: selectedUploadFile.type || "application/octet-stream",
        file_size: selectedUploadFile.size,
        parent_file_id: null,
      });

      if (result.error) {
        // Cleanup storage upload if db insertion failed
        await deleteFileFromServer("media", filePath);
        throw new Error(result.error);
      }

      toast.success("Dosya başarıyla yüklendi");
      
      // Append new file to files state locally
      const newFileRecord = {
        ...result.data,
        project: { name: projects.find((p) => p.id === targetProject)?.name || "Proje" },
        uploader: {
          full_name: "You",
          email: "",
          avatar_url: null
        }
      };
      setFiles((prev) => [newFileRecord, ...prev]);
      
      // Reset states
      setSelectedUploadFile(null);
      setUploadOpen(false);
    } catch (err: any) {
      console.error("Upload error details:", err);
      toast.error(err.message || "Dosya yüklenirken beklenmeyen bir hata oluştu");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/40 border border-border/60 p-4 rounded-2xl backdrop-blur-md">
        {/* Left Search/Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:w-64 max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Dosya ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>

          {/* Project filter */}
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="h-10 px-3 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            >
              <option value="all">Tüm Projeler</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-10 px-3 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="uploaded">Yüklendi</option>
              <option value="in_review">İncelemede</option>
              <option value="approved">Onaylandı</option>
              <option value="rejected">Reddedildi</option>
            </select>
          </div>
        </div>

        {/* Right Action / Sort */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-10 px-3 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          >
            <option value="newest">En Yeni</option>
            <option value="oldest">En Eski</option>
            <option value="largest">En Büyük Boyut</option>
            <option value="smallest">En Küçük Boyut</option>
          </select>

          <button
            onClick={() => setUploadOpen(true)}
            className="h-10 px-4 rounded-xl gradient-burgundy text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0 shadow-lg shadow-burgundy/10"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Dosya Yükle</span>
          </button>
        </div>
      </div>

      {/* Media Grid */}
      {filteredFiles.length === 0 ? (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredFiles.map((file) => (
            <FileCard key={file.id} file={file} />
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSubmitting && setUploadOpen(false)} />

          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileUp className="w-5 h-5 text-burgundy" />
                <span>Yeni Dosya Yükle</span>
              </h2>
              <button
                onClick={() => setUploadOpen(false)}
                disabled={isSubmitting}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Project Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Hedef Proje
                </label>
                <select
                  value={targetProject}
                  onChange={(e) => setTargetProject(e.target.value)}
                  disabled={isSubmitting}
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

              {/* Drag/Drop Dropzone */}
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
                  onClick={() => !isSubmitting && document.getElementById("file-input")?.click()}
                >
                  <input
                    type="file"
                    id="file-input"
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
                onClick={() => setUploadOpen(false)}
                disabled={isSubmitting}
                className="h-10 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleUpload}
                disabled={isSubmitting || !targetProject || !selectedUploadFile}
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
      )}
    </div>
  );
}
