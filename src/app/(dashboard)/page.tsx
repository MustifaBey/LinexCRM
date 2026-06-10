"use client";

import {
  Kanban,
  ImagePlus,
  Globe,
  Lock,
  TrendingUp,
  Users,
  FolderOpen,
  AlertTriangle,
  ArrowUpRight,
  Activity,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { getRecentActivities } from "@/actions/activity";
import { getDashboardStats } from "@/actions/projects";

/** Quick action cards */
const quickActions = [
  {
    title: "Projeler",
    description: "Kanban panoları & zaman çizelgeleri",
    icon: FolderOpen,
    href: "/projects",
    gradient: "from-primary/20 to-primary/5",
  },
  {
    title: "Medya Kasası",
    description: "Dosyaları yükleyin & inceleyin",
    icon: ImagePlus,
    href: "/media",
    gradient: "from-chart-2/20 to-chart-2/5",
  },
  {
    title: "Alan Adı Takibi",
    description: "Bitiş tarihlerini izleyin",
    icon: AlertTriangle,
    href: "/domains",
    gradient: "from-chart-4/20 to-chart-4/5",
  },
  {
    title: "Şifre Kasası",
    description: "Güvenli kimlik bilgileri",
    icon: Lock,
    href: "/vault",
    gradient: "from-chart-5/20 to-chart-5/5",
  },
  {
    title: "Finans",
    description: "Gelirler & giderler",
    icon: TrendingUp,
    href: "/finance",
    gradient: "from-chart-3/20 to-chart-3/5",
  },
];

export default function DashboardPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [statsData, setStatsData] = useState({
    projectsCount: 0,
    mediaFilesCount: 0,
    domainRecordsCount: 0,
    clientsCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [activitiesData, counts] = await Promise.all([
          getRecentActivities(),
          getDashboardStats().catch(() => ({
            projectsCount: 0,
            mediaFilesCount: 0,
            domainRecordsCount: 0,
            clientsCount: 0,
          }))
        ]);
        setActivities(activitiesData);
        setStatsData(counts);
      } catch (err) {
        console.error("Dashboard verileri yüklenirken hata:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const statsList = useMemo(() => {
    return [
      {
        title: "Aktif Projeler",
        value: statsData.projectsCount.toString(),
        change: `toplam ${statsData.projectsCount} aktif proje`,
        icon: Kanban,
        href: "/projects",
        color: "text-chart-1",
        bgColor: "bg-chart-1/10",
      },
      {
        title: "Medya Dosyaları",
        value: statsData.mediaFilesCount.toString(),
        change: `toplam ${statsData.mediaFilesCount} yüklenen dosya`,
        icon: ImagePlus,
        href: "/media",
        color: "text-chart-2",
        bgColor: "bg-chart-2/10",
      },
      {
        title: "Alan Adı Uyarıları",
        value: statsData.domainRecordsCount.toString(),
        change: `toplam ${statsData.domainRecordsCount} alan adı kaydı`,
        icon: Globe,
        href: "/domains",
        color: "text-chart-4",
        bgColor: "bg-chart-4/10",
      },
      {
        title: "Müşteriler",
        value: statsData.clientsCount.toString(),
        change: `toplam ${statsData.clientsCount} müşteri kaydı`,
        icon: Users,
        href: "/clients",
        color: "text-chart-3",
        bgColor: "bg-chart-3/10",
      },
    ];
  }, [statsData]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Kontrol Paneli</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tekrar hoş geldiniz. İşte ajansınızın genel durumuna dair genel bakış.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsList.map((stat) => (
          <Link
            key={stat.title}
            href={stat.href}
            className="group relative overflow-hidden rounded-2xl bg-card border border-border p-5 hover:border-primary/30 transition-all duration-300"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.title}</p>
                <p className="text-3xl font-bold mt-1 tracking-tight text-foreground">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {stat.change}
                </p>
              </div>
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  stat.bgColor
                )}
              >
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
            </div>

            {/* Hover arrow */}
            <ArrowUpRight className="absolute top-4 right-4 w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Bottom gradient accent */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
            <Activity className="w-5 h-5 text-burgundy" />
            Hızlı İşlemler
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="group relative overflow-hidden rounded-xl bg-card border border-border p-4 hover:border-primary/30 transition-all duration-300"
              >
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                    action.gradient
                  )}
                />
                <div className="relative">
                  <action.icon className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors mb-3" />
                  <h3 className="font-semibold text-sm text-foreground">{action.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {action.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-burgundy" />
            Son Aktiviteler
          </h2>
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="divide-y divide-border">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-burgundy animate-spin" />
                </div>
              ) : activities.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground/60">
                  Henüz son aktivite kaydı bulunmuyor.
                </div>
              ) : (
                activities.map((item) => (
                  <div
                    key={item.id}
                    className="px-4 py-3.5 hover:bg-muted/30 transition-colors"
                  >
                    <p className="text-xs font-medium text-foreground leading-tight">
                      {item.action}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] bg-burgundy/10 text-burgundy px-1.5 py-0.5 rounded font-medium tracking-wide">
                        {item.project}
                      </span>
                      <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(item.time)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
