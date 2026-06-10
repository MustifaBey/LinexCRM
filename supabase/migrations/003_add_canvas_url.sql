-- Add canvas_url column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS canvas_url TEXT;
