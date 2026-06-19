import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatTableLabel } from '../utils/tableDisplay';

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
  tableName?: string | null;
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
  const { orderId, tableId, tableName, paymentMethod, total, customerName, customerPhone, paidAt, items } = params;
  const date = paidAt ? new Date(paidAt) : new Date();
  const totalAmount = Number(total || 0);
  const tableLabel = formatTableLabel(tableId, tableName);

  const receiptHtml = () => {
    const rows = (items || []).map((item) => {
      const lineTotal = Number(item.line_total) || Number(item.unit_price) * Number(item.quantity);
      return `
        <tr>
          <td>${item.name}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">Rs. ${Number(item.unit_price).toFixed(2)}</td>
          <td class="num">Rs. ${lineTotal.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
            h1 { margin: 0 0 4px; font-size: 24px; }
            h2 { margin: 0 0 18px; font-size: 16px; color: #555; }
            .meta { margin-bottom: 14px; }
            .meta div { margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border-bottom: 1px solid #ddd; padding: 8px 4px; text-align: left; }
            th { color: #555; font-size: 12px; }
            .num { text-align: right; }
            .total { margin-top: 18px; text-align: right; font-size: 18px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>OG Trail Cafe</h1>
          <h2>Receipt</h2>
          <div class="meta">
            <div><strong>Order:</strong> ${orderId || 'N/A'}</div>
            <div><strong>Table:</strong> ${tableLabel}</div>
            <div><strong>Payment:</strong> ${paymentMethod || 'N/A'}</div>
            ${(customerName || customerPhone) ? `<div><strong>Customer:</strong> ${customerName || 'N/A'}${customerPhone ? ` - ${customerPhone}` : ''}</div>` : ''}
            <div><strong>Date:</strong> ${date.toLocaleString()}</div>
          </div>
          <table>
            <thead>
              <tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Total</th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="4">No items available.</td></tr>'}</tbody>
          </table>
          <div class="total">Total: Rs. ${totalAmount.toFixed(2)}</div>
        </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    try {
      await Print.printAsync({ html: receiptHtml() });
    } catch (err: any) {
      Alert.alert('Print failed', err.message || String(err));
    }
  };

  const handleSharePdf = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html: receiptHtml() });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', `PDF generated at ${uri}`);
        return;
      }
      await Sharing.shareAsync(uri);
    } catch (err: any) {
      Alert.alert('PDF failed', err.message || String(err));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OG Trail Cafe</Text>
      <Text style={styles.subheader}>Receipt</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handlePrint}>
          <Text style={styles.actionText}>Print Preview</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleSharePdf}>
          <Text style={styles.secondaryText}>Share PDF</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Order</Text>
        <Text style={styles.value}>{orderId ?? 'N/A'}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Table</Text>
        <Text style={styles.value}>{tableLabel}</Text>
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
                <Text style={styles.itemMeta}>{item.quantity} x Rs. {item.unit_price.toFixed(2)}</Text>
              </View>
              <Text style={styles.itemTotal}>Rs. {displayTotal.toFixed(2)}</Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={{ color: '#666' }}>No items available.</Text>}
      />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>Rs. {totalAmount.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FAF9F6' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subheader: { fontSize: 16, color: '#666', marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  actionButton: { flex: 1, backgroundColor: '#9CAF88', padding: 12, borderRadius: 6, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DDD', padding: 12, borderRadius: 6, alignItems: 'center' },
  secondaryText: { color: '#333', fontWeight: '700' },
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






