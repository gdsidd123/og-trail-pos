import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { useOrderStore } from '../stores/orderStore';

type RouteParams = { tableId?: number | string; tableName?: string };
type Category = { id: number; name: string };
type MenuItem = { id: number; name: string; price: number; category_id?: number };

export default function OrderScreen() {
  const route = useRoute();
  const params = (route.params || {}) as RouteParams;
  const { tableId: paramTableId, tableName: paramTableName } = params;

  const setTable = useOrderStore((s) => s.setTable);
  const items = useOrderStore((s) => s.items);
  const addItem = useOrderStore((s) => s.addItem);
  const increaseQty = useOrderStore((s) => s.increaseQty);
  const decreaseQty = useOrderStore((s) => s.decreaseQty);
  const removeItem = useOrderStore((s) => s.removeItem);
  const subtotal = useOrderStore((s) => s.subtotal);
  const clear = useOrderStore((s) => s.clear);
  const setHeldOrderId = useOrderStore((s) => s.setHeldOrderId);

  const [categories, setCategories] = useState<Category[] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[] | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heldOrders, setHeldOrders] = useState<any[] | null>(null);
  const [loadingHeld, setLoadingHeld] = useState(false);

  useEffect(() => {
    if (paramTableId) setTable(paramTableId, paramTableName);
  }, [paramTableId, paramTableName]);

  useEffect(() => {
    let mounted = true;
    async function fetchCats() {
      setLoadingCategories(true);
      setError(null);
      try {
        const { data, error } = await supabase.from('categories').select('id, name').order('id');
        if (error) throw error;
        if (mounted) setCategories((data as Category[]) || []);
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load categories');
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    }
    fetchCats();
    return () => (mounted = false);
  }, []);

  useEffect(() => {
    if (selectedCategory == null) return;
    let mounted = true;
    async function fetchItems() {
      setLoadingItems(true);
      setError(null);
      try {
        // try common table names for items
        const candidates = ['menu_items', 'items', 'products'];
        let results: any = null;
        for (const tbl of candidates) {
          const { data, error } = await supabase.from(tbl).select('id, name, price, category_id').eq('category_id', selectedCategory);
          if (error) {
            // table might not exist, continue
            continue;
          }
          results = data;
          break;
        }
        if (!results) throw new Error('No items table found or no items for category');
        if (mounted) setMenuItems(results as MenuItem[]);
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load items');
      } finally {
        if (mounted) setLoadingItems(false);
      }
    }
    fetchItems();
    return () => (mounted = false);
  }, [selectedCategory]);

  async function fetchHeldOrders(tableId: number | string) {
    setLoadingHeld(true);
    try {
      const { data, error } = await supabase.from('orders').select('*').eq('table_id', tableId).eq('status', 'held').order('id', { ascending: false });
      if (error) throw error;
      setHeldOrders((data as any[]) || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load held orders');
    } finally {
      setLoadingHeld(false);
    }
  }

  useEffect(() => {
    if (paramTableId) fetchHeldOrders(paramTableId);
  }, [paramTableId]);

  const handleAdd = (item: MenuItem) => {
    addItem({ id: item.id, name: item.name, price: Number(item.price), category_id: item.category_id });
  };

  const handleSaveOrder = async (hold = false) => {
    const stateItems = useOrderStore.getState().items;
    const tableId = useOrderStore.getState().tableId;
    if (!tableId) return Alert.alert('Select table first');
    if (stateItems.length === 0) return Alert.alert('Cart is empty');

    try {
      // create order
      const orderPayload: any = {
        table_id: tableId,
        status: hold ? 'held' : 'open',
        subtotal: subtotal(),
      };
      const { data: orderData, error: orderError } = await supabase.from('orders').insert(orderPayload).select().limit(1).single();
      if (orderError) throw orderError;
      const orderId = orderData?.id;
      // insert order items
      const itemsPayload = stateItems.map((it) => ({ order_id: orderId, menu_item_id: it.id, name: it.name, unit_price: it.price, quantity: it.quantity }));
      const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
      if (itemsError) throw itemsError;
      if (hold) {
        setHeldOrderId(orderId);
        Alert.alert('Order held');
      } else {
        clear();
        Alert.alert('Order saved');
      }
    } catch (err: any) {
      Alert.alert('Save failed', err.message || String(err));
    }
  };

  const handleResume = async (order: any) => {
    try {
      // fetch order items
      const { data, error } = await supabase.from('order_items').select('id, order_id, menu_item_id, name, unit_price, quantity').eq('order_id', order.id);
      if (error) throw error;
      const items = (data as any[]).map((it) => ({ id: it.menu_item_id, name: it.name, price: Number(it.unit_price), quantity: it.quantity }));
      // set store
      clear();
      if (order.table_id) setTable(order.table_id, String(order.table_id));
      items.forEach((it) => useOrderStore.getState().addItem({ id: it.id, name: it.name, price: it.price }));
      // now set quantities properly
      const store = useOrderStore.getState();
      // replace quantities
      store.clear();
      store.setTable(order.table_id, String(order.table_id));
      items.forEach((it) => {
        for (let i = 0; i < it.quantity; i++) store.addItem({ id: it.id, name: it.name, price: it.price });
      });
      setHeldOrderId(order.id);
      Alert.alert('Resumed order');
    } catch (err: any) {
      Alert.alert('Resume failed', err.message || String(err));
    }
  };

  const cartTotal = useMemo(() => subtotal(), [items]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Order</Text>
      <Text style={styles.subheader}>Table: {paramTableName ?? paramTableId ?? 'None'}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categories</Text>
        {loadingCategories ? <ActivityIndicator /> : (
          <FlatList
            horizontal
            data={categories || []}
            keyExtractor={(c) => String(c.id)}
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.catButton, selectedCategory === item.id && styles.catButtonActive]} onPress={() => setSelectedCategory(item.id)}>
                <Text style={styles.catText}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <View style={[styles.section, { flex: 1 }]}> 
        <Text style={styles.sectionTitle}>Items</Text>
        {loadingItems ? <ActivityIndicator /> : error ? <Text style={{ color: 'red' }}>{error}</Text> : (
          <FlatList
            data={menuItems || []}
            keyExtractor={(i) => String(i.id)}
            renderItem={({ item }) => (
              <View style={styles.itemRow}>
                <View>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>${Number(item.price).toFixed(2)}</Text>
                </View>
                <TouchableOpacity style={styles.addButton} onPress={() => handleAdd(item)}>
                  <Text style={{ color: '#fff' }}>Add</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={{ color: '#666' }}>Select a category to show items.</Text>}
          />
        )}
      </View>

      <View style={styles.cart}> 
        <Text style={styles.sectionTitle}>Cart</Text>
        {items.length === 0 ? <Text style={{ color: '#666' }}>Cart is empty</Text> : (
          <FlatList
            data={items}
            keyExtractor={(i) => String(i.id)}
            renderItem={({ item }) => (
              <View style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={{ color: '#666' }}>${(item.price * item.quantity).toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => decreaseQty(item.id)} style={styles.qtyBtn}><Text>-</Text></TouchableOpacity>
                  <Text style={{ marginHorizontal: 8 }}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => increaseQty(item.id)} style={styles.qtyBtn}><Text>+</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => removeItem(item.id)} style={[styles.qtyBtn, { marginLeft: 8 }]}><Text>×</Text></TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}

        <View style={styles.totals}>
          <Text>Subtotal: ${cartTotal.toFixed(2)}</Text>
          <Text style={{ fontWeight: '700' }}>Total: ${cartTotal.toFixed(2)}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FFD54F' }]} onPress={() => handleSaveOrder(true)}>
            <Text>Save & Hold</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#A5D6A7' }]} onPress={() => handleSaveOrder(false)}>
            <Text>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#E0E0E0' }]} onPress={() => fetchHeldOrders(paramTableId || useOrderStore.getState().tableId || '')}>
            <Text>Refresh Held</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 8 }}>
          <Text style={{ fontWeight: '700' }}>Held Orders</Text>
          {loadingHeld ? <ActivityIndicator /> : heldOrders && heldOrders.length > 0 ? (
            heldOrders.map((o) => (
              <TouchableOpacity key={o.id} style={{ padding: 8, backgroundColor: '#fff', marginTop: 6, borderRadius: 6 }} onPress={() => handleResume(o)}>
                <Text>#{o.id} — {o.status} — ${Number(o.subtotal || 0).toFixed(2)}</Text>
              </TouchableOpacity>
            ))
          ) : <Text style={{ color: '#666' }}>No held orders</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#FAF9F6' },
  header: { fontSize: 20, fontWeight: '700' },
  subheader: { color: '#666', marginBottom: 8 },
  section: { marginVertical: 8 },
  sectionTitle: { fontWeight: '700', marginBottom: 6 },
  catButton: { padding: 8, backgroundColor: '#fff', borderRadius: 6, marginRight: 8 },
  catButtonActive: { borderWidth: 2, borderColor: '#9CAF88' },
  catText: { color: '#333' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 8 },
  itemName: { fontWeight: '600' },
  itemPrice: { color: '#666' },
  addButton: { backgroundColor: '#9CAF88', padding: 8, borderRadius: 6 },
  cart: { marginTop: 8, padding: 8 },
  cartRow: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#fff', borderRadius: 6, marginBottom: 6 },
  qtyBtn: { padding: 6, backgroundColor: '#eee', borderRadius: 4 },
  totals: { marginTop: 8, alignItems: 'flex-end' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  actionBtn: { padding: 10, borderRadius: 6, minWidth: 90, alignItems: 'center' },
});
