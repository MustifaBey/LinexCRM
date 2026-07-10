import { getInvoice } from "@/actions/finance";
import { InvoiceView } from "@/components/finance/invoice-view";
import { Folder } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface InvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { id } = await params;
  const { data: invoice, error } = await getInvoice(id);

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 select-none">
        <div className="bg-rose-950/20 border border-rose-900/30 p-4 rounded-full mb-4">
          <Folder className="w-10 h-10 text-rose-400" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Fatura Bulunamadı
        </h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-sm">
          {error || "Aradığınız fatura mevcut değil veya görüntüleme yetkiniz yok."}
        </p>
        <Link
          href="/finance"
          className="mt-6 px-4 py-2 rounded-xl border border-border bg-card text-muted-foreground text-sm font-medium hover:text-foreground hover:bg-muted transition-all"
        >
          Finans Defterine Dön
        </Link>
      </div>
    );
  }

  return <InvoiceView invoice={invoice} />;
}
