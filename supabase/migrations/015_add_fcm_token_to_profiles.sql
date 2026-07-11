-- 015_add_fcm_token_to_profiles.sql
-- Adds fcm_token column to profiles table to store users' FCM device tokens

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;
