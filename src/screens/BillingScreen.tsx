import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabaseClient';
import { useUserRole } from '../auth/AuthContext';

type RouteParams = { orderId?: string };

type OrderItem = { id: string; name: string; unit_price: number; quantity: number; line_total?: number };

const PAYMENT_METHODS = ['UPI', 'Cash', 'Card'] as const;

export default function BillingScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const params = (route.params || {}) as RouteParams;
  const { orderId } = params;
  const role = useUserRole();
  const canTakePayment = role !== 'server';

  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<OrderItem[] | null>(null);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [processing, setProcessing] = useState(false);

  const clearActiveBill = () => {
    setOrder(null);
    setItems(null);
    setDiscount(0);
    setPaymentMethod('Cash');
  };

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      if (!orderId) {
        clearActiveBill();
        return;
      }
      setLoading(true);
      try {
        const { data: o, error: orderError } = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (orderError) throw orderError;
        const { data: its, error: itemsError } = await supabase.from('order_items').select('id, name, unit_price, quantity, line_total').eq('order_id', orderId);
        if (itemsError) throw itemsError;
        if (mounted) {
          setOrder(o);
          setItems((its || []) as OrderItem[]);
          setDiscount(Number(o?.discount || 0));
        }
      } catch (e: any) {
        console.warn(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetch();
    return () => { mounted = false; };
  }, [orderId]);

  const subtotal = useMemo(() => {
    if (!items) return 0;
    return items.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
  }, [items]);

  const finalTotal = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);

  const handleMarkPaid = async () => {
    if (!orderId || !order) return;
    if (!paymentMethod) return Alert.alert('Select payment method');
    setProcessing(true);
    try {
      const paymentPayload = {
        order_id: orderId,
        amount: finalTotal,
        payment_method: paymentMethod,
        status: 'completed',
        paid_at: new Date().toISOString(),
      };

      const { data: existingPayment, error: existingPaymentError } = await supabase
        .from('payments')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();
      if (existingPaymentError) throw existingPaymentError;

      let paymentData;
      if (existingPayment?.id) {
        const result = await supabase.from('payments').update(paymentPayload).eq('id', existingPayment.id).select().single();
        if (result.error) throw result.error;
        paymentData = result.data;
      } else {
        const result = await supabase.from('payments').insert(paymentPayload).select().single();
        if (result.error) throw result.error;
        paymentData = result.data;
      }

      const { data: updatedOrder, error: orderError } = await supabase
        .from('orders')
        .update({ status: 'paid', discount, total: finalTotal })
        .eq('id', orderId)
        .select()
        .single();
      if (orderError) throw orderError;

      navigation.navigate('Receipt', {
        orderId,
        tableId: order.table_id,
        paymentMethod,
        total: finalTotal,
        paidAt: paymentPayload.paid_at,
        items: items?.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          line_total: Number(item.line_total ?? item.unit_price * item.quantity),
        })),
      });
      navigation.setParams({ orderId: undefined });
      clearActiveBill();
    } catch (err: any) {
      Alert.alert('Failed', err.message || String(err));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <View style={styles.container}><ActivityIndicator /></View>;

  if (!canTakePayment) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Billing</Text>
        <Text style={{ color: '#666' }}>You do not have access to billing.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Billing</Text>
      {!order ? <Text style={{ color: '#666' }}>No active bill selected</Text> : (
        <View>
          <View style={styles.row}>
            <Text style={styles.label}>Order ID</Text>
            <Text style={styles.value}>{order.id}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Table</Text>
            <Text style={styles.value}>{order.table_id}</Text>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Order Items</Text>
          {items?.map((it) => {
            const unitPrice = Number(it.unit_price || 0);
            const quantity = Number(it.quantity || 0);
            let lineTotal = Number(it.line_total);
            if (!lineTotal) {
              lineTotal = unitPrice * quantity;
            }
            return (
              <View key={it.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{it.name}</Text>
                  <Text style={styles.itemMeta}>Qty: {quantity} × ${unitPrice.toFixed(2)}</Text>
                </View>
                <Text style={styles.itemTotal}>${lineTotal.toFixed(2)}</Text>
              </View>
            );
          })}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.discountRow}>
            <Text style={styles.summaryLabel}>Discount</Text>
            <TextInput
              style={styles.discountInput}
              keyboardType="numeric"
              value={discount.toString()}
              onChangeText={(value) => setDiscount(Number(value) || 0)}
            />
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { fontWeight: '700' }]}>Final Total</Text>
            <Text style={[styles.summaryValue, { fontWeight: '700' }]}>${finalTotal.toFixed(2)}</Text>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Payment Method</Text>
          <View style={styles.paymentOptions}>
            {PAYMENT_METHODS.map((method) => (
              <TouchableOpacity
                key={method}
                style={[styles.paymentOption, paymentMethod === method && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod(method)}
              >
                <Text style={paymentMethod === method ? styles.paymentOptionTextSelected : styles.paymentOptionText}>{method}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.payBtn} onPress={handleMarkPaid} disabled={processing}>
            <Text style={{ color: '#fff' }}>{processing ? 'Processing...' : 'Mark Paid'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#FAF9F6' },
  header: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label: { color: '#666', fontSize: 14 },
  value: { fontSize: 15, fontWeight: '700' },
  sectionTitle: { fontWeight: '700', marginBottom: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  itemName: { fontWeight: '700' },
  itemMeta: { color: '#666', marginTop: 4 },
  itemTotal: { fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  summaryLabel: { color: '#444' },
  summaryValue: { color: '#222' },
  discountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  discountInput: { minWidth: 100, borderWidth: 1, borderColor: '#DDD', borderRadius: 6, padding: 10, textAlign: 'right', backgroundColor: '#fff' },
  paymentOptions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  paymentOption: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6, borderWidth: 1, borderColor: '#CCC', marginRight: 8, marginBottom: 8, backgroundColor: '#fff' },
  paymentOptionSelected: { borderColor: '#4CAF50', backgroundColor: '#E8F5E9' },
  paymentOptionText: { color: '#333' },
  paymentOptionTextSelected: { color: '#2E7D32', fontWeight: '700' },
  payBtn: { marginTop: 16, backgroundColor: '#4CAF50', padding: 12, borderRadius: 8, alignItems: 'center' },
});
