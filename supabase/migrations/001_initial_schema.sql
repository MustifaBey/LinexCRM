-- ============================================================
-- LinexCRM — Complete Supabase Schema
-- Run this SQL in your Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'client'
    CHECK (role IN ('owner', 'admin', 'member', 'client')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- 2. CLIENTS
-- ============================================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  company TEXT,
  logo_url TEXT,
  notes TEXT,
  portal_user_id UUID REFERENCES public.profiles(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_portal_user ON public.clients(portal_user_id);
CREATE INDEX idx_clients_created_by ON public.clients(created_by);

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency staff can view all clients"
  ON public.clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Admins can insert clients"
  ON public.clients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update clients"
  ON public.clients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete clients"
  ON public.clients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Clients can view own record"
  ON public.clients FOR SELECT
  USING (portal_user_id = auth.uid());

-- ============================================================
-- 3. PROJECTS
-- ============================================================
CREATE TYPE public.project_status AS ENUM (
  'planning', 'active', 'paused', 'completed', 'archived'
);

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  status public.project_status NOT NULL DEFAULT 'planning',
  start_date DATE,
  end_date DATE,
  budget NUMERIC(12, 2),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  image_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_client ON public.projects(client_id);
CREATE INDEX idx_projects_status ON public.projects(status);

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency staff can view all projects"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Admins can insert projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update projects"
  ON public.projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete projects"
  ON public.projects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Clients can view own projects"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = projects.client_id
        AND clients.portal_user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. PROJECT MEMBERS
-- ============================================================
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('lead', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON public.project_members(project_id);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency staff can view project members"
  ON public.project_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Admins can manage project members"
  ON public.project_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 5. KANBAN COLUMNS
-- ============================================================
CREATE TABLE public.kanban_columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#800020',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kanban_columns_project ON public.kanban_columns(project_id);

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency staff can view kanban columns"
  ON public.kanban_columns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Agency staff can insert kanban columns"
  ON public.kanban_columns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Agency staff can update kanban columns"
  ON public.kanban_columns FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Agency staff can delete kanban columns"
  ON public.kanban_columns FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 6. TASKS (Kanban cards)
-- ============================================================
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES public.kanban_columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  position INTEGER NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES public.profiles(id),
  due_date DATE,
  start_date DATE,
  estimated_hours NUMERIC(6, 2),
  labels TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_column ON public.tasks(column_id);
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency staff can view tasks"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Agency staff can insert tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Agency staff can update tasks"
  ON public.tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Agency staff can delete tasks"
  ON public.tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Clients can view own project tasks"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.projects p ON p.client_id = c.id
      WHERE p.id = tasks.project_id
        AND c.portal_user_id = auth.uid()
    )
  );

-- ============================================================
-- 7. MEDIA FILES (Media Vault)
-- ============================================================
CREATE TYPE public.media_status AS ENUM (
  'uploaded', 'in_review', 'approved', 'rejected'
);

CREATE TABLE public.media_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  parent_file_id UUID REFERENCES public.media_files(id),
  status public.media_status NOT NULL DEFAULT 'uploaded',
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_project ON public.media_files(project_id);
CREATE INDEX idx_media_parent ON public.media_files(parent_file_id);
CREATE INDEX idx_media_status ON public.media_files(status);

CREATE TRIGGER update_media_files_updated_at
  BEFORE UPDATE ON public.media_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency staff can view media"
  ON public.media_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Agency staff can insert media"
  ON public.media_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Agency staff can update media"
  ON public.media_files FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Agency staff can delete media"
  ON public.media_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Clients can view own project media"
  ON public.media_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.projects p ON p.client_id = c.id
      WHERE p.id = media_files.project_id
        AND c.portal_user_id = auth.uid()
    )
  );

-- ============================================================
-- 8. MEDIA ANNOTATIONS
-- ============================================================
CREATE TABLE public.media_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  media_file_id UUID NOT NULL REFERENCES public.media_files(id) ON DELETE CASCADE,
  x_percent NUMERIC(5, 2) NOT NULL,
  y_percent NUMERIC(5, 2) NOT NULL,
  comment TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_annotations_media ON public.media_annotations(media_file_id);

