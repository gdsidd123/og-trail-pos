import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Linking, SafeAreaView, StyleSheet, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import RootNavigator from './src/navigation/RootNavigator';
import LoginScreen from './src/screens/LoginScreen';
import { supabase } from './src/services/supabaseClient';
import type { UserRole } from './src/auth/AuthContext';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [initialTableId, setInitialTableId] = useState<number | null>(null);
  const [guestMode, setGuestMode] = useState(false);

  const readTableIdFromUrl = (url: string | null) => {
    if (!url) return;
    const match = url.match(/(?:\/--)?\/table\/(\d+)|[?&]tableId=(\d+)/i);
    const tableId = match?.[1] || match?.[2];
    if (tableId) setInitialTableId(Number(tableId));
  };

  useEffect(() => {
    let mounted = true;

    Linking.getInitialURL().then((url) => {
      if (mounted) readTableIdFromUrl(url);
    });

    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      readTableIdFromUrl(url);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) setGuestMode(false);
      setLoadingSession(false);
    });

    return () => {
      mounted = false;
      linkingSubscription.remove();
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function fetchProfile() {
      if (!session?.user?.id) {
        setRole(null);
        setLoadingProfile(false);
        return;
      }

      setLoadingProfile(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();
        if (error) throw error;
        if (!mounted) return;

        setRole((data?.role as UserRole) || 'customer');
      } catch {
        if (mounted) setRole('customer');
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    }

    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [session?.user?.id]);

  if (loadingSession || loadingProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {session || guestMode ? (
        <RootNavigator
          role={guestMode ? 'customer' : role || 'customer'}
          initialTableId={initialTableId}
          isGuest={guestMode}
          onLogout={() => {
            setGuestMode(false);
            supabase.auth.signOut();
          }}
        />
      ) : (
        <LoginScreen initialMode={initialTableId ? 'customer' : 'staff'} onContinueAsGuest={() => setGuestMode(true)} />
      )}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
