import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';

type KotOrder = {
  id: string;
  table_id: number | string;
  status: string;
  created_at?: string;
};

type KotItem = {
  id: string;
  order_id: string;
  name: string;
  quantity: number;
  kot_status: 'submitted' | 'preparing' | 'done';
  kot_submitted_at?: string;
  kot_preparing_at?: string | null;
  source_role?: string | null;
};

type KotGroup = {
  order: KotOrder;
  items: KotItem[];
};

export default function KotScreen() {
  const [orders, setOrders] = useState<KotOrder[]>([]);
  const [items, setItems] = useState<KotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: activeOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, table_id, status, created_at')
        .in('status', ['open', 'held'])
        .order('created_at', { ascending: true });
      if (ordersError) throw ordersError;

      const orderRows = (activeOrders || []) as KotOrder[];
      setOrders(orderRows);

      const orderIds = orderRows.map((order) => order.id);
      if (orderIds.length === 0) {
        setItems([]);
        return;
      }

      const { data: kotItems, error: itemsError } = await supabase
        .from('order_items')
        .select('id, order_id, name, quantity, kot_status, kot_submitted_at, kot_preparing_at, source_role')
        .in('order_id', orderIds)
        .in('kot_status', ['submitted', 'preparing'])
        .order('kot_submitted_at', { ascending: true });
      if (itemsError) throw itemsError;

      setItems((kotItems || []) as KotItem[]);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchKot();
    }, [fetchKot])
  );

  useEffect(() => {
    const channel = supabase
      .channel('kot-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchKot)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchKot)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchKot]);

  const groups = useMemo<KotGroup[]>(() => {
    return orders
      .map((order) => ({
        order,
        items: items.filter((item) => item.order_id === order.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [orders, items]);

  const elapsedMinutes = (value?: string) => {
    if (!value) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  };

  const updateItemStatus = async (item: KotItem, nextStatus: 'preparing' | 'done') => {
    const payload: Record<string, string> = { kot_status: nextStatus };
    if (nextStatus === 'preparing') payload.kot_preparing_at = new Date().toISOString();
    if (nextStatus === 'done') payload.kot_done_at = new Date().toISOString();

    try {
      const { error: updateError } = await supabase.from('order_items').update(payload).eq('id', item.id);
      if (updateError) throw updateError;
      await fetchKot();
    } catch (err: any) {
      Alert.alert('KOT update failed', err.message || String(err));
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.statusText}>Loading KOT...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>KOT failed to load</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Kitchen Order Tickets</Text>
      {groups.length === 0 ? (
        <Text style={styles.emptyText}>No active KOT items.</Text>
      ) : (
        groups.map((group) => (
          <View key={group.order.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.tableTitle}>Table {group.order.table_id}</Text>
                <Text style={styles.orderMeta}>Order {group.order.id.slice(0, 8)}</Text>
              </View>
              <Text style={styles.orderStatus}>{group.order.status}</Text>
            </View>

            {group.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.quantity} x {item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {item.kot_status} • {elapsedMinutes(item.kot_submitted_at)} min • {item.source_role || 'unknown'}
                  </Text>
                </View>
                {item.kot_status === 'submitted' ? (
                  <TouchableOpacity style={styles.prepareButton} onPress={() => updateItemStatus(item, 'preparing')}>
                    <Text style={styles.buttonText}>Preparing</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.doneButton} onPress={() => updateItemStatus(item, 'done')}>
                    <Text style={styles.buttonText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F6' },
  content: { padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#FAF9F6' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tableTitle: { fontSize: 18, fontWeight: '800' },
  orderMeta: { color: '#666', marginTop: 2 },
  orderStatus: { color: '#333', fontWeight: '700', textTransform: 'capitalize' },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEE', paddingVertical: 10 },
  itemInfo: { flex: 1, paddingRight: 8 },
  itemName: { fontWeight: '700' },
  itemMeta: { color: '#666', marginTop: 4, textTransform: 'capitalize' },
  prepareButton: { backgroundColor: '#42A5F5', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 6 },
  doneButton: { backgroundColor: '#4CAF50', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 6 },
  buttonText: { color: '#fff', fontWeight: '700' },
  statusText: { marginTop: 8, color: '#666' },
  emptyText: { color: '#666' },
  errorTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorText: { color: 'red', textAlign: 'center' },
});
