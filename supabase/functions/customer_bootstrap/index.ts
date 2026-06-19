import { corsHeaders, errorResponse, getTableForToken, jsonResponse, readJson, supabaseAdmin } from '../_shared/customer.ts';

function normalizePhone(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.replace(/\D/g, '');
}

function maskedPhone(phone?: string | null) {
  const digits = normalizePhone(phone);
  if (digits.length < 4) return null;
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

async function getActiveOrderForTable(supabase: ReturnType<typeof supabaseAdmin>, tableId: string) {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, subtotal, created_at, customer_phone')
    .eq('table_id', tableId)
    .in('status', ['open', 'held'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order?.id) return null;

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('id, name, unit_price, quantity, kot_status, kot_submitted_at')
    .eq('order_id', order.id)
    .order('kot_submitted_at', { ascending: true });
  if (itemsError) throw itemsError;

  const orderItems = items || [];
  const totalQuantity = orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalAmount = orderItems.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0);
  const phone = normalizePhone(order.customer_phone);

  return {
    id: order.id,
    status: order.status,
    totalQuantity,
    totalAmount,
    hasCustomerPhone: phone.length >= 4,
    maskedPhone: phone.length >= 4 ? '**********' : null,
    items: orderItems,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body = await readJson(req);
    const { error: tokenError, tableId } = await getTableForToken(body?.token);
    if (tokenError || !tableId) return errorResponse(tokenError || 'Invalid QR token', 401);

    const supabase = supabaseAdmin();

    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('id, name, capacity, location')
      .eq('id', tableId)
      .maybeSingle();
    if (tableError) throw tableError;
    if (!table) return errorResponse('Table not found', 404);

    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name')
      .order('id');
    if (categoriesError) throw categoriesError;

    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, price, category_id, is_available')
      .eq('is_available', true)
      .order('name');
    if (menuError) throw menuError;

    const activeOrder = await getActiveOrderForTable(supabase, tableId);

    return jsonResponse({
      table: {
        id: String(table.id),
        name: table.name || String(table.id),
        capacity: table.capacity ?? null,
        location: table.location ?? null,
      },
      categories: categories || [],
      menuItems: menuItems || [],
      activeOrder,
    });
  } catch (err) {
    console.error(err);
    return errorResponse('Unable to load ordering menu', 500);
  }
});

