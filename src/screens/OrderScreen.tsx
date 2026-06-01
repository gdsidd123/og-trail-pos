import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function OrderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order (placeholder)</Text>
      <Text style={styles.subtitle}>Order details and cart will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF9F6' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#333' },
});
