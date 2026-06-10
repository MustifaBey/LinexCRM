"use server";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createClientAction(data: {
  name: string;
  contact_email?: string;
  contact_phone?: string;
  company?: string;
  logo_url?: string;
  notes?: string;
  pipeline_status?: string;
  status?: string;
}) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  const { data: newClient, error } = await supabase
    .from("clients")
    .insert({
      name: data.name.trim(),
      contact_email: data.contact_email?.trim() || null,
      contact_phone: data.contact_phone?.trim() || null,
      company: data.company?.trim() || null,
      logo_url: data.logo_url?.trim() || null,
      notes: data.notes?.trim() || null,
      created_by: user.id,
      pipeline_status: data.pipeline_status || data.status || "lead",
    } as any)
    .select()
    .single() as any;

  if (error) return { error: error.message };

  revalidatePath("/projects");
  revalidatePath("/clients");
  return { data: newClient };
}

export async function updateClientAction(
  id: string,
  data: {
    name: string;
    contact_email?: string;
    contact_phone?: string;
    company?: string;
    logo_url?: string;
    notes?: string;
    pipeline_status?: string;
    status?: string;
  }
) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  const { data: updatedClient, error } = await (supabase
    .from("clients") as any)
    .update({
      name: data.name.trim(),
      contact_email: data.contact_email?.trim() || null,
      contact_phone: data.contact_phone?.trim() || null,
      company: data.company?.trim() || null,
      logo_url: data.logo_url?.trim() || null,
      notes: data.notes?.trim() || null,
      pipeline_status: data.pipeline_status || data.status,
    } as any)
    .eq("id", id)
    .select()
    .single() as any;

  if (error) return { error: error.message };

  revalidatePath("/projects");
  revalidatePath("/clients");
  return { data: updatedClient };
}

export async function getClientsList() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  const { data, error } = await supabase
    .from("clients")
    .select(`
      *,
      projects (id, status)
    `)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { data: data || [] };
}

export async function deleteClientAction(id: string) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/clients");
  revalidatePath("/projects");
  return { success: true };
}

export async function getClientDetail(id: string) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  const { data: client, error } = await supabase
    .from("clients")
    .select(`
      *,
      projects (
        id,
        name,
        status,
        start_date,
        end_date,
        progress,
        budget
      )
    `)
    .eq("id", id)
    .single();

  if (error) return { error: error.message };
  return { data: client };
}

export async function createClientPortalAccountAction(clientId: string) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  // Fetch client details
  const { data: client, error: fetchError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single() as any;

  if (fetchError || !client) {
    return { error: "Müşteri kaydı bulunamadı." };
  }

  if (client.portal_user_id) {
    return { error: "Bu müşteri için zaten bir portal hesabı mevcut." };
  }

  if (!client.contact_email) {
    return { error: "Müşterinin e-posta adresi tanımlanmamış. Hesap oluşturulamaz." };
  }

  // Generate random temporary password
  const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase() + "1!";

  try {
    const adminSupabase = createAdminClient();

    // 1. Create User in auth.users
    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email: client.contact_email.trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: client.name,
      }
    });

    if (authError || !authUser?.user) {
      return { error: `Kimlik doğrulama hesabı oluşturulamadı: ${authError?.message}` };
    }

    const userId = authUser.user.id;

    // 2. Set profile role = 'client'
    const { error: profileError } = await (adminSupabase
      .from("profiles") as any)
      .update({ role: "client" })
      .eq("id", userId);

    if (profileError) {
      // Clean up user if profile update fails
      await adminSupabase.auth.admin.deleteUser(userId);
      return { error: `Müşteri profili güncellenemedi: ${profileError.message}` };
    }

    // 3. Link portal_user_id in clients
    const { error: clientUpdateError } = await (adminSupabase
      .from("clients") as any)
      .update({ portal_user_id: userId })
      .eq("id", clientId);

    if (clientUpdateError) {
      // Clean up profile/user if clients update fails
      await adminSupabase.auth.admin.deleteUser(userId);
      return { error: `Müşteri kaydı ilişkilendirilemedi: ${clientUpdateError.message}` };
    }

    revalidatePath("/clients");
    revalidatePath(`/clients/${clientId}`);

    return {
      success: true,
      email: client.contact_email,
      password: tempPassword
    };
  } catch (err: any) {
    return { error: `Beklenmeyen bir hata oluştu: ${err.message || err}` };
  }
}
