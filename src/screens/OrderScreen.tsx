import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { useOrderStore } from '../stores/orderStore';

type RouteParams = { tableId?: number | string; tableName?: string; orderId?: string };
type Category = { id: number; name: string };
type MenuItem = { id: number; name: string; price: number; category_id?: number };

export default function OrderScreen() {
  const route = useRoute();
  const params = (route.params || {}) as RouteParams;
  const { tableId: paramTableId, tableName: paramTableName, orderId: paramOrderId } = params;

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
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [currentOrderStatus, setCurrentOrderStatus] = useState<string | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (paramTableId) setTable(paramTableId, paramTableName);
  }, [paramTableId, paramTableName]);

  const fetchExistingOrder = React.useCallback(() => {
    let mounted = true;

    const loadOrder = async () => {
      if (!paramOrderId) {
        if (paramTableId) {
          if (mounted) {
            setCurrentOrderId(null);
            setCurrentOrderStatus(null);
            setHeldOrderId(null);
            clear();
          }
          return;
        }
        if (mounted) {
          setCurrentOrderId(null);
          setCurrentOrderStatus(null);
          setHeldOrderId(null);
          clear();
        }
        return;
      }
      if (mounted) {
        setLoadingOrder(true);
        setError(null);
      }
      try {
        const { data: order, error: orderError } = await supabase.from('orders').select('*').eq('id', paramOrderId).single();
        if (orderError) throw orderError;
        if (!order) throw new Error('Order not found');

        if (mounted) {
          setCurrentOrderId(order.id);
          setCurrentOrderStatus(order.status);
        }

        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('id, order_id, menu_item_id, name, unit_price, quantity')
          .eq('order_id', order.id);
        if (itemsError) throw itemsError;

        if (mounted) {
          const store = useOrderStore.getState();
          store.clear();
          if (order.table_id) store.setTable(order.table_id, paramTableName);
          (itemsData as any[]).forEach((it) => {
            for (let i = 0; i < it.quantity; i++) {
              store.addItem({ id: it.menu_item_id, name: it.name, price: Number(it.unit_price) });
            }
          });
          if (order.status === 'held') {
            setHeldOrderId(order.id);
          } else {
            setHeldOrderId(null);
          }
        }
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load order');
      } finally {
        if (mounted) setLoadingOrder(false);
      }
    };

    loadOrder();
    return () => {
      mounted = false;
    };
  }, [paramOrderId, paramTableId, paramTableName, setHeldOrderId, clear]);

  useEffect(() => {
    const cleanup = fetchExistingOrder();
    return cleanup;
  }, [fetchExistingOrder]);

  useFocusEffect(
    React.useCallback(() => {
      return fetchExistingOrder();
    }, [fetchExistingOrder])
  );

  useEffect(() => {
    let mounted = true;
    async function fetchCats() {
      setLoadingCategories(true);
      setError(null);
      try {
        const { data, error } = await supabase.from('categories').select('id, name').order('id');
        if (error) throw error;
        if (mounted) {
          const categoriesData = (data as Category[]) || [];
          setCategories(categoriesData);
        }
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load categories');
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    }
    fetchCats();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!loadingCategories && categories && categories.length > 0 && selectedCategory == null) {
      setSelectedCategory(categories[0].id);
    }
  }, [loadingCategories, categories, selectedCategory]);

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
    return () => { mounted = false; };
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
    const tableId = paramTableId ?? useOrderStore.getState().tableId;
    if (!tableId) return Alert.alert('Select table first');
    if (stateItems.length === 0) return Alert.alert('Cart is empty');

    try {
      const orderPayload: any = {
        table_id: tableId,
        status: hold ? 'held' : 'open',
        subtotal: subtotal(),
      };
      let orderId = currentOrderId;
      // If no current order, ensure there is no other active order for this table (open/held).
      if (!orderId) {
        const { data: existing, error: existingErr } = await supabase
          .from('orders')
          .select('id,status')
          .eq('table_id', tableId)
          .in('status', ['open', 'held'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existingErr) throw existingErr;
        if (existing && existing.id) {
          orderId = existing.id;
        }
      }
      let orderData: any = null;

      if (orderId) {
        const { data, error } = await supabase.from('orders').update(orderPayload).eq('id', orderId).select().single();
        if (error) throw error;
        orderData = data;
      } else {
        const { data, error } = await supabase.from('orders').insert(orderPayload).select().limit(1).single();
        if (error) throw error;
        orderData = data;
      }

      if (!orderData?.id) throw new Error('Failed to save order');
      orderId = orderData.id;
      setCurrentOrderId(orderId);
      setCurrentOrderStatus(orderPayload.status);
      if (hold) {
        setHeldOrderId(orderId);
      } else {
        setHeldOrderId(null);
      }

      const itemsPayload = stateItems.map((it) => ({ order_id: orderId, menu_item_id: it.id, name: it.name, unit_price: it.price, quantity: it.quantity }));
      if (currentOrderId) {
        const { error: deleteError } = await supabase.from('order_items').delete().eq('order_id', orderId);
        if (deleteError) throw deleteError;
      }
      const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
      if (itemsError) throw itemsError;

      Alert.alert(hold ? 'Order held' : 'Order saved');
      await fetchHeldOrders(tableId);
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
      clear();
      if (order.table_id) setTable(order.table_id, String(order.table_id));
      const store = useOrderStore.getState();
      items.forEach((it) => {
        for (let i = 0; i < it.quantity; i++) store.addItem({ id: it.id, name: it.name, price: it.price });
      });
      setCurrentOrderId(order.id);
      setCurrentOrderStatus(order.status);
      if (order.status === 'held') {
        setHeldOrderId(order.id);
      } else {
        setHeldOrderId(null);
      }
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
      {currentOrderId ? (
        <Text style={styles.orderInfo}>Order: {currentOrderId.slice(0, 8)} — {currentOrderStatus ?? 'open'}</Text>
      ) : (
        <Text style={styles.orderInfo}>New order: press Save or Save & Hold to create</Text>
      )}

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
            ListEmptyComponent={<Text style={{ color: '#666' }}>{selectedCategory == null ? 'Select a category to show items.' : 'No menu items found for this category.'}</Text>}
          />
        )}

        <View style={styles.cart}>
          <Text style={styles.sectionTitle}>Current Order</Text>
          {items.length === 0 ? (
            <Text style={{ color: '#666' }}>No items selected yet.</Text>
          ) : (
            items.map((item) => (
              <View key={String(item.id)} style={styles.cartRow}>
                <View style={styles.cartItemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>${Number(item.price).toFixed(2)} each</Text>
                </View>
                <View style={styles.quantityControls}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => decreaseQty(item.id)}>
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => increaseQty(item.id)}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(item.id)}>
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

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
          {currentOrderId ? (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F06292' }]} onPress={async () => {
              // soft delete
              Alert.alert('Confirm', 'Cancel this order? (mark as cancelled)', [
                { text: 'No', style: 'cancel' },
                { text: 'Yes', onPress: async () => {
                  try {
                    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', currentOrderId);
                    if (error) throw error;
                    setCurrentOrderId(null);
                    setCurrentOrderStatus(null);
                    clear();
                    await fetchHeldOrders(paramTableId || useOrderStore.getState().tableId || '');
                    Alert.alert('Order cancelled');
                  } catch (e:any) { Alert.alert('Failed', e.message || String(e)); }
                } }
              ]);
            }}>
              <Text style={{ color: '#fff' }}>Delete</Text>
            </TouchableOpacity>
          ) : null}
          {currentOrderId ? (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#42A5F5' }]} onPress={() => navigation.navigate('Billing', { orderId: currentOrderId })}>
              <Text style={{ color: '#fff' }}>Generate Bill</Text>
            </TouchableOpacity>
          ) : null}
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
  orderInfo: { color: '#333', marginBottom: 8, fontSize: 12 },
  section: { marginVertical: 8 },
  sectionTitle: { fontWeight: '700', marginBottom: 6 },
  catButton: { padding: 8, backgroundColor: '#fff', borderRadius: 6, marginRight: 8 },
  catButtonActive: { borderWidth: 2, borderColor: '#9CAF88' },
  catText: { color: '#333' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 8 },
  itemName: { fontWeight: '600' },
  itemPrice: { color: '#666' },
  addButton: { backgroundColor: '#9CAF88', padding: 8, borderRadius: 6 },
  cart: { marginTop: 8, padding: 8, backgroundColor: '#fff', borderRadius: 8 },
  cartRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  cartItemInfo: { flex: 1, paddingRight: 8 },
  quantityControls: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eee', borderRadius: 4 },
  qtyBtnText: { fontSize: 18, fontWeight: '700' },
  qtyText: { minWidth: 28, textAlign: 'center', fontWeight: '700' },
  removeBtn: { marginLeft: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#FCE4EC', borderRadius: 6 },
  removeBtnText: { color: '#AD1457', fontWeight: '700' },
  totals: { marginTop: 8, alignItems: 'flex-end' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', marginTop: 8, gap: 6 },
  actionBtn: { padding: 10, borderRadius: 6, minWidth: 80, alignItems: 'center', flex: 0.45 },
});
