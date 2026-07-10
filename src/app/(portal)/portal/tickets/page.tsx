"use client";

import { useState, useEffect, useRef, startTransition, useOptimistic } from "react";
import { getTickets, getTicketMessages, createTicket, createTicketMessage } from "@/actions/tickets";
import { createClient } from "@/lib/supabase/client";
import { 
  LifeBuoy, 
  Plus, 
  Send, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  ChevronRight,
  ArrowLeft,
  User
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

export default function ClientTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Create Form State
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [initialMessage, setInitialMessage] = useState("");
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Message Input State
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load tickets on mount
  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setIsLoadingTickets(true);
    const res = await getTickets();
    if (res.error) {
      toast.error("Talepler yüklenirken hata: " + res.error);
    } else {
      setTickets(res.data || []);
    }
    setIsLoadingTickets(false);
  };

  // Fetch messages when ticket changes
  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
      setShowCreateForm(false);
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
      // Scroll to bottom after loading messages
      setTimeout(scrollToBottom, 100);
    }
    setIsLoadingMessages(false);
  };

  // Realtime subscription setup
  useEffect(() => {
    const supabase = createClient();

    // 1. Subscribe to ticket_messages table inserts for selected ticket
    let messageChannel: any;
    if (selectedTicket?.id) {
      messageChannel = supabase
        .channel(`ticket-msgs-${selectedTicket.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "ticket_messages",
            filter: `ticket_id=eq.${selectedTicket.id}`,
          },
          (payload) => {
            // Realtime update: fetch new messages automatically to append profile joins
            fetchMessages(selectedTicket.id);
          }
        )
        .subscribe();
    }

    // 2. Subscribe to general tickets table changes (status, etc.)
    const ticketsChannel = supabase
      .channel("tickets-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
        },
        (payload) => {
          // Refresh list of tickets in sidebar
          fetchTickets();

          // Sync status of current active ticket if changed
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

  // Handle new ticket submission
  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !initialMessage.trim()) {
      toast.error("Lütfen tüm alanları doldurun.");
      return;
    }

    setIsSubmittingTicket(true);
    const res = await createTicket({
      subject,
      priority,
      message: initialMessage,
    });

    if (res.error) {
      toast.error("Talep oluşturulamadı: " + res.error);
    } else {
      toast.success("Destek talebiniz başarıyla oluşturuldu.");
      setSubject("");
      setInitialMessage("");
      setPriority("medium");
      setShowCreateForm(false);
      // Select the new ticket
      if (res.data) {
        setSelectedTicket(res.data);
      }
      fetchTickets();
    }
    setIsSubmittingTicket(false);
  };

  // Handle sending a reply message
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    const text = replyText;
    setReplyText("");
    setIsSendingReply(true);

    const res = await createTicketMessage({
      ticketId: selectedTicket.id,
      message: text,
      isStaff: false,
    });

    if (res.error) {
      toast.error("Mesaj gönderilemedi: " + res.error);
    } else {
      // Message will also arrive via realtime listener, but trigger scroll and force sync here
      fetchMessages(selectedTicket.id);
    }
    setIsSendingReply(false);
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
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row bg-background">
      {/* SIDEBAR: Tickets list */}
      <div className={cn(
        "w-full md:w-80 border-r border-border bg-card/15 flex flex-col shrink-0 overflow-hidden",
        selectedTicket || showCreateForm ? "hidden md:flex" : "flex"
      )}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-burgundy" />
            <h2 className="font-extrabold text-sm text-foreground">Taleplerim</h2>
          </div>
          <button
            onClick={() => {
              setSelectedTicket(null);
              setShowCreateForm(true);
            }}
            className="p-1.5 rounded-xl bg-burgundy/10 border border-burgundy/25 text-burgundy hover:bg-burgundy/20 hover:scale-105 transition-all"
            title="Yeni Talep Oluştur"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Tickets List Scroll area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
          {isLoadingTickets ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground select-none">
              <Loader2 className="w-6 h-6 animate-spin text-burgundy mb-2" />
              <span className="text-xs">Yükleniyor...</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 px-4 select-none">
              <p className="text-xs font-semibold text-muted-foreground">Kayıtlı destek talebiniz bulunmuyor.</p>
              <button
                onClick={() => {
                  setSelectedTicket(null);
                  setShowCreateForm(true);
                }}
                className="mt-4 px-3 py-1.5 text-xs bg-burgundy/10 border border-burgundy/30 text-burgundy hover:bg-burgundy/20 font-bold rounded-xl transition-all"
              >
                İlk Talebi Oluştur
              </button>
            </div>
          ) : (
            tickets.map((t) => {
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
                      "text-[9px] font-bold px-2 py-0.5 rounded border uppercase",
                      STATUS_COLORS[t.status as keyof typeof STATUS_COLORS] || ""
                    )}>
                      {STATUS_LABELS[t.status as keyof typeof STATUS_LABELS]}
                    </span>
                    <span className="text-[9px] font-mono">
                      {formatDate(t.created_at)}
                    </span>
                  </div>

                  <h4 className="font-bold text-xs text-foreground truncate max-w-[210px] mb-2">{t.subject}</h4>

                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-[9px] font-semibold px-2 py-0.5 rounded border",
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

      {/* DETAIL AREA: Active message view or creation form */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {showCreateForm ? (
          /* NEW TICKET FORM */
          <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-2xl mx-auto w-full flex flex-col justify-center animate-in fade-in duration-200">
            {/* Back button on mobile */}
            <button
              onClick={() => setShowCreateForm(false)}
              className="md:hidden flex items-center gap-1.5 text-xs text-muted-foreground mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Geri Dön</span>
            </button>

            <div className="space-y-6">
              <div className="space-y-1 text-center md:text-left select-none">
                <h2 className="text-xl font-extrabold text-foreground">Yeni Destek Talebi</h2>
                <p className="text-xs text-muted-foreground">
                  Teknik problemler, tasarım revizyonları veya sorularınız için ajans ekibimize talep açın.
                </p>
              </div>

              <form onSubmit={handleCreateTicketSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Talep Başlığı / Konu</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Logo dosyalarının SVG halleri, sunucu hatası vb."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Öncelik Seviyesi</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full h-11 px-3 rounded-xl bg-card border border-border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-ring transition-all select-none"
                  >
                    <option value="low">Düşük (Acil değil, genel sorular)</option>
                    <option value="medium">Orta (Standart revizyon ve talepler)</option>
                    <option value="high">Yüksek (Hızlı müdahale gereken durumlar)</option>
                    <option value="urgent">Acil (Çalışmayı durduran kritik hatalar)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Mesajınız / Sorunun Detayı</label>
                  <textarea
                    required
                    rows={6}
                    placeholder="Lütfen talebinizi detaylı olarak açıklayın..."
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    className="w-full p-4 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 h-11 rounded-xl border border-border hover:bg-card text-xs font-bold transition-all"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTicket}
                    className="flex-1 h-11 rounded-xl bg-burgundy hover:bg-burgundy-light disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    {isSubmittingTicket ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <LifeBuoy className="w-4 h-4" />
                        <span>Talebi Gönder</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : selectedTicket ? (
          /* MESSAGE THREAD FEED */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Thread Header */}
            <div className="p-4 border-b border-border bg-card/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="md:hidden p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="font-extrabold text-sm text-foreground line-clamp-1">{selectedTicket.subject}</h3>
                  <div className="flex items-center gap-2 mt-1 select-none">
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase",
                      STATUS_COLORS[selectedTicket.status as keyof typeof STATUS_COLORS] || ""
                    )}>
                      {STATUS_LABELS[selectedTicket.status as keyof typeof STATUS_LABELS]}
                    </span>
                    <span className={cn(
                      "text-[9px] font-semibold px-1.5 py-0.5 rounded border",
                      PRIORITY_COLORS[selectedTicket.priority as keyof typeof PRIORITY_COLORS] || ""
                    )}>
                      {PRIORITY_LABELS[selectedTicket.priority as keyof typeof PRIORITY_LABELS]}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Message Feed area */}
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
                        fromStaff ? "mr-auto" : "ml-auto flex-row-reverse"
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

                      {/* Content Bubble */}
                      <div className="space-y-1">
                        {/* Name and timestamp */}
                        <div className={cn(
                          "flex items-center gap-1.5 text-[10px] select-none",
                          fromStaff ? "justify-start text-muted-foreground" : "justify-end text-muted-foreground"
                        )}>
                          <span className="font-bold text-foreground/80">
                            {fromStaff ? "Linex Medya" : m.sender?.full_name || "Müşteri"}
                          </span>
                          {fromStaff && (
                            <span className="bg-burgundy/15 text-burgundy text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-burgundy/25 scale-90">
                              Temsilci
                            </span>
                          )}
                          <span>•</span>
                          <span>{formatDate(m.created_at)}</span>
                        </div>

                        {/* Message body */}
                        <div className={cn(
                          "p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words border",
                          fromStaff
                            ? "bg-card border-border/80 text-foreground rounded-tl-none"
                            : "bg-burgundy text-white border-burgundy/40 rounded-tr-none"
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

            {/* Input area */}
            <form onSubmit={handleSendReply} className="p-4 border-t border-border bg-card/10 flex gap-3 shrink-0">
              <input
                type="text"
                required
                disabled={selectedTicket.status === "resolved"}
                placeholder={selectedTicket.status === "resolved" 
                  ? "Bu talep çözüldüğü için yeni mesaj gönderilemez." 
                  : "Mesajınızı buraya yazın..."
                }
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 h-11 px-4 rounded-xl bg-card border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isSendingReply || !replyText.trim() || selectedTicket.status === "resolved"}
                className="w-11 h-11 rounded-xl bg-burgundy hover:bg-burgundy-light disabled:opacity-40 text-white transition-all flex items-center justify-center shrink-0"
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
            <h3 className="font-extrabold text-sm text-foreground">Destek ve Talep Yönetimi</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
              Herhangi bir revizyon veya teknik yardım talebi için soldaki menüden bir bilet seçin veya yeni bir talep başlatın.
            </p>
            <button
              onClick={() => {
                setSelectedTicket(null);
                setShowCreateForm(true);
              }}
              className="mt-6 px-4 py-2 bg-burgundy hover:bg-burgundy-light text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-burgundy/20"
            >
              Yeni Talep Başlat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
