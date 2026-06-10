"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getTickets() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  // Fetch current user's profile to inspect role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as any;

  let query = (supabase
    .from("tickets") as any)
    .select(`
      *,
      client:profiles!client_id (id, full_name, email, avatar_url)
    `);

  // If user is client, restrict to their own tickets
  if (profile?.role === "client") {
    query = query.eq("client_id", user.id);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { data: data || [] };
}

export async function getTicketMessages(ticketId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  const { data, error } = await (supabase
    .from("ticket_messages") as any)
    .select(`
      *,
      sender:profiles!sender_id (id, full_name, email, avatar_url, role)
    `)
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };
  return { data: data || [] };
}

export async function createTicket(data: {
  subject: string;
  priority: "low" | "medium" | "high" | "urgent";
  message: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  // 1. Insert ticket
  const { data: ticket, error: ticketError } = await (supabase
    .from("tickets") as any)
    .insert({
      client_id: user.id,
      subject: data.subject,
      status: "open",
      priority: data.priority,
    })
    .select()
    .single();

  if (ticketError) return { error: ticketError.message };

  // 2. Insert initial message
  const { error: msgError } = await (supabase
    .from("ticket_messages") as any)
    .insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      is_staff: false,
      message: data.message,
    });

  if (msgError) {
    // Attempt rollback/cleanup of the ticket
    await (supabase.from("tickets") as any).delete().eq("id", ticket.id);
    return { error: msgError.message };
  }

  revalidatePath("/tickets");
  revalidatePath("/portal/tickets");
  return { data: ticket };
}

export async function createTicketMessage(data: {
  ticketId: string;
  message: string;
  isStaff: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  const { data: newMessage, error } = await (supabase
    .from("ticket_messages") as any)
    .insert({
      ticket_id: data.ticketId,
      sender_id: user.id,
      is_staff: data.isStaff,
      message: data.message,
    })
    .select(`
      *,
      sender:profiles!sender_id (id, full_name, email, avatar_url, role)
    `)
    .single();

  if (error) return { error: error.message };

  // If client replies, automatically move status back to "open" so staff notices it
  if (!data.isStaff) {
    await (supabase
      .from("tickets") as any)
      .update({ status: "open" })
      .eq("id", data.ticketId);
  }

  revalidatePath("/tickets");
  revalidatePath("/portal/tickets");
  return { data: newMessage };
}

export async function updateTicketStatus(id: string, status: "open" | "pending" | "resolved") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  const { data: updatedTicket, error } = await (supabase
    .from("tickets") as any)
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/tickets");
  revalidatePath("/portal/tickets");
  return { data: updatedTicket };
}

export async function deleteTicket(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  // Verify role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as any;

  const isStaff = profile && ["owner", "admin", "member"].includes(profile.role);
  if (!isStaff) return { error: "Bu yetkiye sahip değilsiniz." };

  const { error } = await (supabase.from("tickets") as any).delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/tickets");
  revalidatePath("/portal/tickets");
  return { success: true };
}
