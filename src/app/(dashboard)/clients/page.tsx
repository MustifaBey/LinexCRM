import { getClientsList } from "@/actions/clients";
import { ClientsTable } from "@/components/clients/clients-table";

export const revalidate = 0; // Disable page caching to guarantee fresh table data on reload

export default async function ClientsPage() {
  const result = await getClientsList().catch(() => ({ data: [], error: "Müşteri listesi alınırken bir bağlantı hatası oluştu." }));
  const clients = result.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Müşteri Yönetimi</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ajansınızın tüm iş ortaklarını, müşteri iletişim detaylarını ve güncel proje durumlarını buradan yönetin.
        </p>
      </div>

      {result.error && (
        <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/40 text-red-400 text-xs">
          Sistem Uyarısı: {result.error}
        </div>
      )}

      {/* Main Table Wrapper */}
      <ClientsTable initialClients={clients} />
    </div>
  );
}
