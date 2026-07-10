"use server";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getClientsForPipeline() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false }) as any;

  if (error) return { error: error.message };
  return { data: data || [] };
}

export async function updateClientPipelineStatus(clientId: string, status: string) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  const { data: updatedClient, error } = await (supabase
    .from("clients") as any)
    .update({ pipeline_status: status })
    .eq("id", clientId)
    .select()
    .single() as any;

  if (error) return { error: error.message };

  revalidatePath("/pipeline");
  revalidatePath("/clients");
  return { data: updatedClient };
}
