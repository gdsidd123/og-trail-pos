import { corsHeaders, errorResponse, getTableForToken, jsonResponse, readJson, supabaseAdmin } from '../_shared/customer.ts';

type CartInput = {
  menuItemId: string | number;
  quantity: number;
};

function normalizeCart(value: unknown): CartInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      menuItemId: (item as CartInput)?.menuItemId,
      quantity: Number((item as CartInput)?.quantity),
    }))
    .filter((item) => item.menuItemId != null && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20)
    .slice(0, 50);
}

function normalizePhone(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.replace(/\D/g, '');
}

function normalizeLast4(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.replace(/\D/g, '').slice(-4);
}

function maskedPhone(phone?: string | null) {
  const digits = normalizePhone(phone);
  if (digits.length < 4) return null;
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

async function getActiveOrder(supabase: ReturnType<typeof supabaseAdmin>, tableId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, customer_phone')
    .eq('table_id', tableId)
    .in('status', ['open', 'held'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getOrCreateOrder(
  supabase: ReturnType<typeof supabaseAdmin>,
  tableId: string,
  subtotal: number,
  customerPhone: string,
) {
  const existing = await getActiveOrder(supabase, tableId);
  if (existing?.id) return existing;

  const { data: inserted, error: insertError } = await supabase
    .from('orders')
    .insert({ table_id: tableId, status: 'open', subtotal, customer_phone: customerPhone })
    .select('id, status, customer_phone')
    .single();

  if (!insertError && inserted?.id) return inserted;

  const retry = await getActiveOrder(supabase, tableId);
  if (retry?.id) return retry;

  throw insertError || new Error('Unable to create order');
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

    const cart = normalizeCart(body?.items);
    if (cart.length === 0) return errorResponse('Cart is empty', 400);

    const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQuantity > 50) return errorResponse('Cart has too many items', 400);

    const requestedIds = [...new Set(cart.map((item) => String(item.menuItemId)))];
    const supabase = supabaseAdmin();
    const existingOrder = await getActiveOrder(supabase, tableId);
    const existingPhone = normalizePhone(existingOrder?.customer_phone);
    const customerPhone = normalizePhone(body?.customerPhone);
    const phoneLast4 = normalizeLast4(body?.phoneLast4);

    if (existingPhone) {
      if (phoneLast4.length !== 4 || phoneLast4 !== existingPhone.slice(-4)) {
        return errorResponse('Phone confirmation failed', 403);
      }
    } else if (customerPhone.length < 10) {
      return errorResponse('Enter a valid mobile number before ordering', 400);
    }

    const { data: menuRows, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, price, is_available')
      .in('id', requestedIds)
      .eq('is_available', true);
    if (menuError) throw menuError;

    const menuById = new Map((menuRows || []).map((item) => [String(item.id), item]));
    const invalidItem = requestedIds.find((id) => !menuById.has(id));
    if (invalidItem) return errorResponse('One or more items are unavailable', 400);

    const subtotal = cart.reduce((sum, item) => {
      const menuItem = menuById.get(String(item.menuItemId));
      return sum + Number(menuItem?.price || 0) * item.quantity;
    }, 0);

    const order = await getOrCreateOrder(supabase, tableId, subtotal, customerPhone);
    const orderId = order.id as string;

    if (!existingPhone && customerPhone) {
      const { error: phoneUpdateError } = await supabase
        .from('orders')
        .update({ customer_phone: customerPhone })
        .eq('id', orderId)
        .is('customer_phone', null);
      if (phoneUpdateError) throw phoneUpdateError;
    }

    const now = new Date().toISOString();
    const orderItems = cart.map((item) => {
      const menuItem = menuById.get(String(item.menuItemId));
      return {
        order_id: orderId,
        menu_item_id: menuItem?.id,
        name: menuItem?.name,
        unit_price: Number(menuItem?.price || 0),
        quantity: item.quantity,
        kot_status: 'submitted',
        kot_submitted_at: now,
        source_role: 'customer',
        source_user_id: null,
      };
    });

    const { error: insertItemsError } = await supabase.from('order_items').insert(orderItems);
    if (insertItemsError) throw insertItemsError;

    const { data: allItems, error: allItemsError } = await supabase
      .from('order_items')
      .select('unit_price, quantity')
      .eq('order_id', orderId);
    if (!allItemsError) {
      const updatedSubtotal = (allItems || []).reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0);
      await supabase.from('orders').update({ subtotal: updatedSubtotal }).eq('id', orderId);
    }

    return jsonResponse({
      orderId,
      tableId,
      submittedItems: orderItems.length,
      submittedAt: now,
      maskedPhone: maskedPhone(existingPhone || customerPhone),
    });
  } catch (err) {
    console.error(err);
    return errorResponse('Unable to submit order', 500);
  }
});
