import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Image, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import Button from '../../components/shared/Button';
import Input from '../../components/shared/Input';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);

    if (error) {
      Alert.alert('Login Failed', error.message);
      return;
    }

    // Fetch user role and redirect
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();

    const role = profile?.role ?? 'inspector';
    if (role === 'inspector') router.replace('/(inspector)/jobs');
    else if (role === 'supervisor') router.replace('/(supervisor)');
    else if (role === 'management') router.replace('/(management)');
    else if (role === 'client') router.replace('/(client)');
    else router.replace('/(inspector)/jobs');
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>SETCORE</Text>
            <Text style={styles.logoSub}>INSPECTION</Text>
          </View>
          <Text style={styles.tagline}>Field Inspection System</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Sign In</Text>

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="inspector@setcore.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          <Button label="Sign In" onPress={handleLogin} loading={loading} fullWidth />
        </View>

        <Text style={styles.footer}>
          Setcore Petroleum Services{'\n'}© {new Date().getFullYear()} All rights reserved
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.black },
  container: { flexGrow: 1, padding: 24, justifyContent: 'space-between' },
  header: { alignItems: 'center', paddingTop: 80, paddingBottom: 48 },
  logo: { alignItems: 'center', marginBottom: 12 },
  logoText: { fontSize: 36, fontWeight: '900', color: Colors.white, letterSpacing: 4 },
  logoSub: { fontSize: 14, fontWeight: '600', color: Colors.primary, letterSpacing: 6, marginTop: -4 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  form: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.black, marginBottom: 24 },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 11, paddingVertical: 24, lineHeight: 18 },
});
