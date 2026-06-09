-- Customer QR ordering and kitchen KOT support.
-- Run this in Supabase SQL editor before testing customer/KOT flows.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'manager', 'cashier', 'server', 'customer', 'kitchen'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.phone),
    'customer',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.phone, NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

ALTER TABLE IF EXISTS public.order_items
  ADD COLUMN IF NOT EXISTS kot_status text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS kot_submitted_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS kot_preparing_at timestamptz,
  ADD COLUMN IF NOT EXISTS kot_done_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_role text,
  ADD COLUMN IF NOT EXISTS source_user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_kot_status_check;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_kot_status_check
  CHECK (kot_status IN ('submitted', 'preparing', 'done'));

CREATE INDEX IF NOT EXISTS idx_order_items_kot_status_submitted_at
  ON public.order_items(kot_status, kot_submitted_at);
