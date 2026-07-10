import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cn, getInitials } from "@/lib/utils";
import {
  Users,
  Activity,
  Briefcase,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  UserCheck,
  CheckCircle,
  HelpCircle
} from "lucide-react";

export const metadata = {
  title: "Ekip ve Kaynak Yönetimi - LinexCRM",
};

export default async function TeamPage() {
  const supabase = await createClient();

  // 1. Fetch user auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch profiles, excluding clients
  const { data: profiles, error: profileError } = await (supabase
    .from("profiles") as any)
    .select("*")
    .neq("role", "client")
    .order("full_name");

  if (profileError) {
    return (
      <div className="p-6 text-center text-rose-500">
        Profil verileri çekilirken hata oluştu: {profileError.message}
      </div>
    );
  }

  // 3. Fetch tasks with nested projects and columns
  const { data: tasks, error: taskError } = await (supabase
    .from("tasks") as any)
    .select(`
      *,
      project:projects(id, name),
      column:kanban_columns(id, title)
    `);

  if (taskError) {
    return (
      <div className="p-6 text-center text-rose-500">
        Görev verileri çekilirken hata oluştu: {taskError.message}
      </div>
    );
  }

  const allTasks = (tasks || []) as any[];
  const teamProfiles = (profiles || []) as any[];

  // 4. Aggregate workloads per team member
  const teamWorkloads = teamProfiles.map((profile) => {
    const assignedTasks = allTasks.filter((t) => t.assigned_to === profile.id);
    
    // Active tasks: exclude columns that match "done" or "tamamlandı"
    const activeTasks = assignedTasks.filter((t) => {
      const colTitle = (t.column as any)?.title?.toLowerCase() || "";
      return !colTitle.includes("done") && !colTitle.includes("tamamlandı");
    });

    const activeCount = activeTasks.length;
    const completedCount = assignedTasks.length - activeCount;

    // Group active tasks by priority
    const priorityCounts = {
      urgent: activeTasks.filter((t) => t.priority === "urgent").length,
      high: activeTasks.filter((t) => t.priority === "high").length,
      medium: activeTasks.filter((t) => t.priority === "medium").length,
      low: activeTasks.filter((t) => t.priority === "low").length,
    };

    // Group active tasks by standard categories
    const statusCounts = {
      todo: activeTasks.filter((t) => {
        const colTitle = (t.column as any)?.title?.toLowerCase() || "";
        return colTitle.includes("yapılacak") || colTitle.includes("todo") || colTitle.includes("to do");
      }).length,
      inProgress: activeTasks.filter((t) => {
        const colTitle = (t.column as any)?.title?.toLowerCase() || "";
        return colTitle.includes("devam") || colTitle.includes("progress") || colTitle.includes("in progress");
      }).length,
      inReview: activeTasks.filter((t) => {
        const colTitle = (t.column as any)?.title?.toLowerCase() || "";
        return colTitle.includes("inceleme") || colTitle.includes("review") || colTitle.includes("test");
      }).length,
    };

    const otherStatusCount = activeCount - (statusCounts.todo + statusCounts.inProgress + statusCounts.inReview);

    // Extract unique involved projects
    const projectsMap = new Map();
    assignedTasks.forEach((t) => {
      if (t.project) {
        projectsMap.set(t.project.id, t.project.name);
      }
    });
    const involvedProjects = Array.from(projectsMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));

    // Capacity limit rules (optimal default limit is 8 active tasks)
    const capacityLimit = 8;
    const loadPercent = Math.min(100, Math.round((activeCount / capacityLimit) * 100));

    let capacityStatus = "Optimal";
    let capacityBadgeClass = "bg-sky-950/40 text-sky-400 border-sky-800/50";
    let progressBarClass = "bg-sky-500";

    if (activeCount === 0) {
      capacityStatus = "Müsait";
      capacityBadgeClass = "bg-emerald-950/40 text-emerald-400 border-emerald-800/50";
      progressBarClass = "bg-emerald-500";
    } else if (activeCount <= 3) {
      capacityStatus = "Düşük Efor";
      capacityBadgeClass = "bg-teal-950/40 text-teal-400 border-teal-800/50";
      progressBarClass = "bg-teal-500";
    } else if (activeCount <= 6) {
      capacityStatus = "Optimal";
      capacityBadgeClass = "bg-sky-950/40 text-sky-400 border-sky-800/50";
      progressBarClass = "bg-sky-500";
    } else if (activeCount <= 8) {
      capacityStatus = "Yüksek Efor";
      capacityBadgeClass = "bg-amber-950/40 text-amber-400 border-amber-800/50";
      progressBarClass = "bg-amber-500";
    } else {
      capacityStatus = "Aşırı Yüklü";
      capacityBadgeClass = "bg-rose-950/40 text-rose-400 border-rose-800/50 animate-pulse";
      progressBarClass = "bg-rose-600 animate-pulse";
    }

    return {
      profile,
      activeCount,
      completedCount,
      totalCount: assignedTasks.length,
      priorityCounts,
      statusCounts,
      otherStatusCount,
      involvedProjects,
      loadPercent,
      capacityStatus,
      capacityBadgeClass,
      progressBarClass,
    };
  });

  // 5. Filter unassigned tasks
  const unassignedTasks = allTasks.filter((t) => !t.assigned_to);

  // Overall calculations
  const totalStaff = teamProfiles.length;
  const totalActiveTasksCount = teamWorkloads.reduce((sum, w) => sum + w.activeCount, 0);
  const totalUrgentTasksCount = allTasks.filter(
    (t) => {
      const colTitle = (t.column as any)?.title?.toLowerCase() || "";
      const isActive = !colTitle.includes("done") && !colTitle.includes("tamamlandı");
      return isActive && t.priority === "urgent";
    }
  ).length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ekip ve Kaynak Yönetimi</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ekip üyelerinin iş yüklerini, kapasitelerini ve aktif görevlerini izleyin.
          </p>
        </div>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-card border border-border/60 rounded-xl md:rounded-2xl p-3 md:p-5 shadow-xl flex items-center gap-2.5 md:gap-4">
          <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-burgundy/10 text-burgundy flex items-center justify-center shrink-0">
            <Users className="w-4.5 h-4.5 md:w-6 md:h-6" />
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ekip Boyutu</p>
            <h3 className="text-sm md:text-2xl font-bold mt-0.5">{totalStaff} Personel</h3>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl md:rounded-2xl p-3 md:p-5 shadow-xl flex items-center gap-2.5 md:gap-4">
          <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
            <Activity className="w-4.5 h-4.5 md:w-6 md:h-6" />
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aktif Görevler</p>
            <h3 className="text-sm md:text-2xl font-bold mt-0.5">{totalActiveTasksCount} Görev</h3>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl md:rounded-2xl p-3 md:p-5 shadow-xl flex items-center gap-2.5 md:gap-4">
          <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5 md:w-6 md:h-6" />
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acil Görevler</p>
            <h3 className="text-sm md:text-2xl font-bold mt-0.5">{totalUrgentTasksCount} Kritik</h3>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl md:rounded-2xl p-3 md:p-5 shadow-xl flex items-center gap-2.5 md:gap-4">
          <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <Briefcase className="w-4.5 h-4.5 md:w-6 md:h-6" />
          </div>
          <div>
            <p className="text-[9px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Atanmamış İşler</p>
            <h3 className="text-sm md:text-2xl font-bold mt-0.5">{unassignedTasks.length} Boşta</h3>
          </div>
        </div>
      </div>

      {/* Grid of capacity cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-burgundy" />
          Ekip Kapasite Durumları
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {teamWorkloads.map((workload) => {
            const { profile } = workload;
            const initials = getInitials(profile.full_name || profile.email);

            return (
              <div
                key={profile.id}
                className="bg-card border border-border/80 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl flex flex-col justify-between hover:border-burgundy/30 hover:shadow-2xl transition-all duration-300 relative group"
              >
                {/* Header profile row */}
                <div>
                  <div className="flex items-start justify-between gap-3 md:gap-4">
                    <div className="flex items-center gap-2.5 md:gap-3">
                      <div className="w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl border border-border/40 overflow-hidden shrink-0 bg-muted flex items-center justify-center relative">
                        {profile.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profile.avatar_url}
                            alt={profile.full_name || "Profil resmi"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs md:text-sm font-bold text-muted-foreground">{initials}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-xs md:text-sm text-foreground truncate max-w-[130px] md:max-w-[150px]">
                          {profile.full_name || "İsimsiz Personel"}
                        </h3>
                        <p className="text-[10px] md:text-xs text-muted-foreground truncate max-w-[130px] md:max-w-[150px]">
                          {profile.email}
                        </p>
                      </div>
                    </div>

                    <span className={cn("px-2 py-0.5 rounded-full border text-[9px] md:text-[10px] font-bold select-none uppercase tracking-wider", workload.capacityBadgeClass)}>
                      {workload.capacityStatus}
                    </span>
                  </div>

                  {/* Workload Capacity progress bar */}
                  <div className="mt-4 md:mt-6 space-y-1">
                    <div className="flex items-center justify-between text-[10px] md:text-xs font-semibold">
                      <span className="text-muted-foreground">İş Yükü Eforu</span>
                      <span className="text-foreground">{workload.activeCount} / 8 Aktif Görev</span>
                    </div>
                    <div className="h-1.5 md:h-2 w-full bg-input rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all duration-300 rounded-full", workload.progressBarClass)}
                        style={{ width: `${workload.loadPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Priority and status counters summary */}
                  <div className="mt-3.5 md:mt-5 grid grid-cols-2 gap-2 text-[10px] md:text-xs border-t border-border/40 pt-3 md:pt-4">
                    {/* Priority counters */}
                    <div className="space-y-1.5 border-r border-border/40 pr-2">
                      <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Kritiklik</p>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Acil</span>
                          <span className={cn("px-1.5 py-0.5 rounded font-mono font-bold text-[9px] md:text-[10px]", workload.priorityCounts.urgent > 0 ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse" : "bg-muted/40 text-muted-foreground")}>
                            {workload.priorityCounts.urgent}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Yüksek</span>
                          <span className={cn("px-1.5 py-0.5 rounded font-mono font-bold text-[9px] md:text-[10px]", workload.priorityCounts.high > 0 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-muted/40 text-muted-foreground")}>
                            {workload.priorityCounts.high}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status counters */}
                    <div className="space-y-1.5 pl-2">
                      <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Aşamalar</p>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Yapılacak</span>
                          <span className="font-semibold text-foreground/80 font-mono">{workload.statusCounts.todo}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Devam Eden</span>
                          <span className="font-semibold text-foreground/80 font-mono">{workload.statusCounts.inProgress}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">İncelemede</span>
                          <span className="font-semibold text-foreground/80 font-mono">{workload.statusCounts.inReview}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Projects involved in */}
                <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-border/40">
                  <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Dahil Olduğu Projeler</p>
                  {workload.involvedProjects.length === 0 ? (
                    <p className="text-[10px] md:text-xs text-muted-foreground/60 italic">Aktif proje kaydı bulunmuyor.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1 md:gap-1.5">
                      {workload.involvedProjects.map((proj) => (
                        <Link
                          key={proj.id}
                          href={`/projects/${proj.id}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg bg-muted border border-border text-[10px] md:text-xs text-foreground/80 hover:text-burgundy hover:border-burgundy/30 transition-colors"
                        >
                          <Briefcase className="w-2.5 h-2.5 md:w-3 md:h-3 text-burgundy" />
                          <span className="truncate max-w-[100px] md:max-w-[120px]">{proj.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unassigned Tasks Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-burgundy" />
          Dağıtılmamış / Atanmamış Görevler
        </h2>

        {unassignedTasks.length === 0 ? (
          <div className="bg-card border border-border/80 rounded-2xl p-8 text-center text-sm text-muted-foreground/60 shadow-xl">
            Boşta bekleyen atanmamış görev bulunmamaktadır. Tüm işler planlandı!
          </div>
        ) : (
          <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                    <th className="px-6 py-4">Proje</th>
                    <th className="px-6 py-4">Görev Başlığı</th>
                    <th className="px-6 py-4">Öncelik</th>
                    <th className="px-6 py-4">Efor (Saat)</th>
                    <th className="px-6 py-4">Bitiş Tarihi</th>
                    <th className="px-6 py-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-sm">
                  {unassignedTasks.map((task) => {
                    const isUrgent = task.priority === "urgent";
                    const isHigh = task.priority === "high";

                    let priorityLabel = "Düşük";
                    let priorityBadgeClass = "bg-zinc-800 text-zinc-300 border-zinc-700";

                    if (task.priority === "urgent") {
                      priorityLabel = "Acil";
                      priorityBadgeClass = "bg-rose-950/40 text-rose-400 border-rose-800/50";
                    } else if (task.priority === "high") {
                      priorityLabel = "Yüksek";
                      priorityBadgeClass = "bg-amber-950/40 text-amber-400 border-amber-800/50";
                    } else if (task.priority === "medium") {
                      priorityLabel = "Orta";
                      priorityBadgeClass = "bg-sky-950/40 text-sky-400 border-sky-800/50";
                    }

                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-muted/15 transition-colors group"
                      >
                        {/* Project */}
                        <td className="px-6 py-4">
                          <span className="font-semibold text-foreground/80">
                            {task.project?.name || "Bilinmeyen Proje"}
                          </span>
                        </td>

                        {/* Task Title */}
                        <td className="px-6 py-4">
                          <span className="font-medium text-foreground truncate max-w-[250px] block">
                            {task.title}
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="px-6 py-4">
                          <span className={cn("px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider select-none", priorityBadgeClass, isUrgent && "animate-pulse")}>
                            {priorityLabel}
                          </span>
                        </td>

                        {/* Estimated Hours */}
                        <td className="px-6 py-4 font-mono text-foreground/80">
                          {task.estimated_hours ? `${task.estimated_hours} saat` : "—"}
                        </td>

                        {/* Due Date */}
                        <td className="px-6 py-4 text-muted-foreground font-medium text-xs">
                          {task.due_date ? new Date(task.due_date).toLocaleDateString("tr-TR") : "—"}
                        </td>

                        {/* Action Link */}
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/projects/${task.project_id}`}
                            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground/80 hover:text-burgundy hover:border-burgundy/30 transition-all shadow-sm"
                          >
                            <span>Atama Yap</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
