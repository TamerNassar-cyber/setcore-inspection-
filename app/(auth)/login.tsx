import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Alert, TouchableOpacity, TextInput,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import SetcoreLogo from '../../components/shared/SetcoreLogo';

type Mode = 'login' | 'otp-request' | 'otp-verify';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) Alert.alert('Login Failed', error.message);
      // Routing is handled by onAuthStateChange in _layout.tsx
    } catch (_) {
      Alert.alert('Error', 'Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOtp() {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          // Redirect back to the app root after clicking the magic link.
          // Supabase will append the session token as a URL hash which the
          // app processes automatically via detectSessionInUrl.
          emailRedirectTo: 'https://setcore-inspection.netlify.app',
        },
      });
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      setMode('otp-verify');
    } catch (_) {
      Alert.alert('Error', 'Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp || otp.length < 6) {
      Alert.alert('Error', 'Please enter the full 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'email',
      });
      if (error) Alert.alert('Invalid Code', 'The code is incorrect or expired. Please try again.');
      // Routing is handled by onAuthStateChange in _layout.tsx
    } catch (_) {
      Alert.alert('Error', 'Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.brand}>
          <SetcoreLogo width={200} color="white" />
          <View style={styles.divider} />
          <Text style={styles.tagline}>FIELD INSPECTION SYSTEM</Text>
        </View>

        {/* LOGIN MODE */}
        {mode === 'login' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>Access your inspection dashboard</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="inspector@setcore.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.signInBtn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.signInText}>{loading ? 'SIGNING IN…' : 'SIGN IN'}</Text>
            </TouchableOpacity>

            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>OR</Text>
              <View style={styles.separatorLine} />
            </View>

            <TouchableOpacity
              style={styles.otpBtn}
              onPress={() => setMode('otp-request')}
              activeOpacity={0.8}
            >
              <Text style={styles.otpBtnText}>First time? Sign in with email code</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* OTP REQUEST MODE */}
        {mode === 'otp-request' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Email Login Code</Text>
            <Text style={styles.cardSubtitle}>We'll send a 6-digit code to your email</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>YOUR SETCORE EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your.name@setcore.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.signInBtn, loading && styles.btnDisabled]}
              onPress={handleRequestOtp}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.signInText}>{loading ? 'SENDING…' : 'SEND CODE'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backBtn} onPress={() => setMode('login')}>
              <Text style={styles.backBtnText}>← Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* OTP VERIFY MODE */}
        {mode === 'otp-verify' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Check Your Email</Text>
            <Text style={styles.cardSubtitle}>A sign-in link has been sent to:</Text>
            <Text style={styles.emailHighlight}>{email}</Text>

            <View style={styles.linkInstructions}>
              <Text style={styles.linkStep}>1. Open your email inbox</Text>
              <Text style={styles.linkStep}>2. Find the email from Setcore / Supabase</Text>
              <Text style={styles.linkStep}>3. Click the <Text style={{ fontWeight: '800' }}>Sign In</Text> link</Text>
              <Text style={styles.linkStep}>4. You'll be logged in automatically</Text>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>OR ENTER CODE</Text>
              <View style={styles.separatorLine} />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>6-DIGIT CODE (if shown in email)</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                value={otp}
                onChangeText={setOtp}
                placeholder="000000"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={8}
                autoComplete="one-time-code"
              />
            </View>

            <TouchableOpacity
              style={[styles.signInBtn, (loading || otp.length < 6) && styles.btnDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading || otp.length < 6}
              activeOpacity={0.85}
            >
              <Text style={styles.signInText}>{loading ? 'VERIFYING…' : 'VERIFY CODE'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backBtn} onPress={() => { setMode('otp-request'); setOtp(''); }}>
              <Text style={styles.backBtnText}>← Resend email</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Setcore Petroleum Services</Text>
          <Text style={styles.footerSub}>© {new Date().getFullYear()} · All rights reserved</Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  scroll: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  brand: { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 100 : 80, paddingBottom: 48 },
  divider: { width: 40, height: 3, backgroundColor: Colors.primary, marginTop: 20, marginBottom: 14, borderRadius: 2 },
  tagline: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 3 },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 28, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  cardTitle: { fontSize: 24, fontWeight: '800', color: Colors.black, marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 28 },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 1.2, marginBottom: 8 },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Colors.black, backgroundColor: '#FAFAFA' },
  otpInput: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: 8 },
  signInBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: Colors.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  btnDisabled: { opacity: 0.6 },
  signInText: { color: Colors.white, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  separator: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  separatorLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  separatorText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  otpBtn: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  otpBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  backBtn: { alignItems: 'center', marginTop: 16 },
  backBtnText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  emailHighlight: { fontSize: 15, fontWeight: '700', color: Colors.black, textAlign: 'center', marginBottom: 20 },
  linkInstructions: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 16, marginBottom: 20, gap: 8 },
  linkStep: { fontSize: 14, color: '#374151', lineHeight: 20 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  footer: { alignItems: 'center', paddingVertical: 32 },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: '600', letterSpacing: 0.5 },
  footerSub: { fontSize: 11, color: 'rgba(255,255,255,0.18)', marginTop: 4 },
});
