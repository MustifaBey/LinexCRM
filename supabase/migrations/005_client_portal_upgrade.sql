-- ============================================================
-- Client Portal Upgrade Row-Level Security (RLS) Policies
-- ============================================================

-- 1. SELECT policies for domain_records
CREATE POLICY "Clients can view own domain records"
  ON public.domain_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = domain_records.client_id
        AND c.portal_user_id = auth.uid()
    )
  );

-- 2. SELECT policies for vault_credentials
CREATE POLICY "Clients can view own vault credentials"
  ON public.vault_credentials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = vault_credentials.client_id
        AND c.portal_user_id = auth.uid()
    )
  );

-- 3. DROP old annotation creation policies if they were too generic
DROP POLICY IF EXISTS "Authenticated users can create annotations" ON public.media_annotations;

-- 4. INSERT policies for media_annotations for clients
CREATE POLICY "Clients can insert annotations on their project media"
  ON public.media_annotations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.media_files m
      JOIN public.projects p ON m.project_id = p.id
      JOIN public.clients c ON p.client_id = c.id
      WHERE m.id = media_annotations.media_file_id
        AND c.portal_user_id = auth.uid()
    )
  );

-- 5. UPDATE policies for media_annotations for clients
CREATE POLICY "Clients can update annotations on their project media"
  ON public.media_annotations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.media_files m
      JOIN public.projects p ON m.project_id = p.id
      JOIN public.clients c ON p.client_id = c.id
      WHERE m.id = media_annotations.media_file_id
        AND c.portal_user_id = auth.uid()
    )
  );
