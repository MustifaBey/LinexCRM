import { getClientDetail } from "@/actions/clients";
import { ClientDetailView } from "@/components/clients/client-detail-view";
import { Building } from "lucide-react";
import Link from "next/link";

export const revalidate = 0; // Disable page caching to guarantee fresh client details on reload

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;

  const result = await getClientDetail(id).catch(() => ({ data: null, error: "Müşteri detayları alınırken bir bağlantı hatası oluştu." }));
  const client = result.data;

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 select-none">
        <div className="bg-burgundy/10 border border-burgundy/20 p-4 rounded-full mb-4">
          <Building className="w-10 h-10 text-burgundy" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Müşteri Bulunamadı
        </h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-sm">
          Aradığınız müşteri kaydı mevcut değil veya silinmiş olabilir.
        </p>
        <Link
          href="/clients"
          className="mt-6 px-4 py-2 rounded-xl border border-border bg-card text-muted-foreground text-sm font-medium hover:text-foreground hover:bg-muted transition-all"
        >
          Müşterilere Geri Dön
        </Link>
      </div>
    );
  }

  return <ClientDetailView client={client} />;
}
