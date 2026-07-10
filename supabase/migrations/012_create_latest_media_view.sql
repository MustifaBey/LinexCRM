-- ============================================================
-- 012_create_latest_media_view.sql
-- Creates latest_media_files view for pagination performance
-- ============================================================

CREATE OR REPLACE VIEW public.latest_media_files AS
SELECT f.*
FROM public.media_files f
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.media_files other 
  WHERE other.parent_file_id = f.id
);
