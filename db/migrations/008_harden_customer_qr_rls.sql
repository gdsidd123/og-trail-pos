-- RLS hardening for public customer QR web ordering.
-- Run only after the Edge Function based customer web flow has been tested.
-- This removes anonymous direct table/menu reads and anonymous/customer direct order writes.

DROP POLICY IF EXISTS tables_read_all ON public.tables;
DROP POLICY IF EXISTS tables_read_authenticated ON public.tables;
CREATE POLICY tables_read_authenticated
ON public.tables
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS categories_read_all ON public.categories;
DROP POLICY IF EXISTS categories_read_authenticated ON public.categories;
CREATE POLICY categories_read_authenticated
ON public.categories
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS menu_items_read_all ON public.menu_items;
DROP POLICY IF EXISTS menu_items_read_authenticated ON public.menu_items;
CREATE POLICY menu_items_read_authenticated
ON public.menu_items
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS orders_select_guest_active ON public.orders;
DROP POLICY IF EXISTS orders_select_staff ON public.orders;
DROP POLICY IF EXISTS orders_insert_guest ON public.orders;
DROP POLICY IF EXISTS orders_insert_staff_customer ON public.orders;
DROP POLICY IF EXISTS orders_update_staff ON public.orders;

CREATE POLICY orders_select_staff
ON public.orders
FOR SELECT
TO authenticated
USING (public.has_app_role(ARRAY['owner', 'manager', 'cashier', 'server', 'kitchen']));

CREATE POLICY orders_insert_staff
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (public.has_app_role(ARRAY['owner', 'manager', 'server']));

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

CREATE POLICY order_items_insert_staff
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (public.has_app_role(ARRAY['owner', 'manager', 'server']));

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
