import { getDomainRecords } from "@/actions/domains";
import { getClients } from "@/actions/projects";
import { DomainTable } from "@/components/domains/domain-table";

export const revalidate = 0; // Disable page caching to ensure fresh logs on reload

export default async function DomainsPage() {
  // Fetch clients list and domain records in parallel on server
  const [clients, domainsData] = await Promise.all([
    getClients().catch(() => []),
    getDomainRecords().catch(() => ({ data: [], error: null })),
  ]);

  const domains = domainsData.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Domain & Hosting Alarm System</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor domain registration status, hosting nodes, SSL certificates, and professional mail renewals.
        </p>
      </div>

      <DomainTable initialRecords={domains} clients={clients} />
    </div>
  );
}
