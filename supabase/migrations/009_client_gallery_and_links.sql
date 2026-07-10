-- ============================================================
-- 009_client_gallery_and_links.sql
-- Upgrades Clients & Media Files for Centralized Hub
-- ============================================================

-- 1. Add nullable external links to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS maps_url TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS website_url TEXT;

-- 2. Add client_id to media_files table
ALTER TABLE public.media_files ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- 3. Make project_id nullable in media_files table
ALTER TABLE public.media_files ALTER COLUMN project_id DROP NOT NULL;

-- 4. Create index for client_id on media_files
CREATE INDEX IF NOT EXISTS idx_media_files_client ON public.media_files(client_id);

-- 5. Add RLS policy for clients to view media files directly linked to their profile
CREATE POLICY "Clients can view own client media" ON public.media_files
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM public.clients WHERE portal_user_id = auth.uid()
    )
  );
