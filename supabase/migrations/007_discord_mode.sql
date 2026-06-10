-- ============================================================
-- 007_discord_mode.sql
-- Upgrades Team Chat to support Channels and Interactive Polls
-- ============================================================

-- 1. Create chat_channels table
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Insert default channel
INSERT INTO public.chat_channels (name) 
VALUES ('genel-sohbet')
ON CONFLICT (name) DO NOTHING;

-- 3. Alter team_chat table to add channel_id, is_poll, poll_question, poll_options
ALTER TABLE public.team_chat ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE;
ALTER TABLE public.team_chat ADD COLUMN IF NOT EXISTS is_poll BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.team_chat ADD COLUMN IF NOT EXISTS poll_question TEXT;
ALTER TABLE public.team_chat ADD COLUMN IF NOT EXISTS poll_options JSONB DEFAULT '[]'::jsonb;

-- 4. Update existing team_chat messages to use the default channel
UPDATE public.team_chat 
SET channel_id = (SELECT id FROM public.chat_channels WHERE name = 'genel-sohbet' LIMIT 1)
WHERE channel_id IS NULL;

-- 5. Create index for channel_id
CREATE INDEX IF NOT EXISTS idx_team_chat_channel ON public.team_chat(channel_id);

-- 6. Enable RLS on chat_channels
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for chat_channels
CREATE POLICY "Staff can view chat channels" ON public.chat_channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Staff can manage chat channels" ON public.chat_channels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

-- 8. Add chat_channels to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;
