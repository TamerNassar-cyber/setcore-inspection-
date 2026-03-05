import { useEffect } from 'react';
import { router } from 'expo-router';

// Management users share the supervisor dashboard.
// This screen redirects immediately so they land in the right place.
export default function ManagementRedirect() {
  useEffect(() => {
    router.replace('/(supervisor)');
  }, []);
  return null;
}
