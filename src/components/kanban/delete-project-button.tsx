"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteProject } from "@/actions/projects";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DeleteProjectButtonProps {
  projectId: string;
}

export function DeleteProjectButton({ projectId }: DeleteProjectButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (
      !confirm(
        "Bu projeyi ve ilişkili tüm görevlerini silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteProject(projectId);
      if (result && 'error' in result && result.error) {
        toast.error("Proje silinirken hata oluştu: " + result.error);
      } else {
        toast.success("Proje başarıyla silindi.");
        router.push("/projects");
        router.refresh();
      }
    } catch (err: any) {
      toast.error("İşlem sırasında beklenmedik bir hata oluştu: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="px-4 h-10 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 text-sm font-semibold transition-all flex items-center gap-2 select-none shrink-0"
      title="Projeyi Sil"
    >
      {isDeleting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
      <span>Projeyi Sil</span>
    </button>
  );
}
