-- Migration: Create public.integrated_apps Table
-- This table persists the external apps added by agency staff.

CREATE TABLE IF NOT EXISTS public.integrated_apps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.integrated_apps ENABLE ROW LEVEL SECURITY;

-- Select policy: all authenticated users can view apps
CREATE POLICY "Anyone authenticated can view integrated apps" ON public.integrated_apps
  FOR SELECT USING (auth.role() = 'authenticated');

-- Insert/Delete policies: staff only (owner, admin, member)
CREATE POLICY "Staff can insert integrated apps" ON public.integrated_apps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Staff can delete integrated apps" ON public.integrated_apps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

-- Seed with initial default apps
INSERT INTO public.integrated_apps (name, url) VALUES
  ('SEO Araçları', 'https://seocu.com'),
  ('ChatGPT', 'https://chatgpt.com'),
  ('Canva', 'https://www.canva.com'),
  ('Müşteri İletişimi', 'https://web.whatsapp.com');
