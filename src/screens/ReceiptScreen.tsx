import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useRoute } from '@react-navigation/native';

type ReceiptItem = {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type RouteParams = {
  orderId?: string;
  tableId?: string | number;
  paymentMethod?: string;
  total?: number;
  customerName?: string;
  customerPhone?: string;
  paidAt?: string;
  items?: ReceiptItem[];
};

export default function ReceiptScreen() {
  const route = useRoute();
  const params = (route.params || {}) as RouteParams;
  const { orderId, tableId, paymentMethod, total, customerName, customerPhone, paidAt, items } = params;
  const date = paidAt ? new Date(paidAt) : new Date();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OG Trail Cafe</Text>
      <Text style={styles.subheader}>Receipt</Text>
      <View style={styles.section}>
        <Text style={styles.label}>Order</Text>
        <Text style={styles.value}>{orderId ?? 'N/A'}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Table</Text>
        <Text style={styles.value}>{tableId ?? 'N/A'}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Payment Method</Text>
        <Text style={styles.value}>{paymentMethod ?? 'N/A'}</Text>
      </View>
      {customerName || customerPhone ? (
        <View style={styles.section}>
          <Text style={styles.label}>Customer</Text>
          <Text style={styles.value}>{customerName || 'N/A'}{customerPhone ? ` • ${customerPhone}` : ''}</Text>
        </View>
      ) : null}
      <View style={styles.section}>
        <Text style={styles.label}>Date & Time</Text>
        <Text style={styles.value}>{date.toLocaleString()}</Text>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Items</Text>
      <FlatList
        data={items || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const lineTotal = Number(item.line_total);
          const displayTotal = Number.isFinite(lineTotal) && lineTotal !== 0
            ? lineTotal
            : Number(item.unit_price) * Number(item.quantity);
          return (
            <View style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>{item.quantity} × ${item.unit_price.toFixed(2)}</Text>
              </View>
              <Text style={styles.itemTotal}>${displayTotal.toFixed(2)}</Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={{ color: '#666' }}>No items available.</Text>}
      />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>${Number(total || 0).toFixed(2)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FAF9F6' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subheader: { fontSize: 16, color: '#666', marginBottom: 16 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 12, color: '#666' },
  value: { fontSize: 16, fontWeight: '600' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  itemName: { fontWeight: '600' },
  itemMeta: { color: '#666', marginTop: 4 },
  itemTotal: { fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#DDD' },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValue: { fontSize: 16, fontWeight: '700' },
});
