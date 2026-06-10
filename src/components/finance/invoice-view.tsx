"use client";

import { Printer, ArrowLeft, Hexagon, Check, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/types/database";

interface InvoiceViewProps {
  invoice: any; // Invoice joined with client and project
}

export function InvoiceView({ invoice }: InvoiceViewProps) {
  const isPaid = invoice.status === "paid";
  
  // Calculations
  const amount = Number(invoice.amount) || 0;
  const kdvRate = 0.20; // 20% Turkish VAT
  const subtotal = amount / (1 + kdvRate);
  const kdvAmount = amount - subtotal;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: invoice.currency || "TRY"
    }).format(val);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto print:p-0">
      
      {/* Print styles wrapper */}
      <style jsx global>{`
        @media print {
          /* Hide all dashboard layout elements */
          header, aside, footer, nav, button, .no-print {
            display: none !important;
          }
          body {
            background-color: white !important;
            color: black !important;
          }
          .print-container {
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Action Navigation Bar (Hidden when printing) */}
      <div className="flex items-center justify-between no-print bg-card/40 border border-border/60 p-4 rounded-2xl backdrop-blur-md">
        <Link
          href="/finance"
          className="h-10 px-4 rounded-xl border border-border bg-input/40 text-muted-foreground text-xs font-semibold hover:text-foreground hover:bg-muted transition-all flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Finans Defterine Dön</span>
        </Link>

        <button
          onClick={() => window.print()}
          className="h-10 px-5 rounded-xl gradient-burgundy text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-burgundy/10"
        >
          <Printer className="w-4 h-4" />
          <span>Faturayı Yazdır</span>
        </button>
      </div>

      {/* Invoice Card Container */}
      <div 
        id="invoice-print-area" 
        className="print-container bg-card border border-border/80 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden text-foreground"
      >
        {/* Status Stamp */}
        <div className="absolute top-8 right-8 select-none print:top-4 print:right-4">
          <div 
            className={cn(
              "px-4 py-2 rounded-2xl border-2 text-sm font-extrabold uppercase tracking-widest rotate-6 flex items-center gap-1.5",
              isPaid 
                ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/5"
                : "border-amber-500/40 text-amber-500 bg-amber-500/5"
            )}
          >
            {isPaid ? (
              <>
                <Check className="w-4 h-4" />
                <span>ÖDENDİ</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>TASLAK</span>
              </>
            )}
          </div>
        </div>

        {/* Brand & Address */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 pb-8 border-b border-border/60">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-burgundy flex items-center justify-center shadow-lg overflow-hidden">
                <img src="/logo.png" alt="Linex Medya" className="w-6 h-6 object-contain" />
              </div>
              <span className="text-lg font-bold tracking-wider uppercase text-foreground">Linex Medya</span>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p>Linex Medya ve Yazılım Hizmetleri</p>
              <p>Maslak Mah. Büyükdere Cad. No: 240</p>
              <p>Sarıyer / İstanbul</p>
              <p>Vergi Dairesi: Maslak | V.N: 8462057193</p>
              <p>destek@linexmedya.com</p>
            </div>
          </div>

          <div className="space-y-1.5 md:text-right pt-2 md:pt-0">
            <h1 className="text-2xl font-black text-foreground">FATURA</h1>
            <p className="text-xs text-muted-foreground font-semibold">No: {invoice.invoice_number}</p>
            
            <div className="grid grid-cols-2 md:block text-xs gap-x-4 pt-2">
              <div>
                <span className="text-muted-foreground">Düzenleme Tarihi: </span>
                <span className="font-semibold">{formatDate(invoice.created_at)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Son Ödeme Tarihi: </span>
                <span className="font-semibold">{formatDate(invoice.due_date)}</span>
              </div>
              {invoice.paid_date && (
                <div>
                  <span className="text-muted-foreground">Ödeme Tarihi: </span>
                  <span className="font-semibold text-emerald-400">{formatDate(invoice.paid_date)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Client & Project details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-b border-border/60 text-xs">
          <div className="space-y-2">
            <h3 className="font-bold uppercase tracking-wider text-muted-foreground">Müşteri Bilgileri</h3>
            <div className="space-y-1 text-foreground leading-relaxed">
              <p className="font-bold text-sm">{invoice.client?.name}</p>
              {invoice.client?.company && <p className="font-semibold text-muted-foreground">{invoice.client.company}</p>}
              {invoice.client?.contact_email && <p>E-posta: {invoice.client.contact_email}</p>}
              {invoice.client?.contact_phone && <p>Tel: {invoice.client.contact_phone}</p>}
            </div>
          </div>

          {invoice.project && (
            <div className="space-y-2 md:text-right">
              <h3 className="font-bold uppercase tracking-wider text-muted-foreground">İlişkili Proje</h3>
              <p className="font-bold text-sm text-foreground">{invoice.project.name}</p>
              <p className="text-muted-foreground">Ajans Proje Yönetim Sistemi Hizmeti</p>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="py-8">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-bold">
                <th className="py-3 font-semibold">Açıklama / Hizmet Detayı</th>
                <th className="py-3 text-right font-semibold">Miktar</th>
                <th className="py-3 text-right font-semibold">Birim Fiyat</th>
                <th className="py-3 text-right font-semibold">Toplam (KDV Hariç)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              <tr className="text-foreground">
                <td className="py-4 font-semibold leading-relaxed">
                  {invoice.notes || "Ajans hizmet bedeli ödemesi."}
                  {invoice.project && <span className="block text-[10px] text-muted-foreground mt-0.5">{invoice.project.name} projesi kapsamında</span>}
                </td>
                <td className="py-4 text-right">1</td>
                <td className="py-4 text-right">{formatCurrency(subtotal)}</td>
                <td className="py-4 text-right">{formatCurrency(subtotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Calculations / Totals */}
        <div className="flex justify-end pt-4 border-t border-border">
          <div className="w-full md:w-64 space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Ara Toplam (KDV Hariç):</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>KDV (%20):</span>
              <span className="font-medium">{formatCurrency(kdvAmount)}</span>
            </div>
            <div className="flex justify-between text-foreground text-sm font-bold pt-2 border-t border-border/60">
              <span>Genel Toplam (KDV Dahil):</span>
              <span className="text-burgundy">{formatCurrency(amount)}</span>
            </div>
          </div>
        </div>

        {/* Footer / Notes */}
        <div className="mt-16 pt-6 border-t border-border/40 text-[10px] text-muted-foreground leading-relaxed">
          <p className="font-bold">Önemli Notlar:</p>
          <p>1. Lütfen ödemelerinizi faturada belirtilen son ödeme tarihine kadar gerçekleştirin.</p>
          <p>2. Havale/EFT açıklamasına fatura numarasını ({invoice.invoice_number}) eklemeyi unutmayın.</p>
          <p className="mt-4 text-center text-muted-foreground/60">LinexCRM tarafından otomatik olarak üretilmiştir. Elektronik faturadır.</p>
        </div>

      </div>
    </div>
  );
}
