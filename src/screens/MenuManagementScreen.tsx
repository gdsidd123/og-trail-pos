import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { supabase } from '../services/supabaseClient';

type Category = { id: number; name: string };
type MenuItem = { id: number; name: string; price: number; category_id: number; is_available: boolean };

export default function MenuManagementScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async (preferredCategoryId?: number | null) => {
    setLoadingCategories(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('categories').select('id, name').order('id');
      if (error) throw error;

      const categoriesData = (data as Category[]) || [];
      setCategories(categoriesData);

      if (categoriesData.length === 0) {
        setSelectedCategory(null);
        return;
      }

      setSelectedCategory((currentSelectedCategory) => {
        const preferred = preferredCategoryId
          ? categoriesData.find((category) => category.id === preferredCategoryId)
          : null;
        const current = currentSelectedCategory
          ? categoriesData.find((category) => category.id === currentSelectedCategory)
          : null;
        return (preferred || current || categoriesData[0]).id;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    if (selectedCategory == null) {
      setItems([]);
      return;
    }

    setLoadingItems(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, price, category_id, is_available')
        .eq('category_id', selectedCategory)
        .order('name');
      if (error) throw error;
      setItems((data as MenuItem[]) || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load menu items');
    } finally {
      setLoadingItems(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const resetCategoryForm = () => {
    setCategoryName('');
    setEditingCategoryId(null);
  };

  const resetItemForm = () => {
    setItemName('');
    setItemPrice('');
    setEditingItemId(null);
  };

  const handleCategorySubmit = async () => {
    const name = categoryName.trim();
    if (!name) return Alert.alert('Category name required');

    setSavingCategory(true);
    try {
      if (editingCategoryId) {
        const { error } = await supabase.from('categories').update({ name }).eq('id', editingCategoryId);
        if (error) throw error;
        await fetchCategories(editingCategoryId);
      } else {
        const { data, error } = await supabase.from('categories').insert({ name }).select('id').single();
        if (error) throw error;
        await fetchCategories(data?.id ?? null);
      }
      resetCategoryForm();
    } catch (err: any) {
      Alert.alert('Category save failed', err.message || String(err));
    } finally {
      setSavingCategory(false);
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategoryId(category.id);
    setCategoryName(category.name);
  };

  const handleDeleteCategory = (category: Category) => {
    Alert.alert('Delete category?', `Delete ${category.name}? This only works when no menu items use it.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('categories').delete().eq('id', category.id);
            if (error) throw error;
            if (editingCategoryId === category.id) resetCategoryForm();
            await fetchCategories(null);
          } catch (err: any) {
            Alert.alert('Delete failed', err.message || String(err));
          }
        },
      },
    ]);
  };

  const handleItemSubmit = async () => {
    const name = itemName.trim();
    const price = Number(itemPrice);
    if (selectedCategory == null) return Alert.alert('Select a category first');
    if (!name) return Alert.alert('Item name required');
    if (!Number.isFinite(price) || price < 0) return Alert.alert('Enter a valid price');

    setSavingItem(true);
    try {
      if (editingItemId) {
        const { error } = await supabase
          .from('menu_items')
          .update({ name, price, category_id: selectedCategory })
          .eq('id', editingItemId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('menu_items')
          .insert({ name, price, category_id: selectedCategory, is_available: true });
        if (error) throw error;
      }
      resetItemForm();
      await fetchItems();
    } catch (err: any) {
      Alert.alert('Item save failed', err.message || String(err));
    } finally {
      setSavingItem(false);
    }
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemPrice(String(Number(item.price)));
  };

  const handleDeleteItem = (item: MenuItem) => {
    Alert.alert('Delete item?', `Delete ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('menu_items').delete().eq('id', item.id);
            if (error) throw error;
            if (editingItemId === item.id) resetItemForm();
            await fetchItems();
          } catch (err: any) {
            Alert.alert('Delete failed', err.message || String(err));
          }
        },
      },
    ]);
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      const nextAvailability = !item.is_available;
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: nextAvailability })
        .eq('id', item.id);
      if (error) throw error;
      setItems((current) => current.map((row) => (row.id === item.id ? { ...row, is_available: nextAvailability } : row)));
    } catch (err: any) {
      Alert.alert('Availability update failed', err.message || String(err));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Menu</Text>
      <Text style={styles.subtitle}>Manage categories, items, prices, and availability.</Text>

      {loadingCategories ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <View style={styles.formRow}>
              <TextInput
                style={styles.input}
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="Category name"
              />
              <TouchableOpacity style={styles.primaryButton} onPress={handleCategorySubmit} disabled={savingCategory}>
                <Text style={styles.primaryButtonText}>{editingCategoryId ? 'Update' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
            {editingCategoryId ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={resetCategoryForm}>
                <Text style={styles.secondaryButtonText}>Cancel category edit</Text>
              </TouchableOpacity>
            ) : null}
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
                  <View style={styles.smallActions}>
                    <TouchableOpacity onPress={() => handleEditCategory(item)}>
                      <Text style={styles.linkText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteCategory(item)}>
                      <Text style={styles.deleteText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items</Text>
            <View style={styles.itemForm}>
              <TextInput
                style={styles.input}
                value={itemName}
                onChangeText={setItemName}
                placeholder="Item name"
              />
              <TextInput
                style={styles.input}
                value={itemPrice}
                onChangeText={setItemPrice}
                placeholder="Price"
                keyboardType="decimal-pad"
              />
              <View style={styles.formActions}>
                <TouchableOpacity style={styles.primaryButton} onPress={handleItemSubmit} disabled={savingItem || selectedCategory == null}>
                  <Text style={styles.primaryButtonText}>{editingItemId ? 'Update Item' : 'Add Item'}</Text>
                </TouchableOpacity>
                {editingItemId ? (
                  <TouchableOpacity style={styles.secondaryButtonInline} onPress={resetItemForm}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
            {loadingItems ? (
              <ActivityIndicator style={{ marginTop: 16 }} />
            ) : items.length === 0 ? (
              <Text style={styles.status}>No items found for this category.</Text>
            ) : (
              <FlatList
                scrollEnabled={false}
                data={items}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <View style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemMeta}>
                        Rs. {Number(item.price).toFixed(2)} - {item.is_available ? 'Available' : 'Unavailable'}
                      </Text>
                    </View>
                    <View style={styles.itemActions}>
                      <TouchableOpacity style={[styles.statusButton, !item.is_available && styles.statusButtonOff]} onPress={() => handleToggleAvailability(item)}>
                        <Text style={[styles.statusButtonText, !item.is_available && styles.statusButtonTextOff]}>
                          {item.is_available ? 'Hide' : 'Show'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.smallButton} onPress={() => handleEditItem(item)}>
                        <Text style={styles.linkText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.smallButton} onPress={() => handleDeleteItem(item)}>
                        <Text style={styles.deleteText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FAF9F6' },
  content: { paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#333', marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontWeight: '700', marginBottom: 10 },
  formRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  itemForm: { gap: 8, marginBottom: 12 },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { flex: 1, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: '#DDD', borderRadius: 8, backgroundColor: '#fff' },
  primaryButton: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#9CAF88' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { minHeight: 40, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#ECECEC', alignSelf: 'flex-start', marginBottom: 8 },
  secondaryButtonInline: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#ECECEC' },
  secondaryButtonText: { color: '#333', fontWeight: '700' },
  categoryList: { paddingBottom: 8 },
  categoryButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#DDD', marginRight: 10, backgroundColor: '#fff', minWidth: 120 },
  categoryButtonActive: { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' },
  categoryText: { color: '#333' },
  categoryTextActive: { color: '#2E7D32', fontWeight: '700' },
  smallActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 14, borderRadius: 8, backgroundColor: '#fff', marginBottom: 10 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16 },
  itemMeta: { color: '#666', marginTop: 4 },
  itemActions: { alignItems: 'flex-end', gap: 6 },
  statusButton: { minWidth: 76, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#E8F5E9', alignItems: 'center' },
  statusButtonOff: { backgroundColor: '#FCE4EC' },
  statusButtonText: { color: '#2E7D32', fontWeight: '700' },
  statusButtonTextOff: { color: '#AD1457' },
  smallButton: { paddingVertical: 2 },
  linkText: { color: '#1565C0', fontWeight: '700' },
  deleteText: { color: '#C62828', fontWeight: '700' },
  status: { color: '#666', marginTop: 6 },
  error: { color: 'red', marginTop: 8 },
});



