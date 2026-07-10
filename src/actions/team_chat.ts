"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// Helper to verify staff role
async function verifyStaff(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single() as any;

  return profile && ["owner", "admin", "member"].includes(profile.role);
}

// CHANNELS ACTIONS
export async function getChatChannels() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  if (!(await verifyStaff(supabase, user.id))) {
    return { error: "Bu verilere erişim yetkiniz yok." };
  }

  const { data, error } = await (supabase
    .from("chat_channels") as any)
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };
  return { data: data || [] };
}

export async function createChatChannel(name: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  if (!(await verifyStaff(supabase, user.id))) {
    return { error: "Kanal oluşturma yetkiniz yok." };
  }

  // Format channel name to discord style (lowercase, kebab-case)
  const cleanName = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");

  if (!cleanName) {
    return { error: "Geçersiz kanal adı." };
  }

  const { data, error } = await (supabase
    .from("chat_channels") as any)
    .insert({ name: cleanName })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/chat");
  return { data };
}

export async function deleteChatChannel(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  if (!(await verifyStaff(supabase, user.id))) {
    return { error: "Kanal silme yetkiniz yok." };
  }

  const { error } = await (supabase
    .from("chat_channels") as any)
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/chat");
  return { success: true };
}

// MESSAGES ACTIONS
export async function getTeamChatMessages(channelId: string) {
  if (!channelId) return { data: [] };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  if (!(await verifyStaff(supabase, user.id))) {
    return { error: "Bu sohbete erişim yetkiniz yok." };
  }

  const { data, error } = await (supabase
    .from("team_chat") as any)
    .select(`
      *,
      sender:profiles!sender_id (id, full_name, email, avatar_url, role)
    `)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { error: error.message };

  // Return messages in chronological order (oldest first for display)
  return { data: (data || []).reverse() };
}

export async function sendTeamChatMessage(data: {
  channelId: string;
  message?: string;
  mediaUrl?: string;
  isPoll?: boolean;
  pollQuestion?: string;
  pollOptions?: any[];
}) {
  if (!data.message && !data.mediaUrl && !data.isPoll) {
    return { error: "Boş mesaj gönderilemez." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  if (!(await verifyStaff(supabase, user.id))) {
    return { error: "Mesaj gönderme yetkiniz yok." };
  }

  const { data: newMessage, error } = await (supabase
    .from("team_chat") as any)
    .insert({
      channel_id: data.channelId,
      sender_id: user.id,
      message: data.message || null,
      media_url: data.mediaUrl || null,
      is_poll: data.isPoll || false,
      poll_question: data.pollQuestion || null,
      poll_options: data.pollOptions || [],
    })
    .select(`
      *,
      sender:profiles!sender_id (id, full_name, email, avatar_url, role)
    `)
    .single();

  if (error) return { error: error.message };

  // Notify other team members
  try {
    const { data: profiles } = await supabase.from("profiles").select("id");
    if (profiles) {
      const notificationsToInsert = (profiles as any[])
        .filter((p) => p.id !== user.id)
        .map((p) => ({
          user_id: p.id,
          title: "Yeni Sohbet Mesajı",
          message: `${newMessage.sender?.full_name || 'Bir ekip üyesi'}: ${data.message || 'Bir dosya gönderdi'}`,
          type: "info",
          action_url: `/chat?channel=${data.channelId}`,
        }));
      if (notificationsToInsert.length > 0) {
        await supabase.from("notifications").insert(notificationsToInsert as any);
      }
    }
  } catch (notifErr) {
    console.error("Failed to insert chat notifications:", notifErr);
  }

  revalidatePath("/chat");
  return { data: newMessage };
}

// POLL ACTION
export async function votePoll(messageId: string, optionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Kimlik doğrulaması gerekiyor." };

  if (!(await verifyStaff(supabase, user.id))) {
    return { error: "Oy verme yetkiniz yok." };
  }

  // 1. Fetch message
  const { data: msg, error: fetchError } = await (supabase
    .from("team_chat") as any)
    .select("*")
    .eq("id", messageId)
    .single();

  if (fetchError || !msg) {
    return { error: fetchError?.message || "Mesaj bulunamadı." };
  }

  if (!msg.is_poll) {
    return { error: "Bu bir anket mesajı değil." };
  }

  // 2. Modify options
  let options = msg.poll_options || [];
  options = options.map((opt: any) => {
    let votes = opt.votes || [];
    if (opt.id === optionId) {
      if (votes.includes(user.id)) {
        // Toggle vote off
        votes = votes.filter((v: string) => v !== user.id);
      } else {
        // Vote for this option
        votes = [...votes, user.id];
      }
    } else {
      // Remove vote from other options (single choice constraint)
      votes = votes.filter((v: string) => v !== user.id);
    }
    return { ...opt, votes };
  });

  // 3. Update in database using admin client
  const adminSupabase = createAdminClient();
  const { data: updatedMsg, error: updateError } = await (adminSupabase
    .from("team_chat") as any)
    .update({ poll_options: options })
    .eq("id", messageId)
    .select(`
      *,
      sender:profiles!sender_id (id, full_name, email, avatar_url, role)
    `)
    .single();

  if (updateError) return { error: updateError.message };

  revalidatePath("/chat");
  return { data: updatedMsg };
}
