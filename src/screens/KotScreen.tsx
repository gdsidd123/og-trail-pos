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

  const submittedCount = items.filter((item) => item.kot_status === 'submitted').length;
  const preparingCount = items.filter((item) => item.kot_status === 'preparing').length;

  const elapsedMinutes = (value?: string) => {
    if (!value) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  };

  const elapsedStyle = (minutes: number) => {
    if (minutes >= 20) return styles.elapsedDanger;
    if (minutes >= 10) return styles.elapsedWarn;
    return styles.elapsedFresh;
  };

  const statusStyle = (status: KotItem['kot_status']) => {
    if (status === 'preparing') return styles.statusPreparing;
    return styles.statusSubmitted;
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
      <View style={styles.summaryRow}>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryValue}>{groups.length}</Text>
          <Text style={styles.summaryLabel}>Orders</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryValue}>{submittedCount}</Text>
          <Text style={styles.summaryLabel}>New</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryValue}>{preparingCount}</Text>
          <Text style={styles.summaryLabel}>Preparing</Text>
        </View>
      </View>
      {groups.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Kitchen queue is clear</Text>
          <Text style={styles.emptyText}>New saved items will appear here automatically.</Text>
        </View>
      ) : (
        groups.map((group) => (
          <View key={group.order.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.tableTitle}>Table {group.order.table_id}</Text>
                <Text style={styles.orderMeta}>Order {group.order.id.slice(0, 8)}</Text>
              </View>
              <View style={styles.orderBadge}>
                <Text style={styles.orderBadgeText}>{group.items.length} items</Text>
              </View>
            </View>

            {group.items.map((item) => {
              const elapsed = elapsedMinutes(item.kot_submitted_at);
              return (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.itemName}>{item.quantity} x {item.name}</Text>
                      <Text style={[styles.itemStatus, statusStyle(item.kot_status)]}>{item.kot_status}</Text>
                    </View>
                    <View style={styles.itemMetaRow}>
                      <Text style={[styles.elapsedPill, elapsedStyle(elapsed)]}>{elapsed} min</Text>
                      <Text style={styles.sourceText}>{item.source_role || 'unknown'}</Text>
                    </View>
                  </View>
                  {item.kot_status === 'submitted' ? (
                    <TouchableOpacity style={styles.prepareButton} onPress={() => updateItemStatus(item, 'preparing')}>
                      <Text style={styles.buttonText}>Start</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.doneButton} onPress={() => updateItemStatus(item, 'done')}>
                      <Text style={styles.buttonText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
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
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryChip: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 12, alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: '#666', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tableTitle: { fontSize: 18, fontWeight: '800' },
  orderMeta: { color: '#666', marginTop: 2 },
  orderBadge: { backgroundColor: '#F1F3F4', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  orderBadgeText: { color: '#333', fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEE', paddingVertical: 12 },
  itemInfo: { flex: 1, paddingRight: 8 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  itemName: { fontSize: 16, fontWeight: '800' },
  itemStatus: { overflow: 'hidden', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  statusSubmitted: { backgroundColor: '#FFF3CD', color: '#7A4F01' },
  statusPreparing: { backgroundColor: '#E3F2FD', color: '#0D47A1' },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  elapsedPill: { overflow: 'hidden', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, fontWeight: '800' },
  elapsedFresh: { backgroundColor: '#E8F5E9', color: '#1B5E20' },
  elapsedWarn: { backgroundColor: '#FFF3CD', color: '#7A4F01' },
  elapsedDanger: { backgroundColor: '#FFEBEE', color: '#B71C1C' },
  sourceText: { color: '#666', textTransform: 'capitalize' },
  prepareButton: { minWidth: 72, backgroundColor: '#42A5F5', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center' },
  doneButton: { minWidth: 72, backgroundColor: '#4CAF50', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  statusText: { marginTop: 8, color: '#666' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 8, padding: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  emptyText: { color: '#666' },
  errorTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorText: { color: 'red', textAlign: 'center' },
});
