import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDb } from '../lib/db/schema';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

export default function RootLayout() {
  useEffect(() => {
    initDb().catch(console.error);

    // Single source of truth for auth routing
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // New sign-in — route to correct screen based on role
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        const role = profile?.role ?? 'inspector';
        if (role === 'supervisor' || role === 'management') {
          router.replace('/(supervisor)');
        } else {
          router.replace('/(inspector)/jobs');
        }
      } else if (event === 'INITIAL_SESSION' && !session) {
        // No stored session — send to login
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
