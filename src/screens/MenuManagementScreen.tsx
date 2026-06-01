import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import CategoriesScreen from './Categories';

export default function MenuManagementScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Menu Management (placeholder)</Text>
      <Text style={styles.subtitle}>Use this area to manage menu items and categories.</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categories (for testing)</Text>
        <View style={styles.categoriesContainer}>
          <CategoriesScreen />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#FAF9F6', minHeight: '100%' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#333', marginBottom: 12 },
  section: { marginTop: 12 },
  sectionTitle: { fontWeight: '600', marginBottom: 8 },
  categoriesContainer: { backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' },
});
