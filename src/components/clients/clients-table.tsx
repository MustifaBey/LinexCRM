"use client";

import { useState, useMemo, useTransition } from "react";
import { deleteClientAction } from "@/actions/clients";
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
} from "lucide-react";
import { ClientDialog } from "@/components/kanban/client-dialog";
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

  // Filter clients
  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.contact_email && c.contact_email.toLowerCase().includes(q))
    );
  }, [clients, search]);

  return (
    <div className="space-y-6">
      {/* Top Filter and Add Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card/40 border border-border/60 p-4 rounded-2xl backdrop-blur-md">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Müşteri adı, firma veya e-posta ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-input/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>

        {/* Add Client Button */}
        <button
          onClick={() => {
            setEditingClient(null);
            setDialogOpen(true);
          }}
          className="h-10 px-5 rounded-xl gradient-burgundy text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0 shadow-lg shadow-burgundy/10 w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Müşteri Ekle</span>
        </button>
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
        <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                  <th className="px-6 py-4">Müşteri Adı</th>
                  <th className="px-6 py-4">Firma</th>
                  <th className="px-6 py-4">İletişim Bilgileri</th>
                  <th className="px-6 py-4">Aktif Projeler</th>
                  <th className="px-6 py-4">Durum</th>
                  <th className="px-6 py-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
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
                      <td className="px-6 py-4.5">
                        <Link
                          href={`/clients/${client.id}`}
                          className="flex items-center gap-3 hover:text-burgundy transition-colors group/link"
                        >
                          <div className="w-9 h-9 rounded-xl bg-burgundy/10 text-burgundy flex items-center justify-center font-bold text-sm shrink-0 border border-burgundy/20 group-hover/link:border-burgundy/40 transition-all">
                            {client.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={client.logo_url}
                                alt={client.name}
                                className="w-full h-full object-cover rounded-xl"
                              />
                            ) : (
                              client.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="font-semibold text-foreground group-hover/link:text-burgundy transition-colors truncate max-w-[200px]">
                            {client.name}
                          </div>
                        </Link>
                      </td>

                      {/* Company */}
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-2 font-medium text-foreground/80">
                          <Building className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[150px]">
                            {client.company || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="px-6 py-4.5 space-y-1">
                        {client.contact_email && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground/85 shrink-0" />
                            <span className="select-all">{client.contact_email}</span>
                          </div>
                        )}
                        {client.contact_phone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground/85 shrink-0" />
                            <span className="select-all">{client.contact_phone}</span>
                          </div>
                        )}
                        {!client.contact_email && !client.contact_phone && (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Active Projects Count */}
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-muted-foreground/80 shrink-0" />
                          <span className="font-semibold text-foreground/90 font-mono">
                            {activeCount}
                          </span>
                          {totalCount > activeCount && (
                            <span className="text-xs text-muted-foreground font-mono">
                              / {totalCount} toplam
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4.5">
                        <span className={cn("px-2.5 py-1 rounded-full border text-xs font-semibold select-none", statusBadgeClass)}>
                          {statusText}
                        </span>
                      </td>

                      {/* Actions Dropdown */}
                      <td className="px-6 py-4.5 text-right relative">
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
