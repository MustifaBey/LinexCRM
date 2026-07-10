-- Add status column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Potansiyel';
