import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { SAGE_GREEN } from '../constants';
import { useAuth, useUserRole } from '../auth/AuthContext';

export default function SettingsScreen() {
  const role = useUserRole();
  const { isGuest, logout } = useAuth();
  const [email, setEmail] = useState<string>('Unknown');

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setEmail(data.user?.email || 'Unknown');
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    if (isGuest) {
      logout();
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Logout failed', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Signed in account</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{email}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{role}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FAF9F6' },
  panel: { backgroundColor: '#fff', borderRadius: 8, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#333', marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#EEE' },
  label: { color: '#666' },
  value: { fontWeight: '700', textTransform: 'capitalize' },
  logoutButton: { marginTop: 24, backgroundColor: SAGE_GREEN, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 6 },
  logoutText: { color: '#fff', fontWeight: '700' },
});
