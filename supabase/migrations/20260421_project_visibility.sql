-- Add visibility column to projects table
-- 'public' = all authenticated users can see (default)
-- 'team' = only project members can see
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'team'));
