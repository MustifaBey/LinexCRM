-- ============================================================
-- 011_add_thumbnail_path_to_media.sql
-- Adds thumbnail_path column to media_files table
-- ============================================================

-- 1. Add thumbnail_path column if it does not exist
ALTER TABLE public.media_files ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;

-- 2. Create index on the thumbnail_path column for potential future queries
CREATE INDEX IF NOT EXISTS idx_media_files_thumbnail ON public.media_files(thumbnail_path);
