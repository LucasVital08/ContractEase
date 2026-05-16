-- Add settings JSONB column to profiles for user preferences
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';
