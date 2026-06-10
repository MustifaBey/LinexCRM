import { getTransactions } from "@/actions/finance";
import { getClients, getProjects } from "@/actions/projects";
import { createClient } from "@/lib/supabase/server";
import { FinanceDashboard } from "@/components/finance/finance-dashboard";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const supabase = await createClient();

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch role for Double-Gate authorization
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as any;

  const userRole = profile?.role;

  // Render Restricted view if user is a Client
  if (!userRole || !["owner", "admin", "member"].includes(userRole)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 select-none">
        <div className="bg-burgundy/10 border border-burgundy/20 p-4 rounded-full mb-4 animate-pulse">
          <Lock className="w-10 h-10 text-burgundy" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Kısıtlı Finansal Veri
        </h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-md">
          Yalnızca ajans personelinin finansal defterleri, gelir rakamlarını ve bütçeleri görüntüleme veya yönetme izni vardır.
        </p>
      </div>
    );
  }

  // 3. Fetch all data in parallel on the server
  const [
    clients,
    projects,
    transactionsRes,
  ] = await Promise.all([
    getClients().catch(() => []),
    getProjects().catch(() => []),
    getTransactions(),
  ]);

  const transactions = transactionsRes.data || [];

  return (
    <FinanceDashboard
      initialTransactions={transactions}
      clients={clients}
      projects={projects}
      userRole={userRole}
    />
  );
}
