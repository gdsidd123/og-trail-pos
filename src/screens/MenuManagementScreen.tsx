import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabaseClient';

type Category = { id: number; name: string };
type MenuItem = { id: number; name: string; price: number; category_id: number };

export default function MenuManagementScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchCategories() {
      setLoadingCategories(true);
      setError(null);
      try {
        const { data, error } = await supabase.from('categories').select('id, name').order('id');
        if (error) throw error;
        if (mounted) {
          const categoriesData = (data as Category[]) || [];
          setCategories(categoriesData);
          if (categoriesData.length > 0) {
            setSelectedCategory(categoriesData[0].id);
          }
        }
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load categories');
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    }

    fetchCategories();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (selectedCategory == null) {
      setItems([]);
      return;
    }

    let mounted = true;
    async function fetchItems() {
      setLoadingItems(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('menu_items')
          .select('id, name, price, category_id')
          .eq('category_id', selectedCategory)
          .order('name');
        if (error) throw error;
        if (mounted) {
          setItems((data as MenuItem[]) || []);
        }
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load menu items');
      } finally {
        if (mounted) setLoadingItems(false);
      }
    }

    fetchItems();
    return () => { mounted = false; };
  }, [selectedCategory]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Menu</Text>
      <Text style={styles.subtitle}>Browse categories and menu items.</Text>

      {loadingCategories ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <FlatList
              horizontal
              data={categories}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.categoryButton, selectedCategory === item.id && styles.categoryButtonActive]}
                  onPress={() => setSelectedCategory(item.id)}
                >
                  <Text style={[styles.categoryText, selectedCategory === item.id && styles.categoryTextActive]}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items</Text>
            {loadingItems ? (
              <ActivityIndicator style={{ marginTop: 16 }} />
            ) : items.length === 0 ? (
              <Text style={styles.status}>No items found for this category.</Text>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <View style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>${Number(item.price).toFixed(2)}</Text>
                  </View>
                )}
              />
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FAF9F6' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#333', marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontWeight: '700', marginBottom: 10 },
  categoryList: { paddingBottom: 8 },
  categoryButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#DDD', marginRight: 10, backgroundColor: '#fff' },
  categoryButtonActive: { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' },
  categoryText: { color: '#333' },
  categoryTextActive: { color: '#2E7D32', fontWeight: '700' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 8, backgroundColor: '#fff', marginBottom: 10 },
  itemName: { fontSize: 16 },
  itemPrice: { fontWeight: '700' },
  status: { color: '#666', marginTop: 6 },
  error: { color: 'red', marginTop: 8 },
});
