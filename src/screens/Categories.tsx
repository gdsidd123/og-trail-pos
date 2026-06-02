import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabaseClient';

type Category = {
  id: number;
  name: string;
};

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchCategories() {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.from('categories').select('id, name').order('id', { ascending: true });
        if (error) throw error;
        if (mounted) setCategories((data as Category[]) || []);
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load categories');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchCategories();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.status}>Loading categories…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Categories</Text>
      <FlatList
        data={categories || []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemText}>{item.name}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.status}>No categories found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  item: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  itemText: { fontSize: 16 },
  status: { marginTop: 12, color: '#666' },
  error: { color: 'red' },
});
