"use client";

import { useState, useEffect, useRef } from "react";
import { getTickets, getTicketMessages, createTicketMessage, updateTicketStatus, deleteTicket } from "@/actions/tickets";
import { createClient } from "@/lib/supabase/client";
import {
  LifeBuoy,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  User,
  Search,
  Trash2,
  CornerDownRight,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PRIORITY_COLORS = {
  low: "bg-zinc-800 text-zinc-400 border-zinc-700/60",
  medium: "bg-blue-950/40 text-blue-400 border-blue-800/40",
  high: "bg-amber-950/40 text-amber-400 border-amber-800/40",
  urgent: "bg-red-950/40 text-red-400 border-red-800/40",
};

const PRIORITY_LABELS = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  urgent: "Acil",
};

const STATUS_COLORS = {
  open: "bg-red-950/30 text-red-400 border-red-800/40",
  pending: "bg-amber-950/30 text-amber-400 border-amber-800/40",
  resolved: "bg-emerald-950/30 text-emerald-400 border-emerald-800/40",
};

const STATUS_LABELS = {
  open: "Açık",
  pending: "Beklemede",
  resolved: "Çözüldü",
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  
  // Loading states
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Message reply state
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async (silent = false) => {
    if (!silent) setIsLoadingTickets(true);
    const res = await getTickets();
    if (res.error) {
      toast.error("Talepler alınamadı: " + res.error);
    } else {
      setTickets(res.data || []);
    }
    if (!silent) setIsLoadingTickets(false);
  };

  // Run filters whenever tickets or filter states change
  useEffect(() => {
    let result = [...tickets];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.subject.toLowerCase().includes(q) ||
          t.client?.full_name?.toLowerCase().includes(q) ||
          t.client?.email?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (priorityFilter !== "all") {
      result = result.filter((t) => t.priority === priorityFilter);
    }

    setFilteredTickets(result);
  }, [tickets, search, statusFilter, priorityFilter]);

  // Load messages when selected ticket changes
  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
    } else {
      setMessages([]);
    }
  }, [selectedTicket?.id]);

  const fetchMessages = async (ticketId: string) => {
    setIsLoadingMessages(true);
    const res = await getTicketMessages(ticketId);
    if (res.error) {
      toast.error("Mesajlar yüklenirken hata: " + res.error);
    } else {
      setMessages(res.data || []);
      setTimeout(scrollToBottom, 100);
    }
    setIsLoadingMessages(false);
  };

  // Realtime subscription setup
  useEffect(() => {
    const supabase = createClient();

    let messageChannel: any;
    if (selectedTicket?.id) {
      messageChannel = supabase
        .channel(`admin-ticket-msgs-${selectedTicket.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "ticket_messages",
            filter: `ticket_id=eq.${selectedTicket.id}`,
          },
          () => {
            fetchMessages(selectedTicket.id);
          }
        )
        .subscribe();
    }

    // Subscribe to tickets table updates
    const ticketsChannel = supabase
      .channel("admin-tickets-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
        },
        (payload) => {
          fetchTickets(true);

          if (payload.eventType === "UPDATE" && selectedTicket && payload.new.id === selectedTicket.id) {
            setSelectedTicket((prev: any) => prev ? { ...prev, status: payload.new.status } : null);
          }
        }
      )
      .subscribe();

    return () => {
      if (messageChannel) supabase.removeChannel(messageChannel);
      supabase.removeChannel(ticketsChannel);
    };
  }, [selectedTicket?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    const text = replyText;
    setReplyText("");
    setIsSendingReply(true);

    const res = await createTicketMessage({
      ticketId: selectedTicket.id,
      message: text,
      isStaff: true, // Mark reply as staff!
    });

    if (res.error) {
      toast.error("Mesaj gönderilemedi: " + res.error);
    } else {
      // Message arrives via realtime, but refresh locally
      fetchMessages(selectedTicket.id);
    }
    setIsSendingReply(false);
  };

  const handleStatusChange = async (newStatus: "open" | "pending" | "resolved") => {
    if (!selectedTicket) return;

    setIsUpdatingStatus(true);
    const res = await updateTicketStatus(selectedTicket.id, newStatus);
    if (res.error) {
      toast.error("Durum güncellenemedi: " + res.error);
    } else {
      toast.success(`Talep durumu "${STATUS_LABELS[newStatus]}" olarak güncellendi.`);
      setSelectedTicket((prev: any) => prev ? { ...prev, status: newStatus } : null);
      fetchTickets(true);
    }
    setIsUpdatingStatus(false);
  };

  const handleDelete = async () => {
    if (!selectedTicket) return;
    if (!window.confirm("Bu destek talebini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) return;

    setIsDeleting(true);
    const res = await deleteTicket(selectedTicket.id);
    if (res.error) {
      toast.error("Talep silinemedi: " + res.error);
    } else {
      toast.success("Destek talebi silindi.");
      setSelectedTicket(null);
      fetchTickets();
    }
    setIsDeleting(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center shrink-0 select-none">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Destek Talepleri</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Müşteriler tarafından açılan teknik destek ve revizyon taleplerini yönetin.
          </p>
        </div>
        <button
          onClick={() => fetchTickets()}
          className="p-2.5 rounded-xl border border-border bg-card/60 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 text-xs font-bold"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Yenile</span>
        </button>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row border border-border bg-card/10 rounded-2xl overflow-hidden min-h-0">
        
        {/* LEFT COLUMN: List & Filters */}
        <div className={cn(
          "w-full lg:w-96 border-r border-border flex flex-col shrink-0 overflow-hidden",
          selectedTicket ? "hidden lg:flex" : "flex"
        )}>
          {/* Filters Area */}
          <div className="p-4 border-b border-border space-y-3 shrink-0">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Konu veya müşteri ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            {/* Dropdown filters */}
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 h-9 px-2.5 rounded-xl bg-card border border-border text-[10px] font-bold focus:outline-none select-none"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="open">Açık</option>
                <option value="pending">Beklemede</option>
                <option value="resolved">Çözüldü</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="flex-1 h-9 px-2.5 rounded-xl bg-card border border-border text-[10px] font-bold focus:outline-none select-none"
              >
                <option value="all">Tüm Öncelikler</option>
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </select>
            </div>
          </div>

          {/* Tickets Scroll area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
            {isLoadingTickets ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground select-none">
                <Loader2 className="w-6 h-6 animate-spin text-burgundy mb-2" />
                <span className="text-xs">Yükleniyor...</span>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-12 px-4 select-none">
                <LifeBuoy className="w-8 h-8 mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-xs font-semibold text-muted-foreground">Eşleşen destek talebi bulunamadı.</p>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isActive = selectedTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={cn(
                      "p-3.5 rounded-2xl border text-left cursor-pointer transition-all hover:scale-[1.01] hover:border-border select-none",
                      isActive
                        ? "bg-burgundy/10 border-burgundy/30 text-foreground"
                        : "bg-card/40 border-border/50 text-muted-foreground hover:bg-card/75"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase",
                        STATUS_COLORS[t.status as keyof typeof STATUS_COLORS] || ""
                      )}>
                        {STATUS_LABELS[t.status as keyof typeof STATUS_LABELS]}
                      </span>
                      <span className="text-[9px] font-mono">
                        {formatDate(t.created_at)}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-foreground truncate max-w-[280px] mb-1.5">{t.subject}</h4>
                    
                    {/* Client row */}
                    <div className="flex items-center gap-1.5 mb-2.5 text-[10px] text-muted-foreground">
                      <div className="w-4 h-4 rounded-full bg-burgundy/10 border border-burgundy/25 flex items-center justify-center overflow-hidden">
                        {t.client?.avatar_url ? (
                          <img src={t.client.avatar_url} alt="" className="object-cover w-full h-full" />
                        ) : (
                          <User className="w-2.5 h-2.5 text-burgundy" />
                        )}
                      </div>
                      <span className="truncate font-semibold text-foreground/80">{t.client?.full_name || "Müşteri"}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[9px] font-semibold px-1.5 py-0.5 rounded border",
                        PRIORITY_COLORS[t.priority as keyof typeof PRIORITY_COLORS] || ""
                      )}>
                        Öncelik: {PRIORITY_LABELS[t.priority as keyof typeof PRIORITY_LABELS]}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Chat Feed & Actions */}
        <div className={cn(
          "flex-1 flex flex-col overflow-hidden bg-background",
          !selectedTicket ? "hidden lg:flex" : "flex"
        )}>
          {selectedTicket ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Thread Header & Toolbar */}
              <div className="p-4 border-b border-border bg-card/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="lg:hidden p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground"
                  >
                    Geri
                  </button>
                  <div>
                    <h3 className="font-extrabold text-sm text-foreground line-clamp-1">{selectedTicket.subject}</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <span>Müşteri: </span>
                      <span className="font-semibold text-foreground/80">{selectedTicket.client?.full_name}</span>
                      <span>({selectedTicket.client?.email})</span>
                    </p>
                  </div>
                </div>

                {/* Staff Actions (Change status / delete) */}
                <div className="flex items-center gap-2 select-none self-end sm:self-center">
                  <div className="flex items-center gap-1.5 bg-card/65 border border-border px-2.5 py-1.5 rounded-xl text-xs">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Durum:</span>
                    <select
                      value={selectedTicket.status}
                      disabled={isUpdatingStatus}
                      onChange={(e) => handleStatusChange(e.target.value as any)}
                      className="bg-transparent border-none text-xs font-bold text-foreground focus:outline-none cursor-pointer"
                    >
                      <option value="open" className="bg-card">Açık</option>
                      <option value="pending" className="bg-card">Beklemede</option>
                      <option value="resolved" className="bg-card">Çözüldü</option>
                    </select>
                    {isUpdatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                  </div>

                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="p-2 rounded-xl bg-red-950/20 border border-red-900/40 text-red-400 hover:bg-red-950/30 transition-all"
                    title="Talebi Sil"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Messages Chat Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {isLoadingMessages ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground select-none">
                    <Loader2 className="w-6 h-6 animate-spin text-burgundy mb-2" />
                    <span className="text-xs">Mesajlar yükleniyor...</span>
                  </div>
                ) : (
                  messages.map((m) => {
                    const fromStaff = m.is_staff;
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "flex items-start gap-2.5 max-w-[80%] md:max-w-[70%]",
                          fromStaff ? "ml-auto flex-row-reverse" : "mr-auto"
                        )}
                      >
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-burgundy/10 border border-burgundy/20 flex items-center justify-center overflow-hidden shrink-0 select-none">
                          {m.sender?.avatar_url ? (
                            <img src={m.sender.avatar_url} alt="" className="object-cover w-full h-full" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-burgundy" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="space-y-1">
                          <div className={cn(
                            "flex items-center gap-1.5 text-[10px] select-none",
                            fromStaff ? "justify-end text-muted-foreground" : "justify-start text-muted-foreground"
                          )}>
                            <span className="font-bold text-foreground/80">
                              {fromStaff ? "Siz (Destek)" : m.sender?.full_name || "Müşteri"}
                            </span>
                            {!fromStaff && (
                              <span className="bg-blue-950/20 text-blue-400 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border border-blue-900/30 scale-90">
                                Müşteri
                              </span>
                            )}
                            <span>•</span>
                            <span>{formatDate(m.created_at)}</span>
                          </div>

                          <div className={cn(
                            "p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words border",
                            fromStaff
                              ? "bg-burgundy text-white border-burgundy/40 rounded-tr-none"
                              : "bg-card border-border/80 text-foreground rounded-tl-none"
                          )}>
                            {m.message}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} className="p-4 border-t border-border bg-card/10 flex gap-3 shrink-0">
                <input
                  type="text"
                  required
                  placeholder="Müşteriye yanıt yazın..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 h-11 px-4 rounded-xl bg-card border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
                <button
                  type="submit"
                  disabled={isSendingReply || !replyText.trim()}
                  className="w-11 h-11 rounded-xl bg-burgundy hover:bg-burgundy-light disabled:opacity-45 text-white transition-all flex items-center justify-center shrink-0"
                >
                  {isSendingReply ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* EMPTY STATE */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
              <div className="w-16 h-16 rounded-2xl bg-burgundy/10 border border-burgundy/20 flex items-center justify-center text-burgundy mb-4">
                <LifeBuoy className="w-8 h-8" />
              </div>
              <h3 className="font-extrabold text-sm text-foreground font-sans">Müşteri Destek Talepleri</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed font-sans">
                Gelen destek biletlerini cevaplamak, önceliklerini incelemek ve durumlarını güncellemek için soldaki listeden bir bilet seçin.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
