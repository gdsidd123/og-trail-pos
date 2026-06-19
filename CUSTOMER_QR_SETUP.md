# Customer QR Ordering Setup

This flow uses a separate customer web app and Supabase Edge Functions. The web app never writes directly to `orders` or `order_items`.

## 1. Run the token migration

Run `db/migrations/007_customer_qr_tokens.sql` in the Supabase SQL editor.

Do not run `008_harden_customer_qr_rls.sql` yet. Run it only after the customer web flow is tested.

## 2. Generate table tokens

In Supabase SQL editor, generate one active raw token per table:

```sql
select
  id::text as table_id,
  name as table_name,
  public.rotate_table_qr_token(id::text) as raw_token
from public.tables
order by name;
```

Copy the `raw_token` values immediately. Supabase stores only the hash, so the raw tokens cannot be recovered later. If a token is lost or leaked, run `public.rotate_table_qr_token('<table-id>')` for that table and print a new QR.

## 3. Deploy Edge Functions

Set these Supabase function secrets:

```bash
supabase secrets set CUSTOMER_WEB_ORIGIN=https://order.your-domain.com
```

Deploy functions without JWT verification:

```bash
supabase functions deploy customer_bootstrap --no-verify-jwt
supabase functions deploy customer_submit_order --no-verify-jwt
```

The functions use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, which Supabase provides in the Edge Function runtime.

## 4. Run customer web app locally

```bash
cd customer-web
copy .env.example .env
```

Set:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
```

Install and run:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173/t/<raw-token>
```

## 5. Deploy customer web app to Vercel

Use `customer-web` as the Vercel project root.

Environment variable:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
```

Production QR URL format:

```text
https://order.your-domain.com/t/<raw-token>
```

## 6. Generate printable QR page

Create `customer-qr-tokens.json` in the app folder:

```json
[
  { "tableName": "Table 1", "url": "https://order.your-domain.com/t/raw-token-for-table-1" },
  { "tableName": "Table 2", "url": "https://order.your-domain.com/t/raw-token-for-table-2" }
]
```

Generate printable HTML:

```bash
node tools/generateCustomerQrPrintHtml.js customer-qr-tokens.json outputs/customer-qr-codes.html
```

Open `outputs/customer-qr-codes.html` and print.

## 7. Test before hardening RLS

- Valid token opens the correct table menu.
- Random token shows invalid QR.
- Submit items and confirm KOT receives them.
- Staff opens the same table and sees the customer items.
- Mark one menu item unavailable and confirm customer submit rejects it.

## 8. Harden RLS

After tests pass, run `db/migrations/008_harden_customer_qr_rls.sql`.

Then verify anonymous direct inserts fail:

- `orders` insert as anon should fail.
- `order_items` insert as anon should fail.
- Customer web still works through Edge Functions.
