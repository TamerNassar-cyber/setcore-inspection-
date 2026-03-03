import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import type { User, Qualification } from '../../types';

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);

  async function loadProfile() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    if (profile) setUser(profile);

    const { data: quals } = await supabase
      .from('qualifications')
      .select('*')
      .eq('inspector_id', authUser.id)
      .order('expiry_date', { ascending: true });

    if (quals) {
      const enriched = quals.map(q => ({
        ...q,
        days_until_expiry: differenceInDays(new Date(q.expiry_date), new Date()),
        is_expired: new Date(q.expiry_date) < new Date(),
      }));
      setQualifications(enriched);
    }
  }

  useEffect(() => { loadProfile(); }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  function certColor(days: number, expired: boolean) {
    if (expired) return Colors.fail;
    if (days <= 30) return Colors.fail;
    if (days <= 90) return Colors.pending;
    return Colors.pass;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Profile</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {user && (
          <Card style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.full_name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{user.full_name}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
            </View>
            <Text style={styles.company}>{user.company}</Text>
          </Card>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Certifications & Qualifications</Text>
            <Button label="+ Add" onPress={() => {}} style={styles.addBtn} />
          </View>

          {qualifications.length === 0 ? (
            <Card>
              <Text style={styles.empty}>No certifications added yet.</Text>
            </Card>
          ) : (
            qualifications.map(q => (
              <Card key={q.id}>
                <View style={styles.certRow}>
                  <View style={styles.certLeft}>
                    <Text style={styles.certType}>{q.cert_type}</Text>
                    <Text style={styles.certNumber}>Cert #: {q.cert_number}</Text>
                    <Text style={styles.certDate}>
                      Expires: {format(new Date(q.expiry_date), 'dd MMM yyyy')}
                    </Text>
                  </View>
                  <View style={[styles.expiryBadge, { backgroundColor: certColor(q.days_until_expiry, q.is_expired) + '22' }]}>
                    <Text style={[styles.expiryText, { color: certColor(q.days_until_expiry, q.is_expired) }]}>
                      {q.is_expired ? 'EXPIRED' : `${q.days_until_expiry}d`}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.black, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: Colors.white },
  signOut: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  content: { padding: 16 },
  profileCard: { alignItems: 'center', paddingVertical: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '800', color: Colors.white },
  name: { fontSize: 20, fontWeight: '700', color: Colors.black },
  email: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  roleBadge: { backgroundColor: Colors.black, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 8 },
  roleText: { color: Colors.white, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  company: { fontSize: 13, color: Colors.textMuted, marginTop: 6 },
  section: { marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.black },
  addBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  empty: { color: Colors.textSecondary, textAlign: 'center' },
  certRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  certLeft: { flex: 1 },
  certType: { fontSize: 15, fontWeight: '600', color: Colors.black },
  certNumber: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  certDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  expiryBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignItems: 'center', minWidth: 60 },
  expiryText: { fontSize: 12, fontWeight: '800' },
});
