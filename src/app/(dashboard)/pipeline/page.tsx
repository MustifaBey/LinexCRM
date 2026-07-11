import { getClientsForPipeline } from "@/actions/pipeline";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const clientsRes = await getClientsForPipeline();
  const clients = clientsRes.data || [];

  return (
    <div className="px-0 py-4 md:p-0 space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Satış Hunisi (CRM)</h1>
        <p className="text-sm text-muted-foreground">
          Müşteri adaylarını ve aktif teklif süreçlerini sürükle-bırak panosu üzerinden takip edin.
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <PipelineBoard initialClients={clients as any[]} />
      </div>
    </div>
  );
}
