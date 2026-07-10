-- ============================================================
-- 010_notification_volume_and_media_refactor.sql
-- Upgrades Profiles for Notification Sound Volume Slider
-- ============================================================

-- 1. Add sound_volume to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sound_volume INTEGER DEFAULT 75 CHECK (sound_volume >= 0 AND sound_volume <= 100);
