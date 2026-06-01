import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';

type RouteParams = { orderId?: string };

export default function BillingScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const params = (route.params || {}) as RouteParams;
  const { orderId } = params;

  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      if (!orderId) return;
      setLoading(true);
      try {
        const { data: o } = await supabase.from('orders').select('*').eq('id', orderId).single();
        const { data: its } = await supabase.from('order_items').select('id, name, unit_price, quantity, line_total').eq('order_id', orderId);
        if (mounted) {
          setOrder(o);
          setItems(its || []);
        }
      } catch (e) {
        console.warn(e);
      } finally { if (mounted) setLoading(false); }
    }
    fetch();
    return () => { mounted = false; };
  }, [orderId]);

  const handleMarkPaid = async () => {
    if (!orderId) return;
    try {
      const { data, error } = await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId).select().single();
      if (error) throw error;
      Alert.alert('Marked paid');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Failed', err.message || String(err));
    }
  };

  if (loading) return <View style={styles.container}><ActivityIndicator /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Billing</Text>
      {!order ? <Text style={{ color: '#666' }}>No order selected</Text> : (
        <View>
          <Text>Order: {order.id}</Text>
          <Text>Table: {order.table_id}</Text>
          <Text>Status: {order.status}</Text>
          <Text>Subtotal: ${Number(order.subtotal || 0).toFixed(2)}</Text>
          <Text>Discount: ${Number(order.discount || 0).toFixed(2)}</Text>
          <Text>Total: ${Number(order.total || order.subtotal || 0).toFixed(2)}</Text>
          <Text style={{ marginTop: 12, fontWeight: '700' }}>Items</Text>
          {items && items.map((it) => (
            <View key={it.id} style={{ paddingVertical: 6 }}>
              <Text>{it.name} ×{it.quantity} — ${Number(it.unit_price).toFixed(2)}</Text>
            </View>
          ))}

          <TouchableOpacity style={styles.payBtn} onPress={handleMarkPaid}>
            <Text style={{ color: '#fff' }}>Mark Paid (placeholder)</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#FAF9F6' },
  header: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  payBtn: { marginTop: 16, backgroundColor: '#4CAF50', padding: 12, borderRadius: 8, alignItems: 'center' },
});
