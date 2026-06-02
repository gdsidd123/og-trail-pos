-- Add missing payments columns for billing support
ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;