CREATE TRIGGER update_media_annotations_updated_at
  BEFORE UPDATE ON public.media_annotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.media_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view annotations"
  ON public.media_annotations FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create annotations"
  ON public.media_annotations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own annotations"
  ON public.media_annotations FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Admins can delete any annotation"
  ON public.media_annotations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 9. DOMAIN RECORDS
-- ============================================================
CREATE TYPE public.service_type AS ENUM ('domain', 'hosting', 'ssl', 'email');

CREATE TABLE public.domain_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_type public.service_type NOT NULL DEFAULT 'domain',
  domain_name TEXT NOT NULL,
  provider TEXT,
  registration_date DATE,
  expiration_date DATE NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  annual_cost NUMERIC(10, 2),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_domains_client ON public.domain_records(client_id);
CREATE INDEX idx_domains_expiration ON public.domain_records(expiration_date);

CREATE TRIGGER update_domain_records_updated_at
  BEFORE UPDATE ON public.domain_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.domain_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency staff can view domain records"
  ON public.domain_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Admins can insert domain records"
  ON public.domain_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update domain records"
  ON public.domain_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete domain records"
  ON public.domain_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 10. VAULT CREDENTIALS (Encrypted)
-- ============================================================
CREATE TYPE public.credential_type AS ENUM (
  'cpanel', 'wordpress', 'ftp', 'vercel', 'hosting',
  'domain_registrar', 'email', 'social_media', 'other'
);

CREATE TABLE public.vault_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  credential_type public.credential_type NOT NULL DEFAULT 'other',
  url TEXT,
  username_encrypted TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  notes_encrypted TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vault_client ON public.vault_credentials(client_id);

CREATE TRIGGER update_vault_credentials_updated_at
  BEFORE UPDATE ON public.vault_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.vault_credentials ENABLE ROW LEVEL SECURITY;

-- STRICT: Only owner and admin can access vault
CREATE POLICY "Only admins can view vault"
  ON public.vault_credentials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Only admins can insert vault"
  ON public.vault_credentials FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Only admins can update vault"
  ON public.vault_credentials FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Only admins can delete vault"
  ON public.vault_credentials FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 11. TRANSACTIONS (Finance)
-- ============================================================
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');
CREATE TYPE public.transaction_category AS ENUM (
  'project_payment', 'retainer', 'consultation',
  'hosting', 'domain', 'software', 'salary',
  'marketing', 'office', 'tax', 'other'
);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type public.transaction_type NOT NULL,
  category public.transaction_category NOT NULL DEFAULT 'other',
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_interval TEXT CHECK (
    recurring_interval IS NULL OR recurring_interval IN ('monthly', 'quarterly', 'yearly')
  ),
  invoice_number TEXT,
  receipt_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX idx_transactions_client ON public.transactions(client_id);

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency staff can view transactions"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Admins can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update transactions"
  ON public.transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete transactions"
  ON public.transactions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 12. INVOICES
-- ============================================================
CREATE TYPE public.invoice_status AS ENUM (
  'draft', 'sent', 'paid', 'overdue', 'cancelled'
);

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  due_date DATE NOT NULL,
  paid_date DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency staff can view invoices"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Admins can insert invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update invoices"
  ON public.invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete invoices"
  ON public.invoices FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Clients can view own invoices"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = invoices.client_id
        AND clients.portal_user_id = auth.uid()
    )
  );

-- ============================================================
-- 13. ACTIVITY LOG
-- ============================================================
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_user ON public.activity_log(user_id);
CREATE INDEX idx_activity_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_created ON public.activity_log(created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency staff can view activity log"
  ON public.activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Authenticated users can insert activity log"
  ON public.activity_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 14. NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info'
    CHECK (type IN ('info', 'warning', 'error', 'success')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read)
  WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_annotations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
