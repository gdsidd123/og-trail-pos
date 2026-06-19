import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.106.2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('CUSTOMER_WEB_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

export function supabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function getTableForToken(token: unknown) {
  if (typeof token !== 'string' || token.trim().length < 32) {
    return { error: 'Invalid QR token', tableId: null as string | null };
  }

  const supabase = supabaseAdmin();
  const tokenHash = await sha256Hex(token.trim());
  const { data, error } = await supabase
    .from('table_qr_tokens')
    .select('table_id')
    .eq('token_hash', tokenHash)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!data?.table_id) {
    return { error: 'Invalid or expired QR token', tableId: null as string | null };
  }

  return { error: null, tableId: String(data.table_id) };
}
