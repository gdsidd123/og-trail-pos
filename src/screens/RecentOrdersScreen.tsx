import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { formatTableLabel } from '../utils/tableDisplay';

type RecentOrder = {
  id: string;
  table_id: string | number | null;
  status: string;
  total?: number | null;
  created_at?: string | null;
  billed_at?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  table_name?: string | null;
  activity_at?: string | null;
};

type DayFilter = 'today' | 'yesterday';

const RECENT_STATUSES = ['open', 'held', 'billed', 'paid'];

type OrderItem = {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
  line_total?: number | null;
};

function uniqueOrders(rows: RecentOrder[]) {
  const byId = new Map<string, RecentOrder>();
  rows.forEach((row) => byId.set(row.id, row));
  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.activity_at || a.billed_at || a.created_at || 0).getTime();
    const bTime = new Date(b.activity_at || b.billed_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
}

function dayRange(filter: DayFilter) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (filter === 'yesterday') {
    start.setDate(start.getDate() - 1);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start: start.toISOString(), end: end.toISOString() };
}

function formatTime(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function latestTimestamp(values: Array<string | null | undefined>) {
  return values
    .filter(Boolean)
    .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0] || null;
}

function isWithinRange(value: string | null | undefined, start: string, end: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= new Date(start).getTime() && time < new Date(end).getTime();
}

export default function RecentOrdersScreen() {
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [filter, setFilter] = useState<DayFilter>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => dayRange(filter), [filter]);

  const openOrder = useCallback(async (order: RecentOrder) => {
    try {
      if (String(order.status).toLowerCase() !== 'paid') {
        navigation.navigate('Billing', { orderId: order.id });
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('id, name, unit_price, quantity, line_total')
        .eq('order_id', order.id);
      if (itemsError) throw itemsError;

      const { data: paymentData } = await supabase
        .from('payments')
        .select('payment_method, paid_at')
        .eq('order_id', order.id)
        .maybeSingle();

      const items = ((itemsData || []) as OrderItem[]).map((item) => ({
        id: item.id,
        name: item.name,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        line_total: Number(item.line_total ?? Number(item.unit_price) * Number(item.quantity)),
      }));

      navigation.navigate('Receipt', {
        orderId: order.id,
        tableId: order.table_id,
        tableName: order.table_name,
        paymentMethod: paymentData?.payment_method || 'N/A',
        total: Number(order.total || 0),
        customerName: order.customer_name || '',
        customerPhone: order.customer_phone || '',
        paidAt: paymentData?.paid_at || order.activity_at || order.billed_at || order.created_at,
        items,
      });
    } catch (err: any) {
      Alert.alert('Receipt failed to load', err.message || String(err));
    }
  }, [navigation]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('id, table_id, status, total, created_at, billed_at, customer_name, customer_phone')
        .in('status', RECENT_STATUSES)
        .order('created_at', { ascending: false })
        .limit(100);
      if (fetchError) throw fetchError;

      const recentOrders = (data || []) as RecentOrder[];
      const orderIds = recentOrders.map((order) => order.id);
      let latestItemSubmittedByOrder: Record<string, string | null> = {};
      let paidAtByOrder: Record<string, string | null> = {};
      if (orderIds.length > 0) {
        const { data: submittedItems, error: submittedItemsError } = await supabase
          .from('order_items')
          .select('order_id, kot_submitted_at')
          .in('order_id', orderIds);
        if (submittedItemsError) throw submittedItemsError;

        ((submittedItems || []) as { order_id: string; kot_submitted_at?: string | null }[]).forEach((item) => {
          latestItemSubmittedByOrder[item.order_id] = latestTimestamp([
            latestItemSubmittedByOrder[item.order_id],
            item.kot_submitted_at,
          ]);
        });

        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('order_id, paid_at')
          .in('order_id', orderIds);
        if (paymentsError) throw paymentsError;

        ((payments || []) as { order_id: string; paid_at?: string | null }[]).forEach((payment) => {
          paidAtByOrder[payment.order_id] = latestTimestamp([
            paidAtByOrder[payment.order_id],
            payment.paid_at,
          ]);
        });
      }

      const orderRows = uniqueOrders(
        recentOrders
          .map((order) => ({
            ...order,
            activity_at: latestTimestamp([paidAtByOrder[order.id], order.billed_at, latestItemSubmittedByOrder[order.id], order.created_at]),
          }))
          .filter((order) => isWithinRange(order.activity_at, range.start, range.end))
      );
      const tableIds = orderRows.map((order) => order.table_id).filter((tableId) => tableId !== null && tableId !== undefined);
      let tableNameById: Record<string, string> = {};
      if (tableIds.length > 0) {
        const { data: tableRows } = await supabase.from('tables').select('id, name').in('id', tableIds);
        tableNameById = Object.fromEntries(((tableRows || []) as { id: string | number; name: string }[]).map((table) => [String(table.id), table.name]));
      }

      setOrders(orderRows.map((order) => ({ ...order, table_name: order.table_id ? tableNameById[String(order.table_id)] || null : null })));
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [range.end, range.start]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Recent Orders</Text>
      <View style={styles.filterRow}>
        {(['today', 'yesterday'] as DayFilter[]).map((day) => (
          <TouchableOpacity
            key={day}
            style={[styles.filterBtn, filter === day && styles.filterBtnActive]}
            onPress={() => setFilter(day)}
          >
            <Text style={filter === day ? styles.filterTextActive : styles.filterText}>{day === 'today' ? 'Today' : 'Yesterday'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.statusText}>Loading recent orders...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Recent orders failed to load</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openOrder(item)}>
              <View style={styles.cardHeader}>
                <Text style={styles.tableText}>{formatTableLabel(item.table_id || '', item.table_name)}</Text>
                <Text style={styles.statusBadge}>{item.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.meta}>Order {item.id.slice(0, 8)} - {formatTime(item.activity_at || item.created_at)}</Text>
              <Text style={styles.meta}>{item.customer_name || 'No customer name'}{item.customer_phone ? ` - ${item.customer_phone}` : ''}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.amount}>Rs. {Number(item.total || 0).toFixed(2)}</Text>
                <Text style={styles.actionText}>{String(item.status).toLowerCase() === 'paid' ? 'Open receipt' : 'Open bill'}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No recent orders for {filter === 'today' ? 'today' : 'yesterday'}.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FAF9F6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  header: { fontSize: 24, fontWeight: '800', marginBottom: 12 },
  filterRow: { flexDirection: 'row', marginBottom: 16 },
  filterBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#DDD', backgroundColor: '#fff' },
  filterBtnActive: { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' },
  filterText: { color: '#444', fontWeight: '700' },
  filterTextActive: { color: '#2E7D32', fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tableText: { fontSize: 16, fontWeight: '800' },
  statusBadge: { fontSize: 12, fontWeight: '800', color: '#2E7D32', backgroundColor: '#E8F5E9', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  meta: { color: '#666', marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  amount: { fontWeight: '800' },
  actionText: { color: '#2E7D32', fontWeight: '800' },
  emptyText: { color: '#666' },
  statusText: { color: '#666', marginTop: 8 },
  errorTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  errorText: { color: 'red', textAlign: 'center' },
});

