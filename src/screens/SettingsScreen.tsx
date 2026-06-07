import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { SAGE_GREEN } from '../constants';

export default function SettingsScreen() {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Logout failed', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings (placeholder)</Text>
      <Text style={styles.subtitle}>App configuration and preferences will appear here.</Text>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF9F6' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#333' },
  logoutButton: { marginTop: 24, backgroundColor: SAGE_GREEN, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 6 },
  logoutText: { color: '#fff', fontWeight: '700' },
});
