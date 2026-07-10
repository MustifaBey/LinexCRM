"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { deleteClientAction, getClientsList } from "@/actions/clients";
import { toast } from "sonner";
import Link from "next/link";
import {
  Search,
  Plus,
  Trash2,
  Building,
  Mail,
  Phone,
  Briefcase,
  Users,
  Loader2,
  MoreVertical,
  Edit2,
  Eye,
  Radar,
} from "lucide-react";
import dynamic from "next/dynamic";
const ClientDialog = dynamic(() => import("@/components/kanban/client-dialog").then((mod) => mod.ClientDialog), {
  ssr: false,
});
import { ClientActions } from "./client-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

interface ClientsTableProps {
  initialClients: any[];
}

export function ClientsTable({ initialClients }: ClientsTableProps) {
  const [clients, setClients] = useState<any[]>(initialClients);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [openMenuClientId, setOpenMenuClientId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialClients.length >= 10);
  const [isLoading, setIsLoading] = useState(false);
  const isInitialMount = useRef(true);
  const observerRef = useRef<HTMLTableRowElement | null>(null);

  const handleSaveSuccess = (savedClient: any) => {
    const decoratedClient = {
      ...savedClient,
      projects: savedClient.projects || [],
    };
    setClients((prev) => {
      const exists = prev.some((c) => c.id === savedClient.id);
      if (exists) {
        return prev.map((c) => (c.id === savedClient.id ? decoratedClient : c));
      } else {
        return [decoratedClient, ...prev];
      }
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" adlı müşteriyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve ilişkili projeleri etkileyebilir.`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteClientAction(id);
      if (result.error) {
        toast.error("Müşteri silinirken hata oluştu: " + result.error);
      } else {
        toast.success("Müşteri başarıyla silindi");
        setClients((prev) => prev.filter((c) => c.id !== id));
      }
    });
  };

  // Load more function
  const loadMoreClients = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    const nextPage = page + 1;
    const res = await getClientsList({
      page: nextPage,
      limit: 10,
      search: search,
    });

    if (res.data) {
      setClients((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const newClients = res.data.filter((c: any) => !existingIds.has(c.id));
        return [...prev, ...newClients];
      });
      setPage(nextPage);
      if (res.data.length < 10) {
        setHasMore(false);
      }
    } else {
      toast.error("Müşteriler yüklenirken hata oluştu.");
    }
    setIsLoading(false);
  }, [page, isLoading, hasMore, search]);

  // Observer effect
  useEffect(() => {
    if (!hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreClients();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoading, loadMoreClients]);

  // Debounced search reset effect
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    let active = true;

    async function resetAndFetch() {
      setIsLoading(true);
      setPage(1);
      setHasMore(true);

      const res = await getClientsList({
        page: 1,
        limit: 10,
        search: search,
      });

      if (active) {
        if (res.data) {
          setClients(res.data);
          setHasMore(res.data.length >= 10);
        } else {
          toast.error("Müşteriler yüklenirken hata oluştu.");
        }
        setIsLoading(false);
      }
    }

    const debounceTimer = setTimeout(() => {
      resetAndFetch();
    }, search ? 400 : 0);

    return () => {
      active = false;
      clearTimeout(debounceTimer);
    };
  }, [search]);

  const filteredClients = clients;

  return (
    <div className="space-y-6">
      {/* Top Filter and Add Bar */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-center justify-between bg-card/40 border border-border/60 p-3 md:p-4 rounded-xl md:rounded-2xl backdrop-blur-md">
        {/* Left Side: Search */}
        <div className="relative w-full md:w-85">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Müşteri adı, firma veya e-posta ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>

        {/* Right Side Actions: Radar & Add buttons side-by-side on mobile */}
        <div className="grid grid-cols-2 md:flex items-center gap-2.5 w-full md:w-auto">
          <a
            href="https://linexmapradarv2.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-xs md:text-sm font-semibold border border-input bg-transparent hover:border-burgundy hover:text-burgundy hover:bg-burgundy/5 h-10 px-4 gap-2 cursor-pointer w-full text-center"
          >
            <Radar className="w-4 h-4 text-burgundy shrink-0" />
            <span>Müşteri Radarı</span>
          </a>

          <button
            onClick={() => {
              setEditingClient(null);
              setDialogOpen(true);
            }}
            className="h-10 px-4 rounded-xl gradient-burgundy text-white text-xs md:text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0 shadow-lg shadow-burgundy/10 justify-center w-full"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="truncate">Yeni Müşteri</span>
          </button>
        </div>
      </div>

      {/* Table grid */}
      {filteredClients.length === 0 ? (
        <EmptyState
          title="Müşteri bulunamadı"
          description={
            search.trim()
              ? "Arama kriterlerinize uyan müşteri bulunmamaktadır."
              : "Henüz hiç müşteri kaydı bulunmamaktadır. İlk müşteri kaydını ekleyerek başlayın."
          }
          icon={<Users className="w-7 h-7 text-muted-foreground" />}
          action={
            !search.trim() && (
              <button
                onClick={() => {
                  setEditingClient(null);
                  setDialogOpen(true);
                }}
                className="px-4 py-2 rounded-xl gradient-burgundy text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>İlk Müşteriyi Ekle</span>
              </button>
            )
          }
        />
      ) : (
        <div className="bg-card border border-border/80 rounded-xl md:rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                  <th className="px-3 py-2.5 md:px-6 md:py-4">Müşteri Adı</th>
                  <th className="px-3 py-2.5 md:px-6 md:py-4">Firma</th>
                  <th className="px-3 py-2.5 md:px-6 md:py-4">İletişim Bilgileri</th>
                  <th className="px-3 py-2.5 md:px-6 md:py-4">Aktif Projeler</th>
                  <th className="px-3 py-2.5 md:px-6 md:py-4">Durum</th>
                  <th className="px-3 py-2.5 md:px-6 md:py-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs md:text-sm">
                {filteredClients.map((client) => {
                  const projectList = client.projects || [];
                  const activeProjects = projectList.filter(
                    (p: any) => p.status === "active" || p.status === "planning"
                  );
                  const activeCount = activeProjects.length;
                  const totalCount = projectList.length;

                  // Get status mapped from CRM pipeline status
                  const pipelineMapping: Record<string, { label: string, badge: string }> = {
                    lead: { label: "Potansiyel", badge: "bg-blue-950/40 text-blue-400 border-blue-800/50" },
                    contacted: { label: "Görüşüldü", badge: "bg-zinc-800 text-zinc-300 border-zinc-700" },
                    proposal: { label: "Teklif İletildi", badge: "bg-amber-950/40 text-amber-400 border-amber-800/50" },
                    won: { label: "Kazanıldı", badge: "bg-emerald-950/40 text-emerald-400 border-emerald-800/50" },
                    lost: { label: "Kaybedildi", badge: "bg-rose-950/40 text-rose-400 border-rose-800/50" },
                  };
                  const statusInfo = pipelineMapping[client.pipeline_status as string] || { label: "Potansiyel", badge: "bg-blue-950/40 text-blue-400 border-blue-800/50" };
                  const statusText = statusInfo.label;
                  const statusBadgeClass = statusInfo.badge;

                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-muted/15 transition-colors group"
                    >
                      {/* Name */}
                      <td className="px-3 py-2.5 md:px-6 md:py-4.5">
                        <Link
                          href={`/clients/${client.id}`}
                          className="flex items-center gap-2 hover:text-burgundy transition-colors group/link"
                        >
                          <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-burgundy/10 text-burgundy flex items-center justify-center font-bold text-xs md:text-sm shrink-0 border border-burgundy/20 group-hover/link:border-burgundy/40 transition-all">
                            {client.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={client.logo_url}
                                alt={client.name}
                                className="w-full h-full object-cover rounded-lg md:rounded-xl"
                              />
                            ) : (
                              client.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="font-semibold text-foreground group-hover/link:text-burgundy transition-colors truncate max-w-[120px] md:max-w-[200px]">
                            {client.name}
                          </div>
                        </Link>
                      </td>

                      {/* Company */}
                      <td className="px-3 py-2.5 md:px-6 md:py-4.5">
                        <div className="flex items-center gap-1.5 font-medium text-foreground/80 text-xs md:text-sm">
                          <Building className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[100px] md:max-w-[150px]">
                            {client.company || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="px-3 py-2.5 md:px-6 md:py-4.5 space-y-0.5">
                        {client.contact_email && (
                          <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground">
                            <Mail className="w-3 h-3 text-muted-foreground/85 shrink-0" />
                            <span className="select-all truncate max-w-[120px] md:max-w-none">{client.contact_email}</span>
                          </div>
                        )}
                        {client.contact_phone && (
                          <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground">
                            <Phone className="w-3 h-3 text-muted-foreground/85 shrink-0" />
                            <span className="select-all">{client.contact_phone}</span>
                          </div>
                        )}
                        {!client.contact_email && !client.contact_phone && (
                          <span className="text-muted-foreground text-[10px] md:text-xs">—</span>
                        )}
                      </td>

                      {/* Active Projects Count */}
                      <td className="px-3 py-2.5 md:px-6 md:py-4.5">
                        <div className="flex items-center gap-1.5 text-xs md:text-sm">
                          <Briefcase className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                          <span className="font-semibold text-foreground/90 font-mono">
                            {activeCount}
                          </span>
                          {totalCount > activeCount && (
                            <span className="text-[10px] md:text-xs text-muted-foreground font-mono">
                              / {totalCount}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 md:px-6 md:py-4.5">
                        <span className={cn("px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full border text-[10px] md:text-xs font-semibold select-none", statusBadgeClass)}>
                          {statusText}
                        </span>
                      </td>

                      {/* Actions Dropdown */}
                      <td className="px-3 py-2.5 md:px-6 md:py-4.5 text-right relative">
                        <ClientActions
                          client={client}
                          onEdit={(c) => {
                            setEditingClient(c);
                            setDialogOpen(true);
                          }}
                          onDelete={handleDelete}
                          isPending={isPending}
                        />
                      </td>
                    </tr>
                  );
                })}

                {hasMore && (
                  <tr ref={observerRef}>
                    <td colSpan={6} className="py-6 text-center">
                      {isLoading && (
                        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground animate-pulse justify-center w-full">
                          <Loader2 className="w-4 h-4 animate-spin text-burgundy" />
                          <span>Daha fazla müşteri yükleniyor...</span>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Client Dialog */}
      <ClientDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingClient(null);
        }}
        onSaveSuccess={handleSaveSuccess}
        editingClient={editingClient}
      />
    </div>
  );
}
