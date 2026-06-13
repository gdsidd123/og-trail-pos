import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';

type UnpaidBill = {
  id: string;
  table_id: string | number;
  customer_name?: string | null;
  customer_phone?: string | null;
  total?: number | null;
  billed_at?: string | null;
  created_at?: string | null;
};

export default function UnpaidBillsScreen() {
  const navigation = useNavigation<any>();
  const [bills, setBills] = useState<UnpaidBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('id, table_id, customer_name, customer_phone, total, billed_at, created_at')
        .eq('status', 'billed')
        .order('billed_at', { ascending: false });
      if (fetchError) throw fetchError;
      setBills((data || []) as UnpaidBill[]);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBills();
    }, [fetchBills])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.statusText}>Loading unpaid bills...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Unpaid bills failed to load</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Unpaid Bills</Text>
      <FlatList
        data={bills}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Billing', { orderId: item.id })}>
            <View style={styles.cardHeader}>
              <Text style={styles.customerName}>{item.customer_name || 'Unnamed customer'}</Text>
              <Text style={styles.amount}>${Number(item.total || 0).toFixed(2)}</Text>
            </View>
            <Text style={styles.meta}>Table {item.table_id}</Text>
            <Text style={styles.meta}>{item.customer_phone || 'No phone added'}</Text>
            <Text style={styles.meta}>Order {item.id.slice(0, 8)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No unpaid bills.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FAF9F6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: '#FAF9F6' },
  header: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  customerName: { fontSize: 16, fontWeight: '800' },
  amount: { fontWeight: '800' },
  meta: { color: '#666', marginTop: 2 },
  emptyText: { color: '#666' },
  statusText: { color: '#666', marginTop: 8 },
  errorTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  errorText: { color: 'red', textAlign: 'center' },
});
