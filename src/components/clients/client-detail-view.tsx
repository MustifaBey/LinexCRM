"use client";

import { useState, useTransition } from "react";
import { createClientPortalAccountAction } from "@/actions/clients";
import { toast } from "sonner";
import {
  Building,
  Mail,
  Phone,
  Briefcase,
  Key,
  Copy,
  Check,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Calendar,
  DollarSign,
  FileText
} from "lucide-react";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import { PROJECT_STATUSES } from "@/lib/constants";

interface ClientDetailViewProps {
  client: any;
}

export function ClientDetailView({ client: initialClient }: ClientDetailViewProps) {
  const [client, setClient] = useState<any>(initialClient);
  const [isPending, startTransition] = useTransition();
  const [credentials, setCredentials] = useState<{ email: string; pass: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const projects = client.projects || [];
  const totalBudget = projects.reduce((sum: number, p: any) => sum + (p.budget || 0), 0);

  const handleCreatePortalAccount = () => {
    if (!client.contact_email) {
      toast.error("Hesap oluşturulamaz: Müşterinin e-posta adresi tanımlanmamış.");
      return;
    }

    if (!window.confirm(`${client.name} için bir portal hesabı oluşturmak istediğinize emin misiniz?`)) {
      return;
    }

    startTransition(async () => {
      const result = await createClientPortalAccountAction(client.id);
      if (result.error) {
        toast.error(result.error);
      } else if (result.success && result.password) {
        toast.success("Müşteri portal hesabı başarıyla oluşturuldu.");
        setCredentials({ email: result.email || "", pass: result.password });
        setClient((prev: any) => ({ ...prev, portal_user_id: "created" }));
      }
    });
  };

  const handleCopyCredentials = () => {
    if (!credentials) return;
    const text = `Giriş E-postası: ${credentials.email}\nGeçici Şifre: ${credentials.pass}\nGiriş URL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Giriş bilgileri panoya kopyalandı.");
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusDetails = (status: string) => {
    return PROJECT_STATUSES.find((s) => s.value === status) || {
      label: status,
      color: "#6b7280"
    };
  };

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/clients"
            className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold hover:text-burgundy transition-colors mb-2 w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Müşterilere Geri Dön</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-burgundy/10 text-burgundy flex items-center justify-center font-bold text-lg border border-burgundy/20 shrink-0">
              {client.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={client.logo_url}
                  alt={client.name}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                client.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{client.name}</h1>
              <p className="text-muted-foreground text-xs font-medium mt-0.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5" />
                <span>{client.company || "Firma Belirtilmemiş"}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Portal Account Action */}
        <div className="shrink-0">
          {client.portal_user_id ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-800/40 bg-emerald-950/20 text-emerald-400 text-xs font-semibold select-none">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Portal Hesabı Aktif</span>
            </div>
          ) : (
            <button
              onClick={handleCreatePortalAccount}
              disabled={isPending || !client.contact_email}
              className="h-10 px-5 rounded-xl gradient-burgundy text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-burgundy/15"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Hesap Oluşturuluyor...</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>Portal Hesabı Oluştur</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Generated Credentials Popup Banner */}
      {credentials && (
        <div className="p-5 rounded-2xl border border-burgundy/40 bg-burgundy/5 space-y-3.5 max-w-xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 text-burgundy font-bold text-sm">
            <Key className="w-4 h-4 animate-bounce" />
            <span>Portal Giriş Bilgileri Oluşturuldu</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Müşterinin portal girişi için kullanılacak geçici şifre aşağıdadır. Bu şifreyi lütfen şimdi kopyalayın, bu sayfadan ayrıldıktan sonra şifre tekrar görüntülenemez.
          </p>
          <div className="bg-input/60 border border-border/80 rounded-xl p-3.5 space-y-2 select-all font-mono text-xs">
            <div><span className="text-muted-foreground">E-posta:</span> <span className="text-foreground font-semibold">{credentials.email}</span></div>
            <div><span className="text-muted-foreground">Geçici Şifre:</span> <span className="text-foreground font-semibold">{credentials.pass}</span></div>
          </div>
          <button
            onClick={handleCopyCredentials}
            className="h-9 w-full px-4 rounded-xl border border-burgundy/30 bg-burgundy/10 text-burgundy hover:bg-burgundy/20 transition-all text-xs font-bold flex items-center justify-center gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Kopyalandı!" : "Bilgileri Kopyala"}</span>
          </button>
        </div>
      )}

      {/* Grid Layout: Left Client Stats/Details, Right Projects List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Client Details */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-4.5 shadow-xl">
            <h3 className="text-sm font-bold text-foreground border-b border-border/60 pb-2.5">
              İletişim ve Detaylar
            </h3>

            {/* Email */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">E-posta</span>
              {client.contact_email ? (
                <a
                  href={`mailto:${client.contact_email}`}
                  className="text-xs text-foreground font-medium hover:text-burgundy hover:underline flex items-center gap-1.5 transition-colors select-all"
                >
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{client.contact_email}</span>
                </a>
              ) : (
                <div className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span>E-posta tanımlanmamış (Portal için gerekli)</span>
                </div>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Telefon</span>
              {client.contact_phone ? (
                <a
                  href={`tel:${client.contact_phone}`}
                  className="text-xs text-foreground font-medium hover:text-burgundy transition-colors flex items-center gap-1.5 select-all"
                >
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{client.contact_phone}</span>
                </a>
              ) : (
                <span className="text-xs text-muted-foreground italic block">—</span>
              )}
            </div>

            {/* Status */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Durum</span>
              {(() => {
                const pipelineMapping: Record<string, { label: string, badge: string }> = {
                  lead: { label: "Potansiyel", badge: "bg-blue-950/40 text-blue-400 border-blue-800/50" },
                  contacted: { label: "Görüşüldü", badge: "bg-zinc-800 text-zinc-300 border-zinc-700" },
                  proposal: { label: "Teklif İletildi", badge: "bg-amber-950/40 text-amber-400 border-amber-800/50" },
                  won: { label: "Kazanıldı", badge: "bg-emerald-950/40 text-emerald-400 border-emerald-800/50" },
                  lost: { label: "Kaybedildi", badge: "bg-rose-950/40 text-rose-400 border-rose-800/50" },
                };
                const statusInfo = pipelineMapping[client.pipeline_status as string] || { label: "Potansiyel", badge: "bg-blue-950/40 text-blue-400 border-blue-800/50" };
                return (
                  <span className={cn("inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border select-none", statusInfo.badge)}>
                    {statusInfo.label}
                  </span>
                );
              })()}
            </div>

            {/* Total Value */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Toplam Proje Hacmi</span>
              <div className="text-sm font-extrabold text-foreground font-mono flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span>{totalBudget.toLocaleString("tr-TR")} TL</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Özel Notlar</span>
              <p className="text-xs text-muted-foreground/90 leading-relaxed whitespace-pre-line bg-input/40 border border-border/60 rounded-xl p-3">
                {client.notes || "Bu müşteri için henüz eklenmiş bir not bulunmamaktadır."}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Projects List */}
        <div className="space-y-6 lg:col-span-2">
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-foreground border-b border-border/60 pb-2.5 flex items-center justify-between">
              <span>İlişkili Projeler</span>
              <span className="text-xs font-semibold text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-lg font-mono">
                {projects.length} Proje
              </span>
            </h3>

            {projects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground space-y-2 select-none border border-dashed border-border/60 rounded-xl bg-card/10 mt-4">
                <Briefcase className="w-8 h-8 mx-auto text-muted-foreground/60" />
                <p className="text-xs font-bold text-foreground">Henüz İlişkili Proje Bulunmuyor</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  Bu müşteri adına oluşturulmuş herhangi bir proje kaydı mevcut değil. Projeler menüsünden yeni bir proje oluştururken bu müşteriyi seçebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40 mt-3">
                {projects.map((p: any) => {
                  const status = getStatusDetails(p.status);
                  return (
                    <div key={p.id} className="py-4.5 first:pt-1.5 last:pb-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4.5 group">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="font-bold text-sm text-foreground group-hover:text-burgundy transition-colors truncate">
                            <Link href={`/projects/${p.id}`}>
                              {p.name}
                            </Link>
                          </h4>
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border select-none"
                            style={{
                              borderColor: `${status.color}30`,
                              color: status.color,
                              backgroundColor: `${status.color}08`
                            }}
                          >
                            {status.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-semibold flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              {p.start_date ? formatDate(p.start_date) : "—"} / {p.end_date ? formatDate(p.end_date) : "—"}
                            </span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono text-foreground/80">
                            <DollarSign className="w-3 h-3 text-emerald-500" />
                            <span>{(p.budget || 0).toLocaleString("tr-TR")} TL</span>
                          </span>
                        </div>
                      </div>

                      {/* Progress bar and view button */}
                      <div className="flex items-center gap-4.5 shrink-0 self-end sm:self-auto select-none">
                        <div className="space-y-1 w-24 text-right">
                          <div className="text-[10px] font-semibold text-muted-foreground">{p.progress}% Tamamlandı</div>
                          <div className="h-1 w-full bg-input rounded-full overflow-hidden">
                            <div
                              className="h-full bg-burgundy rounded-full transition-all duration-300"
                              style={{ width: `${p.progress}%` }}
                            />
                          </div>
                        </div>

                        <Link
                          href={`/projects/${p.id}`}
                          className="h-8 px-3.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <span>Detay</span>
                          <FileText className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
