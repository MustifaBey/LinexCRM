"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { DomainRecord } from "@/types/database";

/**
 * Fetch all domain records.
 * Joins the associated client and orders by expiration_date ascending.
 */
export async function getDomainRecords() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("domain_records")
    .select("*, client:clients(id, name, company, logo_url)")
    .order("expiration_date", { ascending: true }) as any;

  if (error) {
    return { error: error.message, data: null };
  }

  return { data: data as (DomainRecord & { client?: { id: string; name: string; company: string | null; logo_url: string | null } })[], error: null };
}

/**
 * Create a new domain / hosting tracker record.
 */
export async function createDomainRecord(data: {
  client_id: string;
  service_type: "domain" | "hosting" | "ssl" | "email";
  domain_name: string;
  provider?: string | null;
  registration_date?: string | null;
  expiration_date: string;
  auto_renew?: boolean;
  annual_cost?: number | null;
  notes?: string | null;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const { data: newRecord, error } = await supabase
    .from("domain_records")
    .insert({
      client_id: data.client_id,
      service_type: data.service_type,
      domain_name: data.domain_name.trim(),
      provider: data.provider?.trim() || null,
      registration_date: data.registration_date || null,
      expiration_date: data.expiration_date,
      auto_renew: !!data.auto_renew,
      annual_cost: data.annual_cost || null,
      notes: data.notes?.trim() || null,
      created_by: user.id,
    } as any)
    .select()
    .single() as any;

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/domains");
  return { data: newRecord, error: null };
}

/**
 * Update an existing domain / hosting record.
 */
export async function updateDomainRecord(
  id: string,
  updates: Partial<{
    client_id: string;
    service_type: "domain" | "hosting" | "ssl" | "email";
    domain_name: string;
    provider: string | null;
    registration_date: string | null;
    expiration_date: string;
    auto_renew: boolean;
    annual_cost: number | null;
    notes: string | null;
  }>
) {
  const supabase = await createClient();

  const { error } = await (supabase
    .from("domain_records") as any)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/domains");
  return { success: true };
}

/**
 * Delete a domain tracker record.
 */
export async function deleteDomainRecord(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("domain_records")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/domains");
  return { success: true };
}
