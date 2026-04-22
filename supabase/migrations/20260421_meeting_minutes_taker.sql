-- Add minutes_taker_id column to meetings table
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS minutes_taker_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
