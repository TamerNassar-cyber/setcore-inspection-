import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDb } from '../lib/db/schema';

export default function RootLayout() {
  useEffect(() => {
    initDb().catch(console.error);
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
      </Stack>
    </>
  );
}
