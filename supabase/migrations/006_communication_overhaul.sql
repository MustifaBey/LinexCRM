-- ============================================================
-- 006_communication_overhaul.sql
-- Run this migration to setup Tickets & Realtime Team Chat
-- ============================================================

-- 1. Drop existing tickets table if it exists (CASCADE drops dependent views/policies)
DROP TABLE IF EXISTS public.tickets CASCADE;

-- 2. Create tickets Table
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create ticket_messages Table
CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_staff BOOLEAN NOT NULL DEFAULT false,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create team_chat Table
CREATE TABLE public.team_chat (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_client ON public.tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender ON public.ticket_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_team_chat_sender ON public.team_chat(sender_id);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for tickets
CREATE POLICY "Staff can view all tickets" ON public.tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Staff can manage all tickets" ON public.tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Clients can view own tickets" ON public.tickets
  FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "Clients can insert own tickets" ON public.tickets
  FOR INSERT WITH CHECK (client_id = auth.uid());

-- 8. RLS Policies for ticket_messages
CREATE POLICY "Staff can view all ticket messages" ON public.ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Staff can insert ticket messages" ON public.ticket_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ) AND sender_id = auth.uid()
  );

CREATE POLICY "Clients can view own ticket messages" ON public.ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_messages.ticket_id AND client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can insert own ticket messages" ON public.ticket_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_messages.ticket_id AND client_id = auth.uid()
    ) AND sender_id = auth.uid()
  );

-- 9. RLS Policies for team_chat (Staff Only)
CREATE POLICY "Staff can view team chat" ON public.team_chat
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Staff can insert team chat" ON public.team_chat
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ) AND sender_id = auth.uid()
  );

-- 10. Enable Supabase Realtime (Alter Publication)
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;

-- 11. Storage Bucket and Policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_media', 'chat_media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public select on chat_media" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat_media');

CREATE POLICY "Allow staff insert on chat_media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat_media' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Allow staff delete on chat_media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat_media' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );
