import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';

type RevenueRow = { method: string; amount: number };
type TopItem = { name: string; quantity: number };

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todaySales, setTodaySales] = useState<number>(0);
  const [ordersToday, setOrdersToday] = useState<number>(0);
  const [activeOrders, setActiveOrders] = useState<number>(0);
  const [heldOrders, setHeldOrders] = useState<number>(0);
  const [revenueByMethod, setRevenueByMethod] = useState<RevenueRow[]>([]);
  const [topSellingItems, setTopSellingItems] = useState<TopItem[]>([]);

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

  const getTodayBounds = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { start, end } = getTodayBounds();

    try {
      const [ordersTodayRes, activeOrdersRes, heldOrdersRes, todaySalesRes, paymentsRes, paidOrdersRes] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'held'),
        supabase.from('orders').select('total').eq('status', 'paid').gte('created_at', start).lt('created_at', end),
        supabase.from('payments').select('payment_method, amount').eq('status', 'completed').gte('paid_at', start).lt('paid_at', end),
        supabase.from('orders').select('id').eq('status', 'paid'),
      ]);

      if (ordersTodayRes.error) throw ordersTodayRes.error;
      if (activeOrdersRes.error) throw activeOrdersRes.error;
      if (heldOrdersRes.error) throw heldOrdersRes.error;
      if (todaySalesRes.error) throw todaySalesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (paidOrdersRes.error) throw paidOrdersRes.error;

      setOrdersToday(ordersTodayRes.count || 0);
      setActiveOrders(activeOrdersRes.count || 0);
      setHeldOrders(heldOrdersRes.count || 0);

      const salesSum = (todaySalesRes.data || []).reduce((sum, row: any) => sum + Number(row.total || 0), 0);
      setTodaySales(salesSum);

      const revenueMap: Record<string, number> = { Cash: 0, UPI: 0, Card: 0 };
      (paymentsRes.data || []).forEach((row: any) => {
        const method = row.payment_method ?? 'Unknown';
        const amount = Number(row.amount || 0);
        if (!Object.prototype.hasOwnProperty.call(revenueMap, method)) {
          revenueMap[method] = 0;
        }
        revenueMap[method] += amount;
      });
      setRevenueByMethod(Object.entries(revenueMap).map(([method, amount]) => ({ method, amount })));

      const paidOrderIds = (paidOrdersRes.data || []).map((row: any) => row.id).filter(Boolean);
      const topItems: TopItem[] = [];
      if (paidOrderIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('name, quantity')
          .in('order_id', paidOrderIds);
        if (itemsError) throw itemsError;

        const itemTotals: Record<string, number> = {};
        (itemsData || []).forEach((row: any) => {
          const name = row.name || 'Unknown';
          const qty = Number(row.quantity || 0);
          itemTotals[name] = (itemTotals[name] || 0) + qty;
        });

        setTopSellingItems(
          Object.entries(itemTotals)
            .map(([name, quantity]) => ({ name, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5)
        );
      } else {
        setTopSellingItems([]);
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard])
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Dashboard failed to load</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Dashboard</Text>

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Today's Sales</Text>
          <Text style={styles.cardValue}>{formatCurrency(todaySales)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Orders Today</Text>
          <Text style={styles.cardValue}>{ordersToday}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Active Orders</Text>
          <Text style={styles.cardValue}>{activeOrders}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Held Orders</Text>
          <Text style={styles.cardValue}>{heldOrders}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Revenue by Payment Method</Text>
        {revenueByMethod.map((row) => (
          <View key={row.method} style={styles.listRow}>
            <Text style={styles.listLabel}>{row.method}</Text>
            <Text style={styles.listValue}>{formatCurrency(row.amount)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Selling Items</Text>
        {topSellingItems.length === 0 ? (
          <Text style={styles.emptyText}>No sold items yet.</Text>
        ) : (
          topSellingItems.map((item) => (
            <View key={item.name} style={styles.listRow}>
              <Text style={styles.listLabel}>{item.name}</Text>
              <Text style={styles.listValue}>{item.quantity}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F6' },
  content: { padding: 16 },
  pageTitle: { fontSize: 26, fontWeight: '700', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, marginRight: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardLabel: { color: '#666', marginBottom: 8 },
  cardValue: { fontSize: 24, fontWeight: '700' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  listLabel: { color: '#333' },
  listValue: { fontWeight: '700' },
  emptyText: { color: '#666' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF9F6' },
  loadingText: { marginTop: 12, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: '#FAF9F6' },
  errorTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorText: { color: 'red', textAlign: 'center' },
});
