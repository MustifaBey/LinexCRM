-- ============================================================
-- Enterprise Modules Migration
-- ============================================================

-- 1. Pipeline status column in clients
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS pipeline_status TEXT DEFAULT 'lead' 
  CHECK (pipeline_status IN ('lead', 'contacted', 'proposal', 'won', 'lost'));

CREATE INDEX IF NOT EXISTS idx_clients_pipeline_status ON public.clients(pipeline_status);

-- 2. Media Shares Table
CREATE TABLE IF NOT EXISTS public.media_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES public.media_files(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_shares_token ON public.media_shares(token);

ALTER TABLE public.media_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view a media share with token"
  ON public.media_shares FOR SELECT
  USING (true);

CREATE POLICY "Agency staff can manage media shares"
  ON public.media_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

-- 3. Content Posts Table
CREATE TABLE IF NOT EXISTS public.content_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  publish_date TIMESTAMPTZ NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published')),
  image_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_posts_project ON public.content_posts(project_id);
CREATE INDEX IF NOT EXISTS idx_content_posts_publish_date ON public.content_posts(publish_date);

CREATE TRIGGER update_content_posts_updated_at
  BEFORE UPDATE ON public.content_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency staff can view all content posts"
  ON public.content_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Clients can view own project content posts"
  ON public.content_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.projects p ON p.client_id = c.id
      WHERE p.id = content_posts.project_id
        AND c.portal_user_id = auth.uid()
    )
  );

CREATE POLICY "Agency staff can manage content posts"
  ON public.content_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

-- 4. Tickets Table
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_project ON public.tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency staff can view all tickets"
  ON public.tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Clients can view own project tickets"
  ON public.tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.projects p ON p.client_id = c.id
      WHERE p.id = tickets.project_id
        AND c.portal_user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create tickets"
  ON public.tickets FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Agency staff can update all tickets"
  ON public.tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Users can update own tickets"
  ON public.tickets FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Agency staff can delete tickets"
  ON public.tickets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );
