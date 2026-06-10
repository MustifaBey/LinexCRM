"use client";

import { useState } from "react";
import type { Project, Client } from "@/types/database";
import { ProjectDialog } from "./project-dialog";
import { EmptyState } from "../shared/empty-state";
import {
  Plus,
  Building,
  Calendar,
  Layers,
  BarChart2,
  FolderOpen,
  ImageIcon,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { PROJECT_STATUSES } from "@/lib/constants";

interface ProjectListProps {
  initialProjects: any[];
  clients: Client[];
}

export function ProjectList({ initialProjects, clients }: ProjectListProps) {
  const [projects, setProjects] = useState<any[]>(initialProjects);
  const [dialogOpen, setDialogOpen] = useState(false);

  const getStatusDetails = (status: string) => {
    return PROJECT_STATUSES.find((s) => s.value === status) || {
      label: status,
      color: "#6b7280"
    };
  };

  const hasProjects = projects.length > 0;

  return (
    <div className="space-y-6">
      {/* Top Header Action */}
      {hasProjects && (
        <div className="flex justify-between items-center bg-card/40 border border-border/60 p-4 rounded-2xl backdrop-blur-md">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1 select-none">
            Aktif Projeler ({projects.length})
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="h-10 px-4 rounded-xl gradient-burgundy text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0 shadow-lg shadow-burgundy/10"
          >
            <Plus className="w-4 h-4" />
            <span>Proje Oluştur</span>
          </button>
        </div>
      )}

      {/* Grid or Empty State */}
      {!hasProjects ? (
        <EmptyState
          icon={<FolderOpen className="w-7 h-7 text-muted-foreground" />}
          title="Henüz Proje Yok"
          description="Bir Kanban panosunda görevleri organize etmeye başlamak için ilk projenizi oluşturun."
          action={
            <button
              onClick={() => setDialogOpen(true)}
              className="px-4 py-2 rounded-xl gradient-burgundy text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Proje Oluştur</span>
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const status = getStatusDetails(project.status);
            const clientName = project.client?.name || "Atanmamış Müşteri";

            return (
              <div
                key={project.id}
                className="bg-card border border-border/80 hover:border-burgundy/40 rounded-2xl flex flex-col justify-between hover:shadow-xl hover:shadow-burgundy/5 transition-all duration-300 group relative overflow-hidden"
              >
                {/* Cover Image or Burgundy Gradient Fallback */}
                <div className="relative h-28 w-full shrink-0">
                  {project.image_url ? (
                    <img
                      src={project.image_url}
                      alt={`${project.name} kapak`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-burgundy/30 via-burgundy/15 to-card flex items-center justify-center">
                      <FolderOpen className="w-10 h-10 text-burgundy/30" />
                    </div>
                  )}
                  {/* Gradient fade into card body */}
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
                </div>

                <div className="p-5 pt-0 flex flex-col justify-between flex-1">
                {/* Status and Client info */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border"
                      style={{
                        borderColor: `${status.color}30`,
                        color: status.color,
                        backgroundColor: `${status.color}08`
                      }}
                    >
                      {status.label}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Building className="w-3.5 h-3.5 text-burgundy shrink-0" />
                      <span className="truncate max-w-[130px]">{clientName}</span>
                    </div>
                  </div>

                  {/* Title and Description */}
                  <div className="pt-1">
                    <h3 className="text-base font-bold text-foreground group-hover:text-burgundy transition-colors line-clamp-1">
                      <Link href={`/projects/${project.id}`}>
                        {project.name}
                      </Link>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2.5 line-clamp-4 h-16 leading-relaxed">
                      {project.description || "Açıklama belirtilmemiş."}
                    </p>
                  </div>
                </div>

                {/* Progress bar and dates */}
                <div className="mt-5 space-y-4">
                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">İlerleme</span>
                      <span className="text-foreground">{project.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-input rounded-full overflow-hidden">
                      <div
                        className="h-full bg-burgundy transition-all duration-300 rounded-full"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Date details and Navigation Links */}
                  <div className="pt-3.5 border-t border-border/40 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium truncate">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {project.start_date
                          ? formatDate(project.start_date)
                          : "Başlangıç tarihi yok"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 text-xs"
                        title="Pano görünümü"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Pano</span>
                      </Link>
                      <Link
                        href={`/projects/${project.id}?tab=timeline`}
                        className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 text-xs"
                        title="Zaman çizelgesi görünümü"
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Çizelge</span>
                      </Link>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project Creation Dialog */}
      <ProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        clients={clients}
        onSaveSuccess={(newProj) => {
          setProjects((prev) => [newProj, ...prev]);
        }}
      />
    </div>
  );
}
