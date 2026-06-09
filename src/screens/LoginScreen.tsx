import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { APP_NAME, OFF_WHITE, SAGE_GREEN } from '../constants';

type LoginScreenProps = {
  initialMode?: 'staff' | 'customer';
  onContinueAsGuest: () => void;
};

export default function LoginScreen({ initialMode = 'staff', onContinueAsGuest }: LoginScreenProps) {
  const [mode, setMode] = useState<'staff' | 'customer'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      Alert.alert('Login failed', err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const getFullPhoneNumber = () => {
    const cleanedCode = countryCode.trim().replace(/[^\d+]/g, '');
    const normalizedCode = cleanedCode.startsWith('+') ? cleanedCode : `+${cleanedCode}`;
    const cleanedPhone = phone.trim().replace(/\D/g, '');
    return `${normalizedCode}${cleanedPhone}`;
  };

  const handleSendOtp = async () => {
    const fullPhoneNumber = getFullPhoneNumber();
    if (!countryCode.trim() || !phone.trim()) {
      Alert.alert('Missing mobile', 'Enter your country code and mobile number.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhoneNumber });
      if (error) throw error;
      setOtpSent(true);
      Alert.alert('OTP sent', 'Enter the OTP sent to your mobile.');
    } catch (err: any) {
      Alert.alert('OTP failed', err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const fullPhoneNumber = getFullPhoneNumber();
    const trimmedOtp = otp.trim();
    if (!countryCode.trim() || !phone.trim() || !trimmedOtp) {
      Alert.alert('Missing details', 'Enter your mobile number and OTP.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: fullPhoneNumber,
        token: trimmedOtp,
        type: 'sms',
      });
      if (error) throw error;
    } catch (err: any) {
      Alert.alert('Verification failed', err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.panel}>
          <Text style={styles.title}>{APP_NAME}</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <View style={styles.modeRow}>
            <TouchableOpacity style={[styles.modeButton, mode === 'staff' && styles.modeButtonActive]} onPress={() => setMode('staff')}>
              <Text style={[styles.modeText, mode === 'staff' && styles.modeTextActive]}>Staff</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modeButton, mode === 'customer' && styles.modeButtonActive]} onPress={() => setMode('customer')}>
              <Text style={[styles.modeText, mode === 'customer' && styles.modeTextActive]}>Customer</Text>
            </TouchableOpacity>
          </View>

          {mode === 'staff' ? (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Password"
              />

              <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Mobile</Text>
              <View style={styles.phoneRow}>
                <TextInput
                  style={[styles.input, styles.countryInput]}
                  value={countryCode}
                  onChangeText={setCountryCode}
                  keyboardType="phone-pad"
                  placeholder="+91"
                />
                <TextInput
                  style={[styles.input, styles.phoneInput]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="7693040212"
                />
              </View>

              {otpSent ? (
                <>
                  <Text style={styles.label}>OTP</Text>
                  <TextInput
                    style={styles.input}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    placeholder="123456"
                  />
                </>
              ) : null}

              <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={otpSent ? handleVerifyOtp : handleSendOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{otpSent ? 'Verify OTP' : 'Send OTP'}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={onContinueAsGuest} disabled={loading}>
                <Text style={styles.secondaryButtonText}>Continue as Guest</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OFF_WHITE },
  content: { flexGrow: 1, alignItems: 'center', padding: 20, paddingTop: 72 },
  panel: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 8, padding: 20 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: '#666', marginBottom: 24 },
  modeRow: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#F3F3F3', borderRadius: 6, padding: 4 },
  modeButton: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 4 },
  modeButtonActive: { backgroundColor: '#fff' },
  modeText: { color: '#666', fontWeight: '700' },
  modeTextActive: { color: '#222' },
  label: { fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 6, padding: 12, marginBottom: 14, backgroundColor: '#fff' },
  phoneRow: { flexDirection: 'row', gap: 8 },
  countryInput: { width: 84 },
  phoneInput: { flex: 1 },
  button: { backgroundColor: SAGE_GREEN, padding: 14, borderRadius: 6, alignItems: 'center', marginTop: 6 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { padding: 14, borderRadius: 6, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#DDD' },
  secondaryButtonText: { color: '#333', fontWeight: '700' },
});
