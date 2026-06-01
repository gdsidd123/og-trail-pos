import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { useNavigation } from '@react-navigation/native';

type Table = { id: number; name?: string; capacity?: number | null; location?: string | null; status?: string };

export default function TablesScreen() {
  const [tables, setTables] = useState<Table[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    let mounted = true;
    async function fetchTables() {
      setLoading(true);
      setError(null);
      try {
        // select only columns that exist in the current schema
        const { data: tablesData, error: tablesError } = await supabase.from('tables').select('id, name, capacity, location').order('id');
        if (tablesError) throw tablesError;
        const tablesList = (tablesData as Table[]) || [];

        // Derive table status from any active orders for that table instead of relying on a stored `status` column.
        // Fetch recent orders for these tables where status is likely 'active' (not completed/closed).
        const tableIds = tablesList.map((t) => t.id);
        let orders = [] as any[];
        if (tableIds.length > 0) {
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('id, table_id, status, created_at')
            .in('table_id', tableIds)
            .order('created_at', { ascending: false });
          if (!ordersError && Array.isArray(ordersData)) orders = ordersData;
        }

        // Build a map of latest order per table (orders are already newest-first)
        const latestByTable: Record<string, any> = {};
        for (const o of orders) {
          if (!latestByTable[o.table_id]) latestByTable[o.table_id] = o;
        }

        // Attach derived status to each table
        const tablesWithStatus = tablesList.map((t) => ({ ...t, status: latestByTable[t.id]?.status ?? 'available' }));
        if (mounted) setTables(tablesWithStatus);
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load tables');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchTables();
    return () => (mounted = false);
  }, []);

  function statusBadge(status?: string) {
    switch ((status || 'available').toLowerCase()) {
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
      <Text style={styles.header}>Tables</Text>
      <FlatList
        data={tables || []}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('Order' as never, { tableId: item.id, tableName: item.name } as never)}
          >
            <View>
              <Text style={styles.tableName}>{item.name ?? `Table ${item.id}`}</Text>
              <Text style={styles.tableId}>#{item.id}</Text>
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
  header: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  tableName: { fontSize: 16, fontWeight: '600' },
  tableId: { color: '#666' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, color: '#000', fontWeight: '600' },
  status: { marginTop: 8, color: '#666' },
  error: { color: 'red' },
});
