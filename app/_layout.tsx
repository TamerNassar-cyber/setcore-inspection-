import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { initDb } from '../lib/db/schema';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

function isResetPasswordUrl() {
  if (Platform.OS !== 'web') return false;
  return window.location.pathname.includes('reset-password');
}

export default function RootLayout() {
  useEffect(() => {
    initDb().catch(console.error);

    // Single source of truth for auth routing
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // If the user is on the reset-password page, let that screen handle routing
        // after they set their password — don't redirect them away prematurely.
        if (isResetPasswordUrl()) return;

        // New sign-in — route to correct screen based on role
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        const role = profile?.role ?? 'inspector';
        if (role === 'management') {
          router.replace('/(management)');
        } else if (role === 'supervisor') {
          router.replace('/(supervisor)');
        } else if (role === 'client') {
          router.replace('/(client)');
        } else {
          router.replace('/(inspector)/jobs');
        }
      } else if (event === 'INITIAL_SESSION' && !session) {
        // No stored session — send to login.
        // Skip if on reset-password (the hash token hasn't been processed yet).
        if (isResetPasswordUrl()) return;
        router.replace('/(auth)/login');
      } else if (event === 'SIGNED_OUT') {
        router.replace('/(auth)/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(inspector)" />
        <Stack.Screen name="(supervisor)" />
        <Stack.Screen name="(management)" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="reset-password" />
      </Stack>
    </>
  );
}
