import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { NavigationProp, useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useAuth, useUserRole } from '../auth/AuthContext';

type Table = { id: number; name?: string; capacity?: number | null; location?: string | null; status?: string; activeOrderId?: string };
type RootTabParamList = {
  Order: { tableId: number; tableName?: string; orderId?: string };
};
type RouteParams = { qrTableId?: number | null };

export default function TablesScreen() {
  const route = useRoute();
  const params = (route.params || {}) as RouteParams;
  const { qrTableId } = params;
  const [tables, setTables] = useState<Table[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openedQrTable, setOpenedQrTable] = useState(false);
  const navigation = useNavigation<NavigationProp<RootTabParamList>>();
  const role = useUserRole();
  const { logout } = useAuth();
  const isCustomer = role === 'customer';

  async function fetchTables() {
    setLoading(true);
    setError(null);
    try {
      // select only columns that exist in the current schema
      const { data: tablesData, error: tablesError } = await supabase.from('tables').select('id, name, capacity, location').order('id');
      if (tablesError) throw tablesError;
      const tablesList = (tablesData as Table[]) || [];

      // Derive table status from any active open/held orders for that table.
      const tableIds = tablesList.map((t) => t.id);
      let orders = [] as any[];
      if (tableIds.length > 0) {
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('id, table_id, status, created_at')
          .in('table_id', tableIds)
          .in('status', ['open', 'held'])
          .order('created_at', { ascending: false });
        if (!ordersError && Array.isArray(ordersData)) orders = ordersData;
      }

      const latestOpenByTable: Record<string, any> = {};
      const latestHeldByTable: Record<string, any> = {};
      for (const o of orders) {
        if (o.status === 'open' && !latestOpenByTable[o.table_id]) {
          latestOpenByTable[o.table_id] = o;
        }
        if (o.status === 'held' && !latestHeldByTable[o.table_id]) {
          latestHeldByTable[o.table_id] = o;
        }
      }

      const tablesWithStatus = tablesList.map((t) => {
        const activeOrder = latestOpenByTable[t.id] ?? latestHeldByTable[t.id];
        return {
          ...t,
          status: activeOrder?.status ?? 'available',
          activeOrderId: activeOrder?.id,
        };
      });
      setTables(tablesWithStatus);
    } catch (err: any) {
      setError(err.message || 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      fetchTables();
    }, [])
  );

  useEffect(() => {
    // Initial load on mount
    fetchTables();
  }, []);

  useEffect(() => {
    if (!isCustomer || openedQrTable || !qrTableId || !tables?.length) return;
    const qrTable = tables.find((table) => table.id === qrTableId);
    if (!qrTable) return;
    setOpenedQrTable(true);
    navigation.navigate('Order', { tableId: qrTable.id, tableName: qrTable.name });
  }, [isCustomer, openedQrTable, qrTableId, tables, navigation]);

  function statusBadge(status?: string) {
    switch ((status || 'available').toLowerCase()) {
      case 'open':
      case 'occupied':
        return <Text style={[styles.badge, { backgroundColor: '#E57373' }]}>Occupied</Text>;
      case 'held':
        return <Text style={[styles.badge, { backgroundColor: '#FFD54F' }]}>Held</Text>;
      default:
        return <Text style={[styles.badge, { backgroundColor: '#A5D6A7' }]}>Available</Text>;
    }
  }

  if (loading) return (
    <View style={styles.container}><ActivityIndicator /><Text style={styles.status}>Loading tables…</Text></View>
  );
  if (error) return (
    <View style={styles.container}><Text style={styles.error}>Error: {error}</Text></View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Tables</Text>
        {isCustomer ? (
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {isCustomer && qrTableId ? <Text style={styles.qrHint}>QR table selected: {qrTableId}</Text> : null}
      <FlatList
        data={tables || []}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('Order', { tableId: item.id, tableName: item.name, orderId: isCustomer ? undefined : item.activeOrderId })}
          >
            <View>
              <Text style={styles.tableName}>{item.name ?? `Table ${item.id}`}</Text>
              <Text style={styles.tableId}>#{item.id}</Text>
              {item.activeOrderId ? (
                <Text style={styles.tableMeta}>Order {item.activeOrderId.slice(0, 8)} — {item.status}</Text>
              ) : (
                <Text style={styles.tableMeta}>No active order</Text>
              )}
            </View>
            {statusBadge(item.status)}
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FAF9F6' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  header: { fontSize: 20, fontWeight: '700' },
  qrHint: { color: '#666', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  tableName: { fontSize: 16, fontWeight: '600' },
  tableId: { color: '#666' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, color: '#000', fontWeight: '600' },
  status: { marginTop: 8, color: '#666' },
  tableMeta: { color: '#666', fontSize: 12, marginTop: 2 },
  error: { color: 'red' },
  logoutButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#E0E0E0' },
  logoutText: { fontWeight: '700', color: '#333' },
});
