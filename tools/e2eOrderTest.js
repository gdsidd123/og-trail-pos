require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  try {
    console.log('1) Fetching tables...');
    // Some schemas may not have a `status` column on tables; select id,name only
    const { data: tables, error: tErr } = await supabase.from('tables').select('id, name').order('id', { ascending: true }).limit(10);
    if (tErr) throw tErr;
    if (!tables || tables.length === 0) {
      console.error('No tables found in `tables` table. Aborting.');
      process.exit(1);
    }
    const table = tables.find((t) => (t.status || '').toLowerCase() === 'available') || tables[0];
    console.log('Selected table:', table);

    console.log('2) Fetching categories...');
    const { data: cats, error: cErr } = await supabase.from('categories').select('id, name').order('id');
    if (cErr) throw cErr;
    if (!cats || cats.length === 0) {
      console.error('No categories found in `categories` table. Aborting.');
      process.exit(1);
    }
    const category = cats[0];
    console.log('Selected category:', category);

    console.log('3) Fetching menu items (trying common table names)...');
    const itemTables = ['menu_items', 'items', 'products'];
    let items = null;
    let foundTable = null;
    for (const tbl of itemTables) {
      const { data, error } = await supabase.from(tbl).select('id, name, price, category_id').eq('category_id', category.id).limit(10);
      if (!error && data && data.length > 0) {
        items = data;
        foundTable = tbl;
        break;
      }
    }
    if (!items || items.length === 0) {
      console.error('No items found in candidate item tables for selected category. Aborting.');
      process.exit(1);
    }
    console.log('Found items from table:', foundTable, 'sample item:', items[0]);

    // Simulate UI actions
    console.log('4) Simulating add/increase/decrease/remove flows in memory...');
    const cart = [];
    function addItem(it) {
      const ex = cart.find((c) => c.id === it.id);
      if (ex) ex.quantity++;
      else cart.push({ id: it.id, name: it.name, price: Number(it.price), quantity: 1 });
    }
    function increase(id) { const it = cart.find((c) => c.id === id); if (it) it.quantity++; }
    function decrease(id) { const it = cart.find((c) => c.id === id); if (it) it.quantity = Math.max(1, it.quantity - 1); }
    function remove(id) { const idx = cart.findIndex((c) => c.id === id); if (idx !== -1) cart.splice(idx,1); }

    // Add first item
    addItem(items[0]);
    console.log('Added item:', cart);
    // Increase quantity
    increase(items[0].id);
    console.log('Increased qty:', cart);
    // Decrease quantity
    decrease(items[0].id);
    console.log('Decreased qty:', cart);
    // Add second item if exists
    if (items[1]) {
      addItem(items[1]);
      console.log('Added second item:', cart);
    }
    // Remove first item
    remove(items[0].id);
    console.log('After removing first item:', cart);

    // Final cart should persist (we will save current cart). Ensure not empty
    if (cart.length === 0) {
      console.log('Cart empty after remove; adding one item to save');
      addItem(items[0] || items[1]);
    }

    const subtotal = cart.reduce((s, it) => s + it.price * it.quantity, 0);
    console.log('Final cart to save:', cart, 'subtotal:', subtotal.toFixed(2));

    console.log('5) Attempting to insert order using common status candidates (to match enum)');
    const candidates = ['held','pending','open','new','active','created','draft','placed','completed','closed'];
    let orderData = null;
    let lastErr = null;
    for (const cand of candidates) {
      try {
        const { data, error } = await supabase.from('orders').insert({ table_id: table.id, status: cand, subtotal }).select().single();
        if (error) {
          lastErr = error;
          continue;
        }
        orderData = data;
        console.log('Order created with status', cand);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!orderData) {
      console.error('Failed to create order with candidate statuses. Last error:', lastErr && (lastErr.message || lastErr));
      process.exit(1);
    }

    const orderId = orderData.id;
    console.log('6) Inserting order items with candidate field mappings...');
    const candidateMappings = [
      { itemField: 'item_id', qtyField: 'quantity' },
      { itemField: 'product_id', qtyField: 'quantity' },
      { itemField: 'menu_item_id', qtyField: 'quantity' },
      { itemField: 'item_id', qtyField: 'qty' },
      { itemField: 'product_id', qtyField: 'qty' },
    ];
    let oiData = null;
    let oiLastErr = null;
    for (const map of candidateMappings) {
      try {
        // Try minimal payload first (no price/name)
        const minimal = cart.map((it) => ({ order_id: orderId, [map.itemField]: it.id, [map.qtyField]: it.quantity }));
        let res = await supabase.from('order_items').insert(minimal).select();
        if (res.error) {
          // try extended payload
          const extended = cart.map((it) => ({ order_id: orderId, [map.itemField]: it.id, name: it.name, unit_price: it.price, [map.qtyField]: it.quantity }));
          res = await supabase.from('order_items').insert(extended).select();
        }
        if (res.error) {
          oiLastErr = res.error;
          continue;
        }
        oiData = res.data;
        console.log('Order items inserted using mapping:', map);
        break;
      } catch (e) {
        oiLastErr = e;
      }
    }
    if (!oiData) {
      console.error('Failed to insert order_items. Last error:', oiLastErr && (oiLastErr.message || oiLastErr));
      process.exit(1);
    }
    console.log('Order items inserted:', oiData);

    console.log('\nE2E test completed successfully. Created records:');
    console.log('orders:', orderData);
    console.log('order_items:', oiData);

  } catch (err) {
    console.error('E2E test failed:', err.message || err);
    process.exit(1);
  }
}

run().then(() => process.exit(0));
