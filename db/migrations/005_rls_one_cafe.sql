-- One-cafe RLS policies for current POS flows.
-- Run after core order, guest customer, KOT, billing, and unpaid bill flows are tested.
--
-- Note: guest customer ordering is still anonymous in the current app. These policies
-- allow limited anonymous table/menu reads and customer order submission. For public
-- production use, replace anonymous writes with a Supabase Edge Function.

CREATE OR REPLACE FUNCTION public.app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_app_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.app_role() = ANY(allowed_roles), false)
$$;

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_self_or_owner ON public.profiles;
DROP POLICY IF EXISTS profiles_update_owner ON public.profiles;

CREATE POLICY profiles_select_self_or_owner
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.app_role() = 'owner');

CREATE POLICY profiles_update_owner
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.app_role() = 'owner')
WITH CHECK (public.app_role() = 'owner');

DROP POLICY IF EXISTS tables_read_all ON public.tables;
DROP POLICY IF EXISTS tables_write_manager_owner ON public.tables;

CREATE POLICY tables_read_all
ON public.tables
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY tables_write_manager_owner
ON public.tables
FOR ALL
TO authenticated
USING (public.has_app_role(ARRAY['owner', 'manager']))
WITH CHECK (public.has_app_role(ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS categories_read_all ON public.categories;
DROP POLICY IF EXISTS categories_write_manager_owner ON public.categories;

CREATE POLICY categories_read_all
ON public.categories
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY categories_write_manager_owner
ON public.categories
FOR ALL
TO authenticated
USING (public.has_app_role(ARRAY['owner', 'manager']))
WITH CHECK (public.has_app_role(ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS menu_items_read_all ON public.menu_items;
DROP POLICY IF EXISTS menu_items_write_manager_owner ON public.menu_items;

CREATE POLICY menu_items_read_all
ON public.menu_items
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY menu_items_write_manager_owner
ON public.menu_items
FOR ALL
TO authenticated
USING (public.has_app_role(ARRAY['owner', 'manager']))
WITH CHECK (public.has_app_role(ARRAY['owner', 'manager']));

DROP POLICY IF EXISTS orders_select_guest_active ON public.orders;
DROP POLICY IF EXISTS orders_select_staff ON public.orders;
DROP POLICY IF EXISTS orders_insert_guest ON public.orders;
DROP POLICY IF EXISTS orders_insert_staff_customer ON public.orders;
DROP POLICY IF EXISTS orders_update_staff ON public.orders;

CREATE POLICY orders_select_guest_active
ON public.orders
FOR SELECT
TO anon
USING (status IN ('open', 'held'));

CREATE POLICY orders_select_staff
ON public.orders
FOR SELECT
TO authenticated
USING (
  public.has_app_role(ARRAY['owner', 'manager', 'cashier', 'server', 'kitchen'])
  OR (public.app_role() = 'customer' AND status IN ('open', 'held'))
);

CREATE POLICY orders_insert_guest
ON public.orders
FOR INSERT
TO anon
WITH CHECK (status = 'open');

CREATE POLICY orders_insert_staff_customer
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_app_role(ARRAY['owner', 'manager', 'server'])
  OR (public.app_role() = 'customer' AND status = 'open')
);

CREATE POLICY orders_update_staff
ON public.orders
FOR UPDATE
TO authenticated
USING (public.has_app_role(ARRAY['owner', 'manager', 'cashier', 'server']))
WITH CHECK (public.has_app_role(ARRAY['owner', 'manager', 'cashier', 'server']));

DROP POLICY IF EXISTS order_items_select_staff ON public.order_items;
DROP POLICY IF EXISTS order_items_insert_guest_customer ON public.order_items;
DROP POLICY IF EXISTS order_items_insert_staff ON public.order_items;
DROP POLICY IF EXISTS order_items_update_kitchen_staff ON public.order_items;
DROP POLICY IF EXISTS order_items_delete_staff ON public.order_items;

CREATE POLICY order_items_select_staff
ON public.order_items
FOR SELECT
TO authenticated
USING (public.has_app_role(ARRAY['owner', 'manager', 'cashier', 'server', 'kitchen']));

CREATE POLICY order_items_insert_guest_customer
ON public.order_items
FOR INSERT
TO anon
WITH CHECK (
  source_role = 'customer'
  AND source_user_id IS NULL
  AND kot_status = 'submitted'
);

CREATE POLICY order_items_insert_staff
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_app_role(ARRAY['owner', 'manager', 'server'])
  OR (
    public.app_role() = 'customer'
    AND source_role = 'customer'
    AND source_user_id = auth.uid()
    AND kot_status = 'submitted'
  )
);

CREATE POLICY order_items_update_kitchen_staff
ON public.order_items
FOR UPDATE
TO authenticated
USING (public.has_app_role(ARRAY['owner', 'manager', 'server', 'kitchen']))
WITH CHECK (public.has_app_role(ARRAY['owner', 'manager', 'server', 'kitchen']));

CREATE POLICY order_items_delete_staff
ON public.order_items
FOR DELETE
TO authenticated
USING (public.has_app_role(ARRAY['owner', 'manager', 'server']));

DROP POLICY IF EXISTS payments_select_cashier_manager_owner ON public.payments;
DROP POLICY IF EXISTS payments_insert_cashier_manager_owner ON public.payments;
DROP POLICY IF EXISTS payments_update_cashier_manager_owner ON public.payments;

CREATE POLICY payments_select_cashier_manager_owner
ON public.payments
FOR SELECT
TO authenticated
USING (public.has_app_role(ARRAY['owner', 'manager', 'cashier']));

CREATE POLICY payments_insert_cashier_manager_owner
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (public.has_app_role(ARRAY['owner', 'manager', 'cashier']));

CREATE POLICY payments_update_cashier_manager_owner
ON public.payments
FOR UPDATE
TO authenticated
USING (public.has_app_role(ARRAY['owner', 'manager', 'cashier']))
WITH CHECK (public.has_app_role(ARRAY['owner', 'manager', 'cashier']));
