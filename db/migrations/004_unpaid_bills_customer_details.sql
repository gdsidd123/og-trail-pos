-- Unpaid bills and customer contact details.
-- Run this in Supabase SQL editor before testing billed/unpaid flows.

ALTER TYPE public.order_status
  ADD VALUE IF NOT EXISTS 'billed';

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS billed_at timestamptz;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('open', 'held', 'billed', 'paid', 'cancelled'));
