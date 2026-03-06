import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Alert, TouchableOpacity, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import SetcoreLogo from '../components/shared/SetcoreLogo';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // On web, the auth event may fire before this component mounts (hash
    // is processed immediately on page load). Check current session first
    // as a fallback so the "Verifying…" state never hangs.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSetPassword() {
    if (!password || password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    // onAuthStateChange in _layout.tsx will handle routing
    Alert.alert('Success', 'Password set! You are now logged in.');
  }

  if (!ready) {
    return (
      <View style={styles.loading}>
        <SetcoreLogo width={160} color="white" />
        <Text style={styles.loadingText}>Verifying your link…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <SetcoreLogo width={180} color="white" />
          <View style={styles.divider} />
          <Text style={styles.tagline}>FIELD INSPECTION SYSTEM</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Set Your Password</Text>
          <Text style={styles.cardSubtitle}>Choose a password to access the inspection app</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Minimum 6 characters"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Re-enter your password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={handleSetPassword}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>{loading ? 'SAVING…' : 'SET PASSWORD & LOG IN'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  loading: { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', gap: 24 },
  loadingText: { color: '#555', fontSize: 15 },
  scroll: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  brand: { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 100 : 80, paddingBottom: 48 },
  divider: { width: 40, height: 3, backgroundColor: Colors.primary, marginTop: 20, marginBottom: 14, borderRadius: 2 },
  tagline: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 3 },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 28 },
  cardTitle: { fontSize: 24, fontWeight: '800', color: Colors.black, marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 28 },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 1.2, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Colors.black, backgroundColor: '#FAFAFA',
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 8,
    shadowColor: Colors.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  btnText: { color: Colors.white, fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
});
