type Category = {
  id: number;
  name: string;
};

type MenuItem = {
  id: number | string;
  name: string;
  price: number;
  category_id: number;
  is_available: boolean;
};

type TableInfo = {
  id: string;
  name: string;
  capacity?: number | null;
  location?: string | null;
};

export type SubmittedOrderItem = {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
  kot_status: 'submitted' | 'preparing' | 'done';
  kot_submitted_at?: string | null;
};

export type ActiveOrder = {
  id: string;
  status: string;
  totalQuantity: number;
  totalAmount: number;
  hasCustomerPhone: boolean;
  maskedPhone: string | null;
  items: SubmittedOrderItem[];
};

export type BootstrapResponse = {
  table: TableInfo;
  categories: Category[];
  menuItems: MenuItem[];
  activeOrder: ActiveOrder | null;
};

export type CartItem = MenuItem & {
  quantity: number;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL');
}

const functionsBaseUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${functionsBaseUrl}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || 'Request failed');
  }

  return data as T;
}

export function customerBootstrap(token: string) {
  return postJson<BootstrapResponse>('customer_bootstrap', { token });
}

export function customerSubmitOrder(token: string, items: CartItem[], phoneProof: { customerPhone?: string; phoneLast4?: string }) {
  return postJson<{ orderId: string; submittedItems: number; submittedAt: string; maskedPhone?: string | null }>('customer_submit_order', {
    token,
    ...phoneProof,
    items: items.map((item) => ({ menuItemId: item.id, quantity: item.quantity })),
  });
}
