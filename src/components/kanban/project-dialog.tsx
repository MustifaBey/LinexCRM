"use client";

import { useState, useEffect } from "react";
import { createProject } from "@/actions/projects";
import type { Client } from "@/types/database";
import { toast } from "sonner";
import { X, FolderOpen, Loader2, ImageIcon, Plus, UploadCloud } from "lucide-react";
import { uploadFileToServer } from "@/actions/storage";
import { ClientDialog } from "./client-dialog";
import { cn } from "@/lib/utils";

interface ProjectDialogProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  onSaveSuccess: (savedRecord: any) => void;
}

import { ProjectForm } from "./project-form";

export function ProjectDialog({
  open,
  onClose,
  clients: initialClients,
  onSaveSuccess,
}: ProjectDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (formData: any) => {
    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append("name", formData.name);
      data.append("description", formData.description);
      data.append("clientId", formData.client_id || "");
      data.append("startDate", formData.start_date || "");
      data.append("endDate", formData.end_date || "");
      data.append("imageUrl", formData.image_url || "");

      const result = await createProject(data);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Proje başarıyla oluşturuldu");
        onSaveSuccess(result.data);
        onClose();
      }
    } catch (err: any) {
      toast.error(`Beklenmeyen kayıt hatası: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSubmitting && onClose()} />

      <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-burgundy" />
            <span>Yeni Proje Oluştur</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          <ProjectForm
            clients={initialClients}
            onSubmit={handleSave}
            onCancel={onClose}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}
