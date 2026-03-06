import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import SetcoreLogo from '../components/shared/SetcoreLogo';

// Auth gate — checks session and routes to the correct screen.
// Handles root URL visits and returning users with stored sessions.
export default function Index() {
  useEffect(() => {
    async function bootstrap() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.replace('/(auth)/login');
          return;
        }
        const { data: profile } = await supabase
          .from('users').select('role').eq('id', session.user.id).single();
        const role = profile?.role ?? 'inspector';
        if (role === 'supervisor' || role === 'management') {
          router.replace('/(supervisor)');
        } else {
          router.replace('/(inspector)/jobs');
        }
      } catch {
        router.replace('/(auth)/login');
      }
    }
    bootstrap();
  }, []);

  return (
    <View style={styles.container}>
      <SetcoreLogo width={160} color="white" />
      <ActivityIndicator color={Colors.primary} size="large" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: { marginTop: 40 },
});
