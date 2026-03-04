import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDb } from '../lib/db/schema';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

export default function RootLayout() {
  useEffect(() => {
    initDb().catch(console.error);

    // Handle magic link / OTP auth when app loads from an email link
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();

        const role = profile?.role ?? 'inspector';
        if (role === 'inspector') router.replace('/(inspector)/jobs');
        else if (role === 'supervisor') router.replace('/(supervisor)');
        else if (role === 'management') router.replace('/(management)');
        else if (role === 'client') router.replace('/(client)');
        else router.replace('/(inspector)/jobs');
      }
    });
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
