import { getVaultCredentials } from "@/actions/vault";
import { getClients } from "@/actions/projects";
import { CredentialTable } from "@/components/vault/credential-table";
import { Lock } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VaultPage() {
  // Fetch clients list and vault credentials in parallel on server
  const [clients, vaultData] = await Promise.all([
    getClients().catch(() => []),
    getVaultCredentials(),
  ]);

  if (vaultData.error) {
    const isAccessDenied = vaultData.error.includes("Access denied") || vaultData.error.includes("Admin role required");

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="bg-burgundy/10 border border-burgundy/20 p-4 rounded-full mb-4 animate-pulse">
          <Lock className="w-10 h-10 text-burgundy" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {isAccessDenied ? "Restricted Vault Access" : "Secure Connection Required"}
        </h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-md">
          {isAccessDenied
            ? "This password vault contains highly sensitive client credentials. Only owners and administrators have authorization to view or manage these credentials."
            : vaultData.error || "An unexpected error occurred while loading the vault."}
        </p>
        <div className="mt-6 flex items-center gap-4">
          <Link
            href="/"
            className="px-4 py-2 rounded-xl border border-border bg-card text-muted-foreground text-sm font-medium hover:text-foreground hover:bg-muted transition-all"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const credentials = vaultData.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Secure Vault</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Store, generate, and retrieve client logins, databases, and servers. Secured with AES-256-GCM.
        </p>
      </div>

      <CredentialTable initialCredentials={credentials} clients={clients} />
    </div>
  );
}
